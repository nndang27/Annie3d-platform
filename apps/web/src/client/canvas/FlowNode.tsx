import {
  ASPECTS,
  creditsFor,
  type EdgeRecord,
  GLB_PRESETS,
  LOOK_PRESETS,
  MOTION_PRESETS,
  NODE_DEFS,
  type NodeKind,
  type NodeRecord,
  type PortType,
} from '@annie3d/contracts';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AudioLines,
  Box,
  Camera,
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  Image as ImageIcon,
  type LucideIcon,
  MoreHorizontal,
  Music,
  Package,
  Play,
  StickyNote,
  Trash2,
  Type,
  Upload,
  Video,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { pickImage } from '../lib/media';
import { dispatch, useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { useUi } from '../store/ui';
import { deleteNodes, onRunNode, openEditor, uploadIntoNode } from './actions';
import { copySelection, duplicateNodes } from './clipboard';

const PROMPT_KEY: Partial<Record<NodeKind, string>> = {
  model3d: 'prompt',
  stage: 'prompt',
  adVideo: 'prompt',
  text: 'text',
  note: 'text',
};

export const PORT_ICON: Record<PortType, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  model3d: Box,
  scene: Clapperboard,
  video: Video,
  audio: AudioLines,
  file: Package,
};
const KIND_ICON: Record<NodeKind, LucideIcon> = {
  photo: ImageIcon,
  text: Type,
  upload3d: Box,
  audio: Music,
  model3d: Box,
  stage: Clapperboard,
  packshot: Camera,
  adVideo: Video,
  export: Package,
  note: StickyNote,
};
const ACCEPT: Partial<Record<NodeKind, string>> = {
  photo: 'image/png,image/jpeg,image/webp',
  audio: 'audio/*',
  upload3d: '.glb,model/gltf-binary',
};

/** Port bubbles (ElevenLabs flow nodes): first centre 36 px below the card top, one every 48 px. */
const PORT_TOP = 36;
const PORT_GAP = 48;

/**
 * Incoming/outgoing wire index, rebuilt once per edges map (not once per node per render):
 * every node reads its connected ports and upstream sources from it.
 */
const edgeIndexCache = new WeakMap<Map<string, EdgeRecord>, Map<string, EdgeRecord[]>>();
function incomingIndex(edges: Map<string, EdgeRecord>) {
  let idx = edgeIndexCache.get(edges);
  if (!idx) {
    idx = new Map();
    for (const e of edges.values()) {
      const list = idx.get(e.target) ?? [];
      list.push(e);
      idx.set(e.target, list);
      // Sources are keyed with a prefix so one map serves both directions.
      const out = idx.get(`>${e.source}`) ?? [];
      out.push(e);
      idx.set(`>${e.source}`, out);
    }
    edgeIndexCache.set(edges, idx);
  }
  return idx;
}

/**
 * Images carry no loading="lazy": React Flow culling already keeps off-screen nodes out of the
 * DOM, and lazy on in-viewport previews delayed LCP (Lighthouse lcp-lazy-loaded, 2026-09-24).
 *
 * One canvas node, laid out like ElevenLabs flow nodes: title above the card, round typed port
 * bubbles outside it, the result on top, the prompt and Run below, and the node's settings in a
 * toolbar under the card while it is selected. Memoised (React Flow perf guide) and subscribed
 * only to its own record, version, wires and run progress, so a change elsewhere never
 * re-renders it (react-best-practices: rerender-memo, rerender-derived-state).
 */
export const FlowNode = memo(function FlowNode({ id, selected }: NodeProps) {
  const node = useBoard((s) => s.graph.nodes.get(id));
  const lod = useUi((s) => s.lod);
  const single = useUi((s) => s.selected.size === 1);
  if (!node) return null;
  const def = NODE_DEFS[node.kind];
  const input = def.category === 'input';
  return (
    <div
      className={`node node-${node.kind} cat-${def.category} lod-${lod}${selected ? ' is-selected' : ''}`}
      data-testid={`node-${node.kind}`}
      data-node-id={id}
    >
      <Header node={node} />
      <div className="node-card">
        {node.kind === 'text' || node.kind === 'note' ? (
          <div className="node-body text-body">
            <Prompt node={node} />
          </div>
        ) : (
          <>
            <Preview node={node} selected={!!selected} />
            {!input && (
              <div className="node-body">
                {PROMPT_KEY[node.kind] ? <Prompt node={node} /> : <div className="grow" />}
                {def.runnable && <RunButton node={node} />}
              </div>
            )}
          </>
        )}
      </div>
      <Ports node={node} />
      {selected && single && <Toolbar node={node} />}
    </div>
  );
});

function Ports({ node }: { node: NodeRecord }) {
  const def = NODE_DEFS[node.kind];
  const wires = useBoard((s) => {
    const idx = incomingIndex(s.graph.edges);
    const inPorts = (idx.get(node.id) ?? []).map((e) => e.targetPort);
    return `${[...new Set(inPorts)].sort().join(',')}|${(idx.get(`>${node.id}`) ?? []).length > 0}`;
  });
  const [inList, outFlag] = wires.split('|');
  const connected = new Set(inList ? inList.split(',') : []);
  return (
    <>
      {def.inputs.map((p, i) => {
        const type = p.accepts[0] as PortType;
        const Icon = PORT_ICON[type];
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            className={`port port-${type}${connected.has(p.id) ? ' on' : ''}`}
            style={{ top: PORT_TOP + i * PORT_GAP }}
            title={`${p.label} (${p.accepts.join(' or ')})`}
          >
            <Icon size={16} strokeWidth={2} aria-hidden />
            <span className="port-label">{p.label}</span>
          </Handle>
        );
      })}
      {def.output &&
        (() => {
          const Icon = PORT_ICON[def.output.type];
          return (
            <Handle
              id="out"
              type="source"
              position={Position.Right}
              className={`port port-${def.output.type}${outFlag === 'true' ? ' on' : ''}`}
              style={{ top: PORT_TOP }}
              title={`${def.output.label} (${def.output.type})`}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
            </Handle>
          );
        })()}
    </>
  );
}

function Header({ node }: { node: NodeRecord }) {
  const def = NODE_DEFS[node.kind];
  const version = useBoard((s) =>
    node.currentVersionId ? s.versions.get(node.currentVersionId) : undefined,
  );
  const stale = useBoard((s) => s.stale.has(node.id));
  const Icon = KIND_ICON[node.kind];
  return (
    <div className="node-head">
      <Icon size={14} strokeWidth={2} aria-hidden className="kind-icon" />
      <span className="label">{node.label ?? def.label}</span>
      {stale && (
        <span className="badge-stale" title="Inputs changed since this version">
          stale
        </span>
      )}
      <span className="engine">
        {def.runnable && version ? <span className="ver">v{version.versionNo}</span> : null}
        {def.category !== 'input' && def.category !== 'note' ? def.engine : null}
      </span>
    </div>
  );
}

/** Thumbnails of images wired into this node, shown in its empty preview (ElevenLabs references). */
function useReferenceThumbs(node: NodeRecord): string[] {
  const zoom = useUi((s) => s.zoom);
  const key = useBoard((s) => {
    const idx = incomingIndex(s.graph.edges);
    const urls: string[] = [];
    for (const e of idx.get(node.id) ?? []) {
      const src = s.graph.nodes.get(e.source);
      if (!src || NODE_DEFS[src.kind].output?.type !== 'image' || !src.currentVersionId) continue;
      const out = s.versions.get(src.currentVersionId)?.outputs[0];
      const url = pickImage(out, 48, zoom);
      if (url) urls.push(url);
    }
    return urls.slice(0, 4).join('\n');
  });
  return key ? key.split('\n') : [];
}

function Preview({ node, selected }: { node: NodeRecord; selected: boolean }) {
  const version = useBoard((s) =>
    node.currentVersionId ? s.versions.get(node.currentVersionId) : undefined,
  );
  const progress = useRuns((s) => s.progress.get(node.id));
  const error = useRuns((s) => s.errors.get(node.id));
  const zoom = useUi((s) => s.zoom);
  const playing = useUi((s) => s.playingNodeId === node.id);
  const [dragOver, setDragOver] = useState(false);
  const refs = useReferenceThumbs(node);
  const outputs = version?.outputs ?? [];
  const primary = outputs[0];
  const kind = node.kind;

  const onEnter = useCallback(() => {
    if (primary?.urls.turntable || primary?.kind === 'video') useUi.setState({ playingNodeId: node.id });
  }, [primary, node.id]);
  const onLeave = useCallback(() => {
    if (useUi.getState().playingNodeId === node.id) useUi.setState({ playingNodeId: null });
  }, [node.id]);

  const isInput = NODE_DEFS[kind].category === 'input';
  if (isInput && !primary) {
    return (
      <label
        className={`node-preview drop-slot nodrag${dragOver ? ' dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void uploadIntoNode(node, f);
        }}
        data-testid="drop-slot"
      >
        <span className="placeholder">
          <Upload size={20} strokeWidth={1.75} aria-hidden />
          {kind === 'photo'
            ? 'Drop, paste or click to add a photo'
            : kind === 'audio'
              ? 'Drop a music file'
              : 'Drop a .glb file'}
        </span>
        <input
          type="file"
          accept={ACCEPT[kind]}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadIntoNode(node, f);
          }}
        />
      </label>
    );
  }
  const pct = progress ? Math.round(progress.progress * 100) : null;
  let content: React.ReactNode = (
    <span className="placeholder">
      <span className="placeholder-icon">
        <Zap size={18} strokeWidth={1.75} aria-hidden />
      </span>
      {progress ? progress.stage : 'Your generation will appear here'}
    </span>
  );
  if (kind === 'export' && version) {
    // Export bundle: file count and the preset checks recorded as gates.
    const gates = version.gates;
    const passed = gates.filter((g) => g.passed).length;
    const preset = gates[0]?.id.split(':')[0];
    content = (
      <div className="export-summary" data-testid="export-summary">
        <b>
          {outputs.length} file{outputs.length === 1 ? '' : 's'} ready
        </b>
        {gates.length > 0 && (
          <span className={passed === gates.length ? 'ok' : 'bad'}>
            {preset ? `${GLB_PRESETS[preset as keyof typeof GLB_PRESETS]?.label ?? preset} · ` : ''}
            {passed}/{gates.length} checks passed
          </span>
        )}
      </div>
    );
  } else if (kind === 'packshot' && outputs.length > 1) {
    content = (
      <div className="grid4">
        {outputs.slice(0, 4).map((o) => (
          <img key={o.id} src={pickImage(o, 160, zoom) ?? ''} alt="" decoding="async" draggable={false} />
        ))}
      </div>
    );
  } else if (kind === 'audio' && primary) {
    content = (
      <div className="audio-slot">
        <AudioLines size={28} strokeWidth={1.5} aria-hidden />
        {/* biome-ignore lint/a11y/useMediaCaption: instrumental music bed with no speech to caption. */}
        <audio className="nodrag" controls preload="none" src={primary.urls.original ?? undefined} />
      </div>
    );
  } else if (primary) {
    const poster = pickImage(primary, 320, zoom);
    const video = primary.kind === 'video' ? primary.urls.original : primary.urls.turntable;
    // Only the hovered node mounts a <video>; everything else is a poster (one video at a time).
    content =
      playing && video ? (
        <video src={video} poster={poster ?? undefined} autoPlay muted loop playsInline preload="none" />
      ) : poster ? (
        <img src={poster} alt={node.label ?? NODE_DEFS[kind].label} decoding="async" draggable={false} />
      ) : (
        <span className="placeholder">{primary.kind === 'model3d' ? '3D model' : primary.mime}</span>
      );
  }
  const contain = kind === 'adVideo' || kind === 'packshot';
  return (
    <div
      className={`node-preview${contain ? ' contain' : ''}${isInput ? ' input-media' : ''}${primary ? ' has-output' : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      data-testid="node-preview"
    >
      {content}
      {!primary && refs.length > 0 && (
        <div className="refs" aria-label="Reference images">
          {refs.map((u) => (
            <img key={u} src={u} alt="" decoding="async" draggable={false} />
          ))}
        </div>
      )}
      {progress && <span className="stage-label">{progress.stage}</span>}
      {error && !progress && (
        <div className="node-error" role="alert" title={error.message} data-testid="node-error">
          {error.code === 'gate_failed' ? `Check failed: ${error.gate}` : error.message}
        </div>
      )}
      {pct !== null && (
        <div className="progress" aria-label={`Progress ${pct}%`}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      {(kind === 'model3d' || kind === 'upload3d') && primary?.kind === 'model3d' && (
        <button
          type="button"
          className="overlay-btn open3d nodrag"
          onClick={() => openEditor(node.id)}
          data-testid="open-3d"
          tabIndex={selected ? 0 : -1}
        >
          Open 3D ⤢
        </button>
      )}
      {isInput && primary && NODE_DEFS[kind].output && (
        <button
          type="button"
          className="overlay-btn run-from-here nodrag"
          onClick={() => runFromHere(node.id)}
          data-testid="run-from-here"
          tabIndex={selected ? 0 : -1}
        >
          Run from here
        </button>
      )}
    </div>
  );
}

function runFromHere(nodeId: string) {
  if (useBoard.getState().mode === 'guest') {
    useUi.setState({ signInPrompt: { reason: 'run', nodeId } });
    return;
  }
  useUi.setState({ dialog: { type: 'run', nodeId, scope: 'from_here' } });
}

/**
 * View mode renders plain text; the textarea exists only while editing
 * (Miro: a widget is live DOM only while edited, otherwise a static rendering).
 */
function Prompt({ node }: { node: NodeRecord }) {
  const key = PROMPT_KEY[node.kind]!;
  const value = String(node.settings[key] ?? '');
  const requested = useUi((s) => s.editPromptId === node.id);
  const [editing, setEditing] = useState(requested);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (requested) {
      setEditing(true);
      useUi.setState({ editPromptId: null });
    }
  }, [requested]);
  useEffect(() => {
    if (!editing) return;
    // A new node stays visibility:hidden until React Flow has measured it, and hidden elements
    // cannot take focus: retry for a few frames.
    let tries = 0;
    let raf = 0;
    const focus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (document.activeElement !== el && ++tries < 20) raf = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(raf);
  }, [editing]);
  const commit = (v: string) => {
    setEditing(false);
    if (v !== value) dispatch([{ type: 'node.update', id: node.id, patch: { settings: { [key]: v } } }]);
  };
  const isText = node.kind === 'text' || node.kind === 'note';
  if (!editing) {
    return (
      <div
        className={`prompt nodrag${value ? '' : ' empty'}`}
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setEditing(true);
        }}
        data-testid="prompt"
      >
        {value || (isText ? 'Write something…' : 'Describe what you want…')}
      </div>
    );
  }
  return (
    <textarea
      ref={ref}
      className="prompt nodrag nowheel"
      defaultValue={value}
      placeholder={isText ? 'Write something…' : 'Describe what you want…'}
      maxLength={isText ? 4000 : 2000}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit((e.target as HTMLTextAreaElement).value);
        e.stopPropagation();
      }}
      data-testid="prompt-editor"
    />
  );
}

/** Run with a split menu (ElevenLabs "Run ▾"): this node alone, from here downstream, or with upstream. */
function RunButton({ node }: { node: NodeRecord }) {
  const running = useRuns((s) => s.progress.has(node.id));
  const cost = creditsFor(node.kind, node.settings);
  const [menu, setMenu] = useState(false);
  const scoped = (scope: string) => {
    setMenu(false);
    if (useBoard.getState().mode === 'guest') {
      useUi.setState({ signInPrompt: { reason: 'run', nodeId: node.id } });
      return;
    }
    useUi.setState({ dialog: { type: 'run', nodeId: node.id, scope } });
  };
  return (
    <div className="run-split nodrag">
      <span className="cost" title="Credits for this node">
        {cost} cr
      </span>
      <button
        type="button"
        className="run-main"
        onClick={() => onRunNode(node.id)}
        disabled={running}
        data-testid="run-node"
        aria-label={`Run · ${cost} credits`}
      >
        {running ? 'Running…' : 'Run'}
      </button>
      <button
        type="button"
        className="run-more"
        aria-label="Run options"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        disabled={running}
        data-testid="run-options"
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {menu && (
        <div className="run-menu" role="menu" onPointerLeave={() => setMenu(false)}>
          <button type="button" role="menuitem" onClick={() => scoped('with_upstream')}>
            Run with inputs
          </button>
          <button type="button" role="menuitem" onClick={() => scoped('node')}>
            Run this node only
          </button>
          <button type="button" role="menuitem" onClick={() => scoped('from_here')}>
            Run this and everything after
          </button>
        </div>
      )}
    </div>
  );
}

/** Settings and actions under the selected node (ElevenLabs node toolbar). */
function Toolbar({ node }: { node: NodeRecord }) {
  const set = (patch: Record<string, unknown>) =>
    dispatch([{ type: 'node.update', id: node.id, patch: { settings: patch } }]);
  const s = node.settings;
  const primary = useBoard((st) =>
    node.currentVersionId ? st.versions.get(node.currentVersionId)?.outputs[0] : undefined,
  );
  const [more, setMore] = useState(false);
  const sel = (
    key: string,
    options: readonly (string | number)[],
    label?: (v: string | number) => string,
  ) => (
    <select
      aria-label={key}
      value={String(s[key])}
      onChange={(e) =>
        set({ [key]: typeof options[0] === 'number' ? Number(e.target.value) : e.target.value })
      }
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {label ? label(o) : o}
        </option>
      ))}
    </select>
  );
  let controls: React.ReactNode = null;
  if (node.kind === 'model3d')
    controls = (
      <>
        {sel('builder', ['auto', 'code', 'generative'], (v) => `Builder: ${v}`)}
        {sel('detail', ['draft', 'standard', 'high'])}
      </>
    );
  if (node.kind === 'stage')
    controls = sel(
      'look',
      LOOK_PRESETS.map((l) => l.id),
      (v) => LOOK_PRESETS.find((l) => l.id === v)!.label,
    );
  if (node.kind === 'packshot')
    controls = (
      <>
        {sel('angles', ['four', 'custom'], (v) => (v === 'four' ? '4 angles' : 'Custom camera'))}
        {sel('size', ['1k', '2k'])}
      </>
    );
  if (node.kind === 'adVideo')
    controls = (
      <>
        {sel(
          'motion',
          MOTION_PRESETS.map((m) => m.id),
          (v) => MOTION_PRESETS.find((m) => m.id === v)!.label,
        )}
        {sel('aspect', ASPECTS)}
        {sel('durationSec', [6, 10, 15], (v) => `${v}s`)}
      </>
    );
  if (node.kind === 'export')
    controls = sel(
      'glbPreset',
      Object.keys(GLB_PRESETS),
      (v) => GLB_PRESETS[v as keyof typeof GLB_PRESETS].label,
    );
  const replace = ACCEPT[node.kind] && primary;
  const download = primary?.urls.original;
  return (
    <div className="node-foot nodrag" data-testid="node-toolbar">
      <div className="pill">
        {controls}
        {replace && (
          <label className="tb-btn">
            Replace
            <input
              type="file"
              accept={ACCEPT[node.kind]}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadIntoNode(node, f);
              }}
            />
          </label>
        )}
        {(controls || replace) && <span className="sep" />}
        {download && (
          <a
            className="tb-icon"
            href={download}
            download
            aria-label="Download"
            title="Download"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} aria-hidden />
          </a>
        )}
        <button
          type="button"
          className="tb-icon"
          aria-label="Delete node"
          title="Delete"
          onClick={() => deleteNodes([node.id])}
          data-testid="node-delete"
        >
          <Trash2 size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="tb-icon"
          aria-label="More actions"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          data-testid="node-more"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </div>
      {more && (
        <div className="run-menu tb-menu" role="menu" onPointerLeave={() => setMore(false)}>
          <button type="button" role="menuitem" onClick={() => duplicateNodes([node.id])}>
            <Copy size={14} aria-hidden /> Duplicate <kbd>⌘D</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMore(false);
              copySelection();
            }}
          >
            <Copy size={14} aria-hidden /> Copy <kbd>⌘C</kbd>
          </button>
          {NODE_DEFS[node.kind].runnable && (
            <button type="button" role="menuitem" onClick={() => onRunNode(node.id)}>
              <Play size={14} aria-hidden /> Run with inputs
            </button>
          )}
        </div>
      )}
    </div>
  );
}
