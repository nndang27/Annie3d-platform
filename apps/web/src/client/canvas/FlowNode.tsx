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
  SIM_ENVIRONMENTS,
  type SimEnvironment,
} from '@annie3d/contracts';
import { en, type MessageKey, type Translator } from '@annie3d/i18n';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AudioLines,
  ChevronDown,
  Copy,
  Download,
  Maximize2,
  MoreHorizontal,
  Play,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Popover } from '../chrome/Popover';
import { nodeName, useT } from '../i18n';
import { withCloud } from '../lib/doc';
import { pickImage } from '../lib/media';
import { perfStart } from '../lib/perf';
import { editorOverlay, ignore, prefetchAsset, simulatorOverlay } from '../lib/preload';
import { SimThumb } from '../sim/SimThumb';
import { dispatch, useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { useUi } from '../store/ui';
import { deleteNodes, onRunNode, openEditor, uploadIntoNode } from './actions';
import { copySelection, duplicateNodes } from './clipboard';
import { KIND_ICON, PORT_ICON } from './kindIcons';

/** A quality gate's readable name (`api.gate.<id>`); an id without one is shown as it is. */
const gateName = (t: Translator, gate?: string | null) =>
  gate && `api.gate.${gate}` in en ? t(`api.gate.${gate}` as MessageKey) : (gate ?? '');

const PROMPT_KEY: Partial<Record<NodeKind, string>> = {
  model3d: 'prompt',
  stage: 'prompt',
  adVideo: 'prompt',
  text: 'text',
  note: 'text',
};

const ACCEPT: Partial<Record<NodeKind, string>> = {
  photo: 'image/png,image/jpeg,image/webp',
  audio: 'audio/*',
  upload3d: '.glb,model/gltf-binary',
};

/** Port bubbles (ElevenLabs flow nodes): first centre 30 px below the card top, one every 38 px. */
const PORT_TOP = 30;
const PORT_GAP = 38;
/** Reference thumbnails shown in an empty result (the rest are counted). */
const MAX_REFS = 5;

/** A node's name: the one the person gave it, else its kind's name in the current language. */

/** Screen-reader name of a port: its name and the data types it takes ("Model or scene (3D model or Scene)"). */
function portName(t: Translator, port: string, types: readonly PortType[]) {
  const names = types.map((p) => t(`portType.${p}`));
  if (names.length === 1) return t('canvas.port.one', { port, type: names[0]! });
  if (names.length === 2) return t('canvas.port.two', { port, first: names[0]!, second: names[1]! });
  return t('canvas.port.many', {
    port,
    list: names.slice(0, -1).join(t('canvas.port.separator')),
    last: names.at(-1)!,
  });
}

const simEnvName = (t: Translator, env: unknown) =>
  (SIM_ENVIRONMENTS as readonly unknown[]).includes(env) ? t(`simEnv.${env as SimEnvironment}`) : null;

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
  const t = useT();
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
            {node.kind === 'simulation' && (
              <div className="node-body sim-body">
                <span className="sim-env-label">{simEnvName(t, node.settings.environment)}</span>
                <button
                  type="button"
                  className="open-sim nodrag"
                  onPointerEnter={() => simulatorOverlay.load().catch(ignore)}
                  onClick={() => openSimulator(node.id)}
                  data-testid="open-sim"
                >
                  {t('canvas.node.openSim')}
                </button>
              </div>
            )}
            {!input && node.kind !== 'simulation' && (
              <div className="node-body">
                {PROMPT_KEY[node.kind] && <Prompt node={node} />}
                {def.runnable && (
                  <div className="run-row">
                    <RunButton node={node} />
                  </div>
                )}
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
  const t = useT();
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
        const name = t(`port.${node.kind}.${p.id}` as MessageKey);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            className={`port port-${type}${connected.has(p.id) ? ' on' : ''}`}
            style={{ top: PORT_TOP + i * PORT_GAP }}
            aria-label={portName(t, name, p.accepts as readonly PortType[])}
          >
            <Icon size={12} strokeWidth={2.25} aria-hidden />
            <span className="port-tip" role="tooltip">
              {name}
            </span>
          </Handle>
        );
      })}
      {def.output &&
        (() => {
          const Icon = PORT_ICON[def.output.type];
          const name = t(`port.${node.kind}.out` as MessageKey);
          return (
            <Handle
              id="out"
              type="source"
              position={Position.Right}
              className={`port port-${def.output.type}${outFlag === 'true' ? ' on' : ''}`}
              style={{ top: PORT_TOP }}
              aria-label={portName(t, name, [def.output.type])}
            >
              <Icon size={12} strokeWidth={2.25} aria-hidden />
              <span className="port-tip" role="tooltip">
                {name}
              </span>
            </Handle>
          );
        })()}
    </>
  );
}

function Header({ node }: { node: NodeRecord }) {
  const t = useT();
  const def = NODE_DEFS[node.kind];
  const version = useBoard((s) =>
    node.currentVersionId ? s.versions.get(node.currentVersionId) : undefined,
  );
  const stale = useBoard((s) => s.stale.has(node.id));
  const Icon = KIND_ICON[node.kind];
  return (
    <div className="node-head">
      <Icon size={14} strokeWidth={2} aria-hidden className="kind-icon" />
      <span className="label">{nodeName(t, node)}</span>
      {stale && (
        <span className="badge-stale" title={t('canvas.node.staleTitle')}>
          {t('canvas.node.stale')}
        </span>
      )}
      {/* Information, not a control: plain meta text (Soft UI keeps "raised" for things you press). */}
      <span className="engine">
        {def.runnable && version ? <span className="ver">v{version.versionNo}</span> : null}
        {def.category !== 'input' && def.category !== 'note' ? t(`engine.${node.kind}`) : null}
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
    return urls.join('\n');
  });
  return key ? key.split('\n') : [];
}

function Preview({ node, selected }: { node: NodeRecord; selected: boolean }) {
  const t = useT();
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
    // A 3D result opens the editor on click: start loading its code and model now (lib/preload.ts).
    if (primary?.kind === 'model3d') {
      editorOverlay.load().catch(ignore);
      prefetchAsset(primary.urls.original);
    }
  }, [primary, node.id]);
  const onLeave = useCallback(() => {
    if (useUi.getState().playingNodeId === node.id) useUi.setState({ playingNodeId: null });
  }, [node.id]);

  const isInput = NODE_DEFS[kind].category === 'input';
  if (kind === 'simulation') {
    return (
      <div
        className="node-preview sim-preview"
        onDoubleClick={() => openSimulator(node.id)}
        onPointerEnter={() => simulatorOverlay.load().catch(ignore)}
        data-testid="node-preview"
      >
        <SimThumb
          nodeId={node.id}
          env={node.settings.environment as SimEnvironment}
          price={String(node.settings.price ?? '')}
        />
        <button
          type="button"
          className="open3d nodrag"
          onClick={() => openSimulator(node.id)}
          tabIndex={selected ? 0 : -1}
          aria-label={t('canvas.node.openSimLabel')}
          title={t('canvas.node.openSimTitle')}
        >
          <Maximize2 size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }
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
            ? t('canvas.node.dropPhoto')
            : kind === 'audio'
              ? t('canvas.node.dropMusic')
              : t('canvas.node.dropGlb')}
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
      {progress ? progress.stage : t('canvas.node.emptyResult')}
    </span>
  );
  if (kind === 'export' && version) {
    // Export bundle: file count and the preset checks recorded as gates.
    const gates = version.gates;
    const passed = gates.filter((g) => g.passed).length;
    const preset = gates[0]?.id.split(':')[0];
    content = (
      <div className="export-summary" data-testid="export-summary">
        <b>{t('canvas.node.filesReady', { count: outputs.length })}</b>
        {gates.length > 0 && (
          <span className={passed === gates.length ? 'ok' : 'bad'}>
            {preset
              ? t('canvas.node.checksPassedPreset', {
                  passed,
                  total: gates.length,
                  preset:
                    preset in GLB_PRESETS ? t(`glbPreset.${preset as keyof typeof GLB_PRESETS}`) : preset,
                })
              : t('canvas.node.checksPassed', { passed, total: gates.length })}
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
        <img src={poster} alt={nodeName(t, node)} decoding="async" draggable={false} />
      ) : (
        <span className="placeholder">
          {primary.kind === 'model3d' ? t('portType.model3d') : primary.mime}
        </span>
      );
  }
  const contain = kind === 'adVideo' || kind === 'packshot';
  const has3d = (kind === 'model3d' || kind === 'upload3d') && primary?.kind === 'model3d';
  return (
    <div
      // One click selects the node (React Flow); a double-click on a 3D result opens the editor.
      onDoubleClick={has3d ? () => openEditor(node.id) : undefined}
      className={`node-preview${contain ? ' contain' : ''}${isInput ? ' input-media' : ''}${primary ? ' has-output' : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      data-testid="node-preview"
    >
      {content}
      {!primary && refs.length > 0 && (
        // Wired-in images as a stack (back cards offset up-right); hovering fans them out in a row.
        <div
          className="refs"
          aria-label={t('canvas.node.referenceImages', { count: refs.length })}
          style={{ '--n': Math.min(refs.length, MAX_REFS) } as React.CSSProperties}
          data-testid="refs"
        >
          {refs.slice(0, MAX_REFS).map((u, i) => (
            <img
              key={u}
              src={u}
              alt=""
              decoding="async"
              draggable={false}
              style={{ '--i': i } as React.CSSProperties}
            />
          ))}
          {refs.length > MAX_REFS && <span className="more">+{refs.length - MAX_REFS}</span>}
        </div>
      )}
      {progress && <span className="stage-label">{progress.stage}</span>}
      {error && !progress && (
        <div className="node-error" role="alert" title={error.message} data-testid="node-error">
          {error.code === 'gate_failed'
            ? t('run.checkFailed', { gate: gateName(t, error.gate) })
            : error.message}
        </div>
      )}
      {pct !== null && (
        <div className="progress" aria-label={t('canvas.node.progress', { percent: pct })}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      {has3d && (
        <button
          type="button"
          className="open3d nodrag"
          onClick={() => openEditor(node.id)}
          data-testid="open-3d"
          tabIndex={selected ? 0 : -1}
          aria-label={t('canvas.node.openEditorLabel')}
          title={t('canvas.node.openEditorTitle')}
        >
          <AxesIcon />
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
          {t('canvas.node.runFromHere')}
        </button>
      )}
    </div>
  );
}

/** Three arrows from one point (up, down-left, down-right): the 3D-view mark the design asks for. */
function AxesIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 11V2.5M8.2 6.3 12 2.5l3.8 3.8" />
      <path d="M10.3 14 2.8 18.6M3.3 14.2l-.5 4.4 4.4.7" />
      <path d="M13.7 14l7.5 4.6M20.7 14.2l.5 4.4-4.4.7" />
    </svg>
  );
}

function openSimulator(nodeId: string) {
  perfStart('simulator.open');
  useUi.setState({ simulatingNodeId: nodeId });
}

function runFromHere(nodeId: string) {
  withCloud('run', { kind: 'run', nodeId, scope: 'from_here' }, (id) =>
    useUi.setState({ dialog: { type: 'run', nodeId: id!, scope: 'from_here' } }),
  );
}

/**
 * View mode renders plain text; the textarea exists only while editing
 * (Miro: a widget is live DOM only while edited, otherwise a static rendering).
 */
function Prompt({ node }: { node: NodeRecord }) {
  const t = useT();
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
  const placeholder = isText ? t('canvas.node.writePlaceholder') : t('canvas.node.describePlaceholder');
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
        {value || placeholder}
      </div>
    );
  }
  return (
    <textarea
      ref={ref}
      className="prompt nodrag nowheel"
      defaultValue={value}
      placeholder={placeholder}
      maxLength={isText ? 4000 : 2000}
      onBlur={(e) => commit(e.target.value)}
      // Grow with the text (up to the CSS max-height) so the first lines never scroll away.
      onInput={(e) => autosize(e.currentTarget)}
      onFocus={(e) => autosize(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit((e.target as HTMLTextAreaElement).value);
        e.stopPropagation();
      }}
      data-testid="prompt-editor"
    />
  );
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

/** Run with a split menu (ElevenLabs "Run ▾"): this node alone, from here downstream, or with upstream. */
function RunButton({ node }: { node: NodeRecord }) {
  const t = useT();
  const running = useRuns((s) => s.progress.has(node.id));
  const cost = creditsFor(node.kind, node.settings);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const more = useRef<HTMLButtonElement>(null);
  const scoped = (scope: 'node' | 'from_here' | 'with_upstream') => {
    setMenu(null);
    withCloud('run', { kind: 'run', nodeId: node.id, scope }, (id) =>
      useUi.setState({ dialog: { type: 'run', nodeId: id!, scope } }),
    );
  };
  return (
    <div className="run-split nodrag">
      <button
        type="button"
        className="run-main"
        onClick={() => onRunNode(node.id)}
        disabled={running}
        data-testid="run-node"
        aria-label={t('canvas.node.runCost', { credits: t('common.credits', { count: cost }) })}
        title={t('canvas.node.runCost', { credits: t('common.credits', { count: cost }) })}
      >
        {running ? t('canvas.node.running') : t('canvas.node.run')}
      </button>
      <button
        ref={more}
        type="button"
        className="run-more"
        aria-label={t('canvas.node.runOptions')}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        disabled={running}
        data-testid="run-options"
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {/* In screen space (not on the zoomed board): Escape, a click outside or focus leaving
          closes it, and it opens above the button when the bottom toolbar is in the way. */}
      {menu && (
        <Popover
          anchor={menu}
          align="end"
          trigger={more.current}
          onClose={() => setMenu(null)}
          label={t('canvas.node.runOptions')}
          testId="run-menu"
        >
          <div role="menu">
            <button type="button" role="menuitem" onClick={() => scoped('with_upstream')}>
              {t('canvas.node.runWithInputs')}
            </button>
            <button type="button" role="menuitem" onClick={() => scoped('node')}>
              {t('canvas.node.runNodeOnly')}
            </button>
            <button type="button" role="menuitem" onClick={() => scoped('from_here')}>
              {t('canvas.node.runDownstream')}
            </button>
          </div>
        </Popover>
      )}
    </div>
  );
}

/** Screen-reader names of the toolbar's selects, by setting. */
const SELECT_NAME = {
  builder: 'canvas.toolbar.builder',
  detail: 'canvas.toolbar.detail',
  look: 'canvas.toolbar.look',
  angles: 'canvas.toolbar.angles',
  size: 'canvas.toolbar.size',
  motion: 'canvas.toolbar.motion',
  aspect: 'canvas.toolbar.aspect',
  durationSec: 'canvas.toolbar.durationSec',
  environment: 'canvas.toolbar.environment',
  glbPreset: 'canvas.toolbar.glbPreset',
} as const satisfies Record<string, MessageKey>;
const BUILDER_NAME = {
  auto: 'canvas.toolbar.builderAuto',
  code: 'canvas.toolbar.builderCode',
  generative: 'canvas.toolbar.builderGenerative',
} as const satisfies Record<string, MessageKey>;
const DETAIL_NAME = {
  draft: 'canvas.toolbar.detailDraft',
  standard: 'canvas.toolbar.detailStandard',
  high: 'canvas.toolbar.detailHigh',
} as const satisfies Record<string, MessageKey>;

/** Settings and actions under the selected node (ElevenLabs node toolbar). */
function Toolbar({ node }: { node: NodeRecord }) {
  const t = useT();
  const set = (patch: Record<string, unknown>) =>
    dispatch([{ type: 'node.update', id: node.id, patch: { settings: patch } }]);
  const s = node.settings;
  const primary = useBoard((st) =>
    node.currentVersionId ? st.versions.get(node.currentVersionId)?.outputs[0] : undefined,
  );
  const [more, setMore] = useState<DOMRect | null>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const sel = (
    key: keyof typeof SELECT_NAME,
    options: readonly (string | number)[],
    label?: (v: string | number) => string,
  ) => (
    <select
      aria-label={t(SELECT_NAME[key])}
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
        {sel('builder', ['auto', 'code', 'generative'], (v) =>
          t(BUILDER_NAME[v as keyof typeof BUILDER_NAME]),
        )}
        {sel('detail', ['draft', 'standard', 'high'], (v) => t(DETAIL_NAME[v as keyof typeof DETAIL_NAME]))}
      </>
    );
  if (node.kind === 'stage')
    controls = sel(
      'look',
      LOOK_PRESETS.map((l) => l.id),
      (v) => t(`look.${v as (typeof LOOK_PRESETS)[number]['id']}`),
    );
  if (node.kind === 'packshot')
    controls = (
      <>
        {sel('angles', ['four', 'custom'], (v) =>
          v === 'four' ? t('canvas.toolbar.anglesFour') : t('canvas.toolbar.anglesCustom'),
        )}
        {sel('size', ['1k', '2k'])}
      </>
    );
  if (node.kind === 'adVideo')
    controls = (
      <>
        {sel(
          'motion',
          MOTION_PRESETS.map((m) => m.id),
          (v) => t(`motion.${v as (typeof MOTION_PRESETS)[number]['id']}`),
        )}
        {sel('aspect', ASPECTS)}
        {sel('durationSec', [6, 10, 15], (v) => t('canvas.toolbar.seconds', { seconds: v }))}
      </>
    );
  if (node.kind === 'simulation')
    controls = (
      <>
        {sel('environment', SIM_ENVIRONMENTS, (v) => t(`simEnv.${v as SimEnvironment}`))}
        <input
          className="tb-input"
          aria-label={t('canvas.toolbar.price')}
          defaultValue={String(s.price ?? '')}
          maxLength={24}
          onBlur={(e) => e.target.value !== s.price && set({ price: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </>
    );
  if (node.kind === 'export')
    controls = sel('glbPreset', Object.keys(GLB_PRESETS), (v) =>
      t(`glbPreset.${v as keyof typeof GLB_PRESETS}`),
    );
  const replace = ACCEPT[node.kind] && primary;
  const download = primary?.urls.original;
  return (
    <div className="node-foot nodrag" data-testid="node-toolbar">
      <div className="pill">
        {controls}
        {replace && (
          <label className="tb-btn">
            {t('canvas.toolbar.replace')}
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
            aria-label={t('canvas.toolbar.download')}
            title={t('canvas.toolbar.download')}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} aria-hidden />
          </a>
        )}
        <button
          type="button"
          className="tb-icon"
          aria-label={t('canvas.toolbar.deleteNode')}
          title={t('canvas.toolbar.delete')}
          onClick={() => deleteNodes([node.id])}
          data-testid="node-delete"
        >
          <Trash2 size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="tb-icon"
          ref={moreBtn}
          aria-label={t('canvas.toolbar.more')}
          aria-haspopup="menu"
          aria-expanded={!!more}
          onClick={(e) => setMore(more ? null : e.currentTarget.getBoundingClientRect())}
          data-testid="node-more"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </div>
      {more && (
        <Popover
          anchor={more}
          align="end"
          trigger={moreBtn.current}
          onClose={() => setMore(null)}
          label={t('canvas.toolbar.more')}
          testId="node-more-menu"
        >
          <div role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMore(null);
                duplicateNodes([node.id]);
              }}
            >
              <Copy size={14} aria-hidden /> {t('canvas.toolbar.duplicate')} <kbd>⌘D</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMore(null);
                copySelection();
              }}
            >
              <Copy size={14} aria-hidden /> {t('canvas.toolbar.copy')} <kbd>⌘C</kbd>
            </button>
            {NODE_DEFS[node.kind].runnable && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMore(null);
                  onRunNode(node.id);
                }}
              >
                <Play size={14} aria-hidden /> {t('canvas.node.runWithInputs')}
              </button>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}
