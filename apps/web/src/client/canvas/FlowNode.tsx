import {
  ASPECTS,
  creditsFor,
  GLB_PRESETS,
  LOOK_PRESETS,
  MOTION_PRESETS,
  NODE_DEFS,
  type NodeKind,
  type NodeRecord,
  PORT_COLOR,
  type PortType,
} from '@annie3d/contracts';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { pickImage } from '../lib/media';
import { dispatch, useBoard } from '../store/board';
import { useRuns } from '../store/runs';
import { useUi } from '../store/ui';
import { onRunNode, openEditor, uploadIntoNode } from './actions';

const PROMPT_KEY: Partial<Record<NodeKind, string>> = {
  model3d: 'prompt',
  stage: 'prompt',
  adVideo: 'prompt',
  text: 'text',
  note: 'text',
};
const PORT_TOP = 58;
const PORT_GAP = 24;

/**
 * Images carry no loading="lazy": React Flow culling already keeps off-screen nodes out of the
 * DOM, and lazy on in-viewport previews delayed LCP (Lighthouse lcp-lazy-loaded, 2026-09-24).
 *
 * One canvas node. Memoised (React Flow perf guide) and subscribed only to its own record,
 * version, stale flag and run progress, so a change elsewhere never re-renders it
 * (react-best-practices: rerender-memo, rerender-derived-state).
 */
export const FlowNode = memo(function FlowNode({ id, selected }: NodeProps) {
  const node = useBoard((s) => s.graph.nodes.get(id));
  const lod = useUi((s) => s.lod);
  if (!node) return null;
  const def = NODE_DEFS[node.kind];
  return (
    <div className={`node lod-${lod}`} data-testid={`node-${node.kind}`} data-node-id={id}>
      <Ports node={node} />
      <Header node={node} />
      <Preview node={node} selected={!!selected} />
      {(PROMPT_KEY[node.kind] || def.runnable) && (
        <div className="node-body">
          {PROMPT_KEY[node.kind] ? <Prompt node={node} /> : <div style={{ flex: 1 }} />}
          {def.runnable && <RunButton node={node} />}
        </div>
      )}
      {lod === 'full' && def.runnable && <Footer node={node} />}
    </div>
  );
});

function Ports({ node }: { node: NodeRecord }) {
  const def = NODE_DEFS[node.kind];
  return (
    <>
      {def.inputs.map((p, i) => (
        <span key={p.id}>
          <Handle
            id={p.id}
            type="target"
            position={Position.Left}
            style={{ top: PORT_TOP + i * PORT_GAP, background: PORT_COLOR[p.accepts[0] as PortType] }}
            title={`${p.label} (${p.accepts.join(' or ')})`}
          />
          <span
            className="port-label"
            style={{ top: PORT_TOP + i * PORT_GAP - 7, right: 'calc(100% + 10px)' }}
          >
            {p.label}
          </span>
        </span>
      ))}
      {def.output && (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          style={{ top: PORT_TOP, background: PORT_COLOR[def.output.type] }}
          title={`${def.output.label} (${def.output.type})`}
        />
      )}
    </>
  );
}

function Header({ node }: { node: NodeRecord }) {
  const def = NODE_DEFS[node.kind];
  const version = useBoard((s) =>
    node.currentVersionId ? s.versions.get(node.currentVersionId) : undefined,
  );
  const stale = useBoard((s) => s.stale.has(node.id));
  return (
    <div className="node-head">
      <span className="label">{node.label ?? def.label}</span>
      {stale && (
        <span className="badge-stale" title="Inputs changed since this version">
          stale
        </span>
      )}
      {def.runnable && version ? (
        <span className="ver">v{version.versionNo}</span>
      ) : (
        <span>{def.engine}</span>
      )}
    </div>
  );
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
  const outputs = version?.outputs ?? [];
  const primary = outputs[0];
  const kind = node.kind;

  const onEnter = useCallback(() => {
    if (primary?.urls.turntable || primary?.kind === 'video') useUi.setState({ playingNodeId: node.id });
  }, [primary, node.id]);
  const onLeave = useCallback(() => {
    if (useUi.getState().playingNodeId === node.id) useUi.setState({ playingNodeId: null });
  }, [node.id]);

  if (kind === 'text' || kind === 'note') return null;
  const isInput = kind === 'photo' || kind === 'upload3d' || kind === 'audio';
  if (isInput && !primary) {
    const accept =
      kind === 'photo'
        ? 'image/png,image/jpeg,image/webp'
        : kind === 'audio'
          ? 'audio/*'
          : '.glb,model/gltf-binary';
    return (
      <label
        className={`node-preview drop-slot nodrag${dragOver ? ' dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void uploadIntoNode(node, f);
        }}
        data-testid="drop-slot"
      >
        <span>
          {kind === 'photo'
            ? 'Drop your product photo'
            : kind === 'audio'
              ? 'Drop a music file'
              : 'Drop a .glb file'}
        </span>
        <input
          type="file"
          accept={accept}
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
    <span>{progress ? progress.stage : NODE_DEFS[kind].runnable ? 'Not run yet' : ''}</span>
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
          <img key={o.id} src={pickImage(o, 150, zoom) ?? ''} alt="" decoding="async" draggable={false} />
        ))}
      </div>
    );
  } else if (kind === 'audio' && primary) {
    content = (
      // biome-ignore lint/a11y/useMediaCaption: instrumental music bed with no speech to caption.
      <audio
        className="nodrag"
        controls
        preload="none"
        src={primary.urls.original ?? undefined}
        style={{ width: '90%' }}
      />
    );
  } else if (primary) {
    const poster = pickImage(primary, 280, zoom);
    const video = primary.kind === 'video' ? primary.urls.original : primary.urls.turntable;
    // Only the hovered node mounts a <video>; everything else is a poster (one video at a time).
    content =
      playing && video ? (
        <video src={video} poster={poster ?? undefined} autoPlay muted loop playsInline preload="none" />
      ) : poster ? (
        <img src={poster} alt={node.label ?? NODE_DEFS[kind].label} decoding="async" draggable={false} />
      ) : (
        <span>{primary.kind === 'model3d' ? '3D model' : primary.mime}</span>
      );
  }
  const contain = kind === 'adVideo' || kind === 'packshot';
  return (
    <div
      className={`node-preview${contain ? ' contain' : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      data-testid="node-preview"
    >
      {content}
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
          className="open3d nodrag"
          onClick={() => openEditor(node.id)}
          data-testid="open-3d"
          tabIndex={selected ? 0 : -1}
        >
          Open 3D ⤢
        </button>
      )}
    </div>
  );
}

/**
 * View mode renders plain text; the textarea exists only while editing
 * (Miro: a widget is live DOM only while edited, otherwise a static rendering).
 */
function Prompt({ node }: { node: NodeRecord }) {
  const key = PROMPT_KEY[node.kind]!;
  const value = String(node.settings[key] ?? '');
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const commit = (v: string) => {
    setEditing(false);
    if (v !== value) dispatch([{ type: 'node.update', id: node.id, patch: { settings: { [key]: v } } }]);
  };
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
        {value || (node.kind === 'text' ? 'Write text…' : 'Describe what you want…')}
      </div>
    );
  }
  return (
    <textarea
      ref={ref}
      className="prompt nodrag nowheel"
      defaultValue={value}
      maxLength={node.kind === 'text' || node.kind === 'note' ? 4000 : 2000}
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

function RunButton({ node }: { node: NodeRecord }) {
  const running = useRuns((s) => s.progress.has(node.id));
  const cost = creditsFor(node.kind, node.settings);
  return (
    <button
      type="button"
      className="run-btn nodrag"
      onClick={() => onRunNode(node.id)}
      disabled={running}
      data-testid="run-node"
    >
      {running ? 'Running…' : `Run · ${cost} cr`}
    </button>
  );
}

function Footer({ node }: { node: NodeRecord }) {
  const set = (patch: Record<string, unknown>) =>
    dispatch([{ type: 'node.update', id: node.id, patch: { settings: patch } }]);
  const s = node.settings;
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
  return (
    <div className="node-foot nodrag">
      <div className="pill">{controls}</div>
    </div>
  );
}
