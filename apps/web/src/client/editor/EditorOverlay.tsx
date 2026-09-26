import { EDIT_CREDITS, type NodeVersionDto, newId, nextZKey } from '@annie3d/contracts';
import { type EditorTool, ModelEditor, prefetchRoomEnvironment } from '@annie3d/viewer-3d';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Brush, Camera, Columns2, Eraser, Lasso, Pause, Play, Rotate3d, Sun } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../api/client';
import { attachRun } from '../chrome/RunDialog';
import { rich, t as tNow, useT } from '../i18n';
import { afterNextPaint } from '../lib/afterNextPaint';
import { hasFileResult, isDoc, withCloud } from '../lib/doc';
import { perfEnd } from '../lib/perf';
import { dispatch, upsertVersions, useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { toast, useUi } from '../store/ui';

// This chunk loads on hover or at idle (lib/preload.ts): fetch the baked room lighting now too.
prefetchRoomEnvironment().catch(() => {});

type Tool = EditorTool | 'camera' | 'light';

/** Tools and their shortcut keys; names are `editor.tool.<id>`. */
const TOOLS: { id: Tool; key: string; Icon: typeof Brush }[] = [
  { id: 'orbit', key: 'O', Icon: Rotate3d },
  { id: 'brush', key: 'B', Icon: Brush },
  { id: 'lasso', key: 'L', Icon: Lasso },
  { id: 'camera', key: 'C', Icon: Camera },
  { id: 'light', key: 'G', Icon: Sun },
];

/** Version date as `toLocaleString()` shows it, in the app's language. */
const VERSION_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};

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
  const t = useT();
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
    canvas.setAttribute('aria-label', tNow('editor.viewport.label'));
    host.prepend(canvas);
    // The click that opened the editor paints the overlay first; the WebGL context and the
    // environment map (~50 ms) are built right after that paint (lib/afterNextPaint.ts).
    let ed: ModelEditor | null = null;
    const cancel = afterNextPaint(() => {
      ed = new ModelEditor(canvas, {
        onSelection: (faces, regions) => setSel({ faces, regions }),
        onTime: (at, d, playing) => setTime({ t: at, d, playing }),
      });
      const current = toolRef.current;
      if (current === 'brush' || current === 'lasso') ed.setTool(current);
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
  // The canvas is made outside React: name it again when the language changes.
  useEffect(() => {
    hostRef.current?.querySelector('canvas')?.setAttribute('aria-label', t('editor.viewport.label'));
  }, [t]);

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
      .catch((e: Error) => toast(tNow('editor.toast.loadFailed', { message: e.message }), 'error'))
      .finally(() => setLoading(false));
    setSel({ faces: 0, regions: 0 });
  }, [url, glEditor]);

  const compareUrl = glbOf(versions.find((v) => v.id === compareId));
  useEffect(() => {
    void glEditor?.compareWith(compareUrl ?? null);
  }, [compareUrl, glEditor]);

  const pick = useCallback((next: Tool) => {
    setTool(next);
    const ed = editorRef.current;
    if (!ed) return;
    ed.setTool(next === 'brush' || next === 'lasso' ? next : 'orbit');
  }, []);

  // Keyboard: Esc closes, tool letters switch tools (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
      if (e.key === 'Escape') closeEditor();
      const hit = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (hit && !e.metaKey && !e.ctrlKey) pick(hit.id);
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
  const label = node.label ?? t(`node.${node.kind}`);
  const shownNo = shown?.versionNo ?? 1;

  const makeCurrent = () => {
    if (!shownId || shownId === currentId) return;
    // The board store may not hold older versions (a snapshot carries only current ones): add the
    // shown one so the canvas can draw the node it becomes current on.
    if (shown) upsertVersions([shown]);
    // Revert is an ordinary, undoable op (F9).
    dispatch([{ type: 'node.update', id: nodeId, patch: { currentVersionId: shownId } }]);
    setViewing(null);
    toast(t('editor.toast.nowCurrent', { version: shownNo }));
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
      toast(t('editor.toast.cameraSet', { count: targets.length }));
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
            label: t('editor.packshot.customLabel'),
            settings: { angles: 'custom', size: '1k', camera },
            zKey: nextZKey(g),
          },
        },
        {
          type: 'edge.create',
          edge: { id: newId(), source: nodeId, sourcePort: 'out', target: id, targetPort: 'subject' },
        },
      ]);
      toast(t('editor.toast.packshotAdded'));
    }
  };

  const apply = async () => {
    const ed = editorRef.current;
    if (!ed || !instruction.trim()) return;
    if (mode === 'guest') return useUi.setState({ signInPrompt: { reason: 'run', nodeId } });
    // A board file first gets its copy on the server (new ids), or this model sent to it:
    // then Apply works as usual.
    if (mode === 'file' || (isDoc() && hasFileResult(nodeId)))
      return withCloud('run', { kind: 'edit', nodeId: nodeId ?? undefined }, () =>
        toast(tNow('editor.toast.readyAgain')),
      );
    const faces = ed.selection();
    if (!faces.length) return toast(t('editor.toast.selectFirst'), 'error');
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
      aria-label={t('editor.dialog.label', { name: label })}
      data-testid="editor"
    >
      <header className="editor-head">
        <button type="button" className="btn-link-inline" onClick={closeEditor} data-testid="editor-back">
          <ArrowLeft size={16} aria-hidden="true" /> {t('editor.head.back')}
        </button>
        <span className="editor-title" data-testid="editor-title">
          {label} <span className="ver">{t('editor.version', { version: shownNo })}</span>
          {shownId !== currentId && <span className="muted"> {t('editor.head.notCurrent')}</span>}
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
          title={versions.length < 2 ? t('editor.head.compareNeedsTwo') : t('editor.head.compareHint')}
        >
          <Columns2 size={14} aria-hidden="true" /> {t('editor.head.compare')}
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="chip-btn"
          onClick={() => useUi.setState({ dialog: { type: 'export', nodeId } })}
          data-testid="editor-export"
        >
          {t('editor.head.export')} ▾
        </button>
      </header>
      <div className="editor-body">
        <nav className="editor-tools" aria-label={t('editor.tools.label')}>
          {TOOLS.map(({ id, key, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={t('editor.tool.withKey', { tool: t(`editor.tool.${id}`), key })}
              title={t('editor.tool.withKey', { tool: t(`editor.tool.${id}`), key })}
              aria-pressed={tool === id}
              onClick={() => pick(id)}
              data-testid={`tool-${id}`}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            aria-label={t('editor.tool.clear')}
            title={t('editor.tool.clear')}
            onClick={() => editorRef.current?.clearSelection()}
            data-testid="tool-clear"
          >
            <Eraser size={18} aria-hidden="true" />
          </button>
        </nav>
        <div className="editor-viewport" ref={hostRef}>
          {loading && <div className="editor-loading-inline">{t('editor.viewport.loading')}</div>}
          {compareId && (
            <div className="compare-labels" aria-hidden="true">
              <span>
                {t('editor.version', { version: versions.find((v) => v.id === shownId)?.versionNo ?? '' })}
              </span>
              <span>
                {t('editor.version', { version: versions.find((v) => v.id === compareId)?.versionNo ?? '' })}
              </span>
            </div>
          )}
          {tool === 'brush' && (
            <label className="tool-option">
              {t('editor.option.brush')}{' '}
              <input
                type="range"
                min={6}
                max={80}
                value={brush}
                onChange={(e) => {
                  setBrush(+e.target.value);
                  editorRef.current?.setBrushRadius(+e.target.value);
                }}
                aria-label={t('editor.option.brushSize')}
              />
            </label>
          )}
          {tool === 'light' && (
            <label className="tool-option">
              {t('editor.option.light')}{' '}
              <input
                type="range"
                min={0}
                max={360}
                value={light}
                onChange={(e) => {
                  setLight(+e.target.value);
                  editorRef.current?.setLightAzimuth(+e.target.value);
                }}
                aria-label={t('editor.option.lightDirection')}
              />
            </label>
          )}
          {tool === 'camera' && (
            <div className="tool-option">
              {rich(t, 'editor.camera.hint', {
                button: (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={usePackshotView}
                    data-testid="use-view"
                  >
                    {t('editor.camera.useView')}
                  </button>
                ),
              })}
            </div>
          )}
          <div className="version-strip" role="toolbar" aria-label={t('editor.versions.label')}>
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === shownId}
                className={v.id === currentId ? 'current' : ''}
                onClick={() => setViewing(v.id === currentId ? null : v.id)}
                title={t('editor.versions.itemTitle', {
                  source: t(`editor.versionSource.${v.source}`),
                  date: t.date(new Date(v.createdAt), VERSION_DATE),
                })}
                data-testid={`version-${v.versionNo}`}
              >
                {t('editor.version', { version: v.versionNo })}
              </button>
            ))}
            {shownId && shownId !== currentId && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={makeCurrent}
                data-testid="make-current"
              >
                {t('editor.versions.makeCurrent')}
              </button>
            )}
          </div>
          {time.d > 0 && (
            <div className="playback">
              <button
                type="button"
                aria-label={time.playing ? t('editor.playback.pause') : t('editor.playback.play')}
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
        <aside className="editor-agent" aria-label={t('editor.panel.title')}>
          <h2 className="panel-title">{t('editor.panel.title')}</h2>
          <div className="chips">
            <span className="chip">
              {label} {t('editor.version', { version: shownNo })}
            </span>
            {sel.faces > 0 && (
              <span className="chip" data-testid="selection-chip">
                {t('editor.selection.summary', {
                  regions: t('editor.selection.regions', { count: sel.regions || 1 }),
                  faces: t('editor.selection.faces', { count: sel.faces }),
                })}
              </span>
            )}
          </div>
          {/* The step stays visible (a placeholder disappears as soon as you type). */}
          <label className="field-label" htmlFor="edit-instruction">
            {sel.faces ? t('editor.panel.stepDescribe') : t('editor.panel.stepPaint')}
          </label>
          <textarea
            id="edit-instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('editor.panel.placeholder')}
            aria-describedby="edit-help"
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
            {running ? `${running.stage}…` : t('editor.panel.apply')}
            {!running && <span className="cost">{t('common.credits', { count: EDIT_CREDITS })}</span>}
          </button>
          <p className="muted small" id="edit-help">
            {t('editor.panel.help')}
          </p>
        </aside>
      </div>
    </div>
  );
}
