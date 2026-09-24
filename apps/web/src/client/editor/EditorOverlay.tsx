import { EDIT_CREDITS, NODE_DEFS, type NodeVersionDto, newId, nextZKey } from '@annie3d/contracts';
import { type EditorTool, ModelEditor } from '@annie3d/viewer-3d';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Brush, Camera, Columns2, Eraser, Lasso, Pause, Play, Rotate3d, Sun } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../api/client';
import { attachRun } from '../chrome/RunDialog';
import { afterNextPaint } from '../lib/afterNextPaint';
import { perfEnd } from '../lib/perf';
import { dispatch, useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';

type Tool = EditorTool | 'camera' | 'light';

const TOOLS: { id: Tool; label: string; key: string; Icon: typeof Brush }[] = [
  { id: 'orbit', label: 'Orbit', key: 'O', Icon: Rotate3d },
  { id: 'brush', label: 'Brush select', key: 'B', Icon: Brush },
  { id: 'lasso', label: 'Lasso select', key: 'L', Icon: Lasso },
  { id: 'camera', label: 'Packshot camera', key: 'C', Icon: Camera },
  { id: 'light', label: 'Preview light', key: 'G', Icon: Sun },
];

function closeEditor() {
  useUi.setState({ editingNodeId: null });
  const u = new URL(location.href);
  u.searchParams.delete('edit');
  history.pushState(null, '', u);
}

function glbOf(v: NodeVersionDto | undefined) {
  return v?.outputs.find((o) => o.kind === 'model3d')?.urls.original ?? null;
}

/**
 * 3D editor overlay (F8 region edit, F9 versions/compare/revert, F4 packshot camera).
 * Loaded lazily with three.js; owns one WebGL context that is disposed on close.
 */
export default function EditorOverlay({ nodeId }: { nodeId: string }) {
  const node = useBoard((s) => s.graph.nodes.get(nodeId));
  const mode = useBoard((s) => s.mode);
  const boardId = useBoard((s) => s.boardId);
  const localVersions = useBoard((s) => s.versions);
  const running = useRuns((s) => s.progress.get(nodeId));
  const queryClient = useQueryClient();
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ModelEditor | null>(null);
  /** The WebGL editor, once built (after the overlay's first paint); effects that need it wait for it. */
  const [glEditor, setGlEditor] = useState<ModelEditor | null>(null);
  const [tool, setTool] = useState<Tool>('orbit');
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [sel, setSel] = useState({ faces: 0, regions: 0 });
  const [viewing, setViewing] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState({ t: 0, d: 0, playing: false });
  const [instruction, setInstruction] = useState('');
  const [brush, setBrush] = useState(24);
  const [light, setLight] = useState(40);

  // Versions: the server list for signed-in boards; the local version for guests.
  const remote = useQuery({
    queryKey: ['versions', boardId, nodeId, node?.currentVersionId],
    queryFn: () => api.versions(boardId!, nodeId),
    enabled: mode === 'remote' && !!boardId,
  });
  const versions = useMemo(() => {
    if (mode === 'remote')
      return [...(remote.data?.versions ?? [])].sort((a, b) => a.versionNo - b.versionNo);
    const v = node?.currentVersionId ? localVersions.get(node.currentVersionId) : undefined;
    return v ? [v] : [];
  }, [mode, remote.data, localVersions, node?.currentVersionId]);
  const currentId = node?.currentVersionId ?? null;
  const shownId = viewing ?? currentId;
  const shown =
    versions.find((v) => v.id === shownId) ?? (currentId ? localVersions.get(currentId) : undefined);

  // One editor (one WebGL context) per open overlay. A layout effect so the cleanup runs while
  // the canvas is still in the document (passive cleanups run after DOM removal).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per editor: dispose() force-loses the WebGL context, and a lost context
    // cannot be reused (StrictMode mounts effects twice in development).
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-testid', 'editor-canvas');
    canvas.setAttribute('aria-label', '3D viewport');
    host.prepend(canvas);
    // The click that opened the editor paints the overlay first; the WebGL context and the
    // environment map (~50 ms) are built right after that paint (lib/afterNextPaint.ts).
    let ed: ModelEditor | null = null;
    const cancel = afterNextPaint(() => {
      ed = new ModelEditor(canvas, {
        onSelection: (faces, regions) => setSel({ faces, regions }),
        onTime: (t, d, playing) => setTime({ t, d, playing }),
      });
      const t = toolRef.current;
      if (t === 'brush' || t === 'lasso') ed.setTool(t);
      editorRef.current = ed;
      setGlEditor(ed);
    });
    return () => {
      cancel();
      ed?.dispose();
      canvas.remove();
      editorRef.current = null;
    };
  }, []);

  // (Re)load the shown version; a new current version after an edit replaces the view.
  const url = glbOf(shown);
  useEffect(() => {
    const ed = glEditor;
    if (!ed || !url) return;
    setLoading(true);
    ed.load(url)
      .then((info) => {
        perfEnd('editor.open');
        setTime({ t: 0, d: info.duration, playing: false });
      })
      .catch((e: Error) => toast(`Could not load the model: ${e.message}`, 'error'))
      .finally(() => setLoading(false));
    setSel({ faces: 0, regions: 0 });
  }, [url, glEditor]);

  const compareUrl = glbOf(versions.find((v) => v.id === compareId));
  useEffect(() => {
    void glEditor?.compareWith(compareUrl ?? null);
  }, [compareUrl, glEditor]);

  const pick = useCallback((t: Tool) => {
    setTool(t);
    const ed = editorRef.current;
    if (!ed) return;
    ed.setTool(t === 'brush' || t === 'lasso' ? t : 'orbit');
  }, []);

  // Keyboard: Esc closes, tool letters switch tools (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
      if (e.key === 'Escape') closeEditor();
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t && !e.metaKey && !e.ctrlKey) pick(t.id);
      if (e.key === 'Backspace' || e.key === 'Delete') editorRef.current?.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick]);

  // A stale ?edit= link (deleted node, or another board) closes instead of showing nothing.
  useEffect(() => {
    if (mode !== 'loading' && !node) closeEditor();
  }, [mode, node]);

  if (!node) return null;
  const label = node.label ?? NODE_DEFS[node.kind].label;
  const shownNo = shown?.versionNo ?? 1;

  const makeCurrent = () => {
    if (!shownId || shownId === currentId) return;
    // Revert is an ordinary, undoable op (F9).
    dispatch([{ type: 'node.update', id: nodeId, patch: { currentVersionId: shownId } }]);
    setViewing(null);
    toast(`v${shownNo} is now current`);
  };

  const usePackshotView = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const camera = ed.cameraState();
    const g = useBoard.getState().graph;
    const targets = [...g.edges.values()]
      .filter((e) => e.source === nodeId && g.nodes.get(e.target)?.kind === 'packshot')
      .map((e) => e.target);
    if (targets.length) {
      dispatch(
        targets.map((id) => ({
          type: 'node.update' as const,
          id,
          patch: { settings: { angles: 'custom', camera } },
        })),
      );
      toast(`Packshot camera set on ${targets.length} node${targets.length > 1 ? 's' : ''}`);
    } else {
      const id = newId();
      dispatch([
        {
          type: 'node.create',
          node: {
            id,
            kind: 'packshot',
            x: node.x + 380,
            y: node.y - 200,
            label: 'Packshot (custom view)',
            settings: { angles: 'custom', size: '1k', camera },
            zKey: nextZKey(g),
          },
        },
        {
          type: 'edge.create',
          edge: { id: newId(), source: nodeId, sourcePort: 'out', target: id, targetPort: 'subject' },
        },
      ]);
      toast('Added a packshot node with this view');
    }
  };

  const apply = async () => {
    const ed = editorRef.current;
    if (!ed || !instruction.trim()) return;
    if (mode === 'guest') return useUi.setState({ signInPrompt: { reason: 'run', nodeId } });
    const faces = ed.selection();
    if (!faces.length) return toast('Select a region first (brush or lasso)', 'error');
    if (!shownId || !boardId) return;
    try {
      const run = await api.edit(boardId, nodeId, {
        idempotencyKey: crypto.randomUUID(),
        baseVersionId: shownId,
        selection: { faces },
        instruction: instruction.trim(),
      });
      attachRun(run.id, queryClient);
      setInstruction('');
      setViewing(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'insufficient_credits')
        useUi.setState({ dialog: { type: 'billing' } });
      else toast((e as Error).message, 'error');
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div
      className="editor"
      role="dialog"
      aria-modal="true"
      aria-label={`3D editor: ${label}`}
      data-testid="editor"
    >
      <header className="editor-head">
        <button type="button" className="btn-link-inline" onClick={closeEditor} data-testid="editor-back">
          <ArrowLeft size={16} aria-hidden="true" /> Back to canvas
        </button>
        <span className="muted" data-testid="editor-title">
          {label} · v{shownNo}
          {shownId !== currentId && ' (not current)'}
        </span>
        <button
          type="button"
          className={`chip-btn${compareId ? ' on' : ''}`}
          aria-pressed={!!compareId}
          disabled={versions.length < 2}
          onClick={() => {
            if (compareId) return setCompareId(null);
            const idx = versions.findIndex((v) => v.id === shownId);
            const other = versions[idx > 0 ? idx - 1 : idx + 1];
            if (other) setCompareId(other.id);
          }}
          data-testid="compare"
          title={versions.length < 2 ? 'Compare needs two versions' : 'Compare side by side'}
        >
          <Columns2 size={14} aria-hidden="true" /> Compare
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="chip-btn"
          onClick={() => useUi.setState({ dialog: { type: 'export', nodeId } })}
          data-testid="editor-export"
        >
          Export ▾
        </button>
      </header>
      <div className="editor-body">
        <nav className="editor-tools" aria-label="Editor tools">
          {TOOLS.map(({ id, label: l, key, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={`${l} (${key})`}
              title={`${l} (${key})`}
              aria-pressed={tool === id}
              onClick={() => pick(id)}
              data-testid={`tool-${id}`}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            aria-label="Clear selection (Delete)"
            title="Clear selection (Delete)"
            onClick={() => editorRef.current?.clearSelection()}
            data-testid="tool-clear"
          >
            <Eraser size={18} aria-hidden="true" />
          </button>
        </nav>
        <div className="editor-viewport" ref={hostRef}>
          {loading && <div className="editor-loading-inline">Loading model…</div>}
          {compareId && (
            <div className="compare-labels" aria-hidden="true">
              <span>v{versions.find((v) => v.id === shownId)?.versionNo}</span>
              <span>v{versions.find((v) => v.id === compareId)?.versionNo}</span>
            </div>
          )}
          {tool === 'brush' && (
            <label className="tool-option">
              Brush{' '}
              <input
                type="range"
                min={6}
                max={80}
                value={brush}
                onChange={(e) => {
                  setBrush(+e.target.value);
                  editorRef.current?.setBrushRadius(+e.target.value);
                }}
                aria-label="Brush size"
              />
            </label>
          )}
          {tool === 'light' && (
            <label className="tool-option">
              Light{' '}
              <input
                type="range"
                min={0}
                max={360}
                value={light}
                onChange={(e) => {
                  setLight(+e.target.value);
                  editorRef.current?.setLightAzimuth(+e.target.value);
                }}
                aria-label="Light direction"
              />
            </label>
          )}
          {tool === 'camera' && (
            <div className="tool-option">
              Frame the product, then
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={usePackshotView}
                data-testid="use-view"
              >
                Use this view for packshots
              </button>
            </div>
          )}
          <div className="version-strip" role="toolbar" aria-label="Versions">
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === shownId}
                className={v.id === currentId ? 'current' : ''}
                onClick={() => setViewing(v.id === currentId ? null : v.id)}
                title={`${v.source} · ${new Date(v.createdAt).toLocaleString()}`}
                data-testid={`version-${v.versionNo}`}
              >
                v{v.versionNo}
              </button>
            ))}
            {shownId && shownId !== currentId && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={makeCurrent}
                data-testid="make-current"
              >
                Make current
              </button>
            )}
          </div>
          {time.d > 0 && (
            <div className="playback">
              <button
                type="button"
                aria-label={time.playing ? 'Pause' : 'Play'}
                onClick={() => (time.playing ? editorRef.current?.pause() : editorRef.current?.play())}
              >
                {time.playing ? (
                  <Pause size={14} aria-hidden="true" />
                ) : (
                  <Play size={14} aria-hidden="true" />
                )}
              </button>
              <span>
                {fmt(time.t)} / {fmt(time.d)}
              </span>
            </div>
          )}
        </div>
        <aside className="editor-agent" aria-label="Edit with the agent">
          <b>Agent</b>
          <div className="chips">
            <span className="chip">
              {label} v{shownNo}
            </span>
            {sel.faces > 0 && (
              <span className="chip" data-testid="selection-chip">
                {sel.regions || 1} region{(sel.regions || 1) > 1 ? 's' : ''} · {sel.faces.toLocaleString()}{' '}
                faces
              </span>
            )}
          </div>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={
              sel.faces ? 'Make the cap matte black' : 'Select a region with the brush or lasso first'
            }
            aria-label="Edit instruction"
            data-testid="edit-instruction"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void apply();
            }}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!sel.faces || !instruction.trim() || !!running}
            onClick={() => void apply()}
            data-testid="edit-apply"
          >
            {running ? `${running.stage}…` : `Apply · ${EDIT_CREDITS} cr`}
          </button>
          <p className="muted small">
            Only the selected faces change. The result becomes a new version; the old one stays in the strip.
          </p>
        </aside>
      </div>
    </div>
  );
}
