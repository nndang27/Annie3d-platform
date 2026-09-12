import { NODE_KINDS, type WorkflowNode } from '@3dads/contracts';
import { Badge, cx } from '@3dads/ui';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { ChevronDown, Loader2, Play, Zap } from 'lucide-react';
import { type KeyboardEvent, memo, useEffect, useRef } from 'react';
import { FixtureThumb } from '@/components/FixtureThumb';
import { useProjectContext } from '@/routes/project/context';
import { useBlobUrl } from '@/services/queries';
import { useRunStore } from '@/stores/runStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { NodeFooter } from './NodeFooter';
import { NODE_ICON, PORT_ICON } from './nodeMeta';

function statusBadge(
  status?: string,
): { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'; label: string; pulse?: boolean } | null {
  switch (status) {
    case 'running':
      return { tone: 'accent', label: 'Running', pulse: true };
    case 'completed':
      return { tone: 'success', label: 'Done' };
    case 'failed':
      return { tone: 'danger', label: 'Failed' };
    case 'cancelled':
      return { tone: 'neutral', label: 'Cancelled' };
    case 'skipped':
      return { tone: 'neutral', label: 'Reused' };
    case 'pending':
      return { tone: 'neutral', label: 'Queued' };
    default:
      return null;
  }
}

/**
 * Flows-style node: header (type · engine), output preview, prompt row with Run, input ports on the
 * left, one output port on the right, floating footer when selected.
 */
export const FlowNode = memo(function FlowNode({ id, selected }: NodeProps) {
  const node = useWorkflowStore((s) => s.history.present.nodes.find((n) => n.id === id));
  // Stable primitive selector (a fresh array each render would loop React with zustand v5).
  const connectedKey = useWorkflowStore((s) =>
    s.history.present.edges
      .filter((e) => e.target === id)
      .map((e) => e.targetPort)
      .join(','),
  );
  const connectedPorts = connectedKey ? connectedKey.split(',') : [];
  const step = useRunStore((s) => s.steps[id]);
  const ctx = useProjectContext();
  if (!node) return null;
  const spec = NODE_KINDS[node.kind];
  const Icon = NODE_ICON[node.kind];
  const badge = statusBadge(step?.status);
  const isComment = node.kind === 'comment';
  const inputs = spec.inputs;
  const rowGap = 26;
  const firstTop = 52;
  const runnable = spec.executable && ctx.canEdit && !ctx.activeRun;
  const runReason = !spec.executable
    ? 'This node is an input; it does not run.'
    : !ctx.canEdit
      ? 'Editors only.'
      : ctx.activeRun
        ? 'A run is already active.'
        : undefined;

  return (
    <div
      className={cx('flow-node', selected && 'is-selected', isComment && 'is-comment')}
      data-testid={`node-${node.id}`}
      data-kind={node.kind}
      style={inputs.length > 4 ? { minHeight: firstTop + inputs.length * rowGap + 10 } : undefined}
    >
      {inputs.map((p, i) => {
        const PIcon = PORT_ICON[p.type];
        const connected = connectedPorts.includes(p.id);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            className={cx(`port-${p.type}`, !p.required && 'port-optional', connected && 'port-connected')}
            style={{ top: firstTop + i * rowGap }}
            aria-label={`${p.label} input${p.required ? ' (required)' : ''}`}
            title={`${p.label} · ${p.type}${p.required ? ' · required' : ''}`}
            data-testid={`port-in-${p.id}`}
          >
            <PIcon size={11} aria-hidden="true" />
            <span className="port-label" style={{ top: 3 }}>
              {p.label}
              {p.required ? ' *' : ''}
            </span>
          </Handle>
        );
      })}
      {spec.output ? (
        <Handle
          id={spec.output.id}
          type="source"
          position={Position.Right}
          className={`port-${spec.output.type}`}
          style={{ top: firstTop }}
          aria-label={`${spec.output.label} output`}
          title={`${spec.output.label} · ${spec.output.type}`}
          data-testid={`port-out-${spec.output.id}`}
        >
          {(() => {
            const OIcon = PORT_ICON[spec.output!.type];
            return <OIcon size={11} aria-hidden="true" />;
          })()}
        </Handle>
      ) : null}
      <div className="flow-head node-head">
        <Icon size={14} aria-hidden="true" />
        <span className="flow-title">{node.title || spec.title}</span>
        {badge ? (
          <Badge tone={badge.tone} pulse={badge.pulse}>
            {badge.label}
          </Badge>
        ) : null}
        <span className="flow-engine">{String(node.settings.engine ?? spec.engine)}</span>
      </div>
      {!isComment ? (
        <NodePreview
          node={node}
          progress={step?.status === 'running' ? step.progress : undefined}
          error={step?.status === 'failed' ? step.error : undefined}
        />
      ) : null}
      <PromptRow node={node} runnable={runnable} runReason={runReason} isComment={isComment} />
      {selected ? <NodeFooter node={node} /> : null}
    </div>
  );
});

function PromptRow({
  node,
  runnable,
  runReason,
  isComment,
}: {
  node: WorkflowNode;
  runnable: boolean;
  runReason?: string;
  isComment: boolean;
}) {
  const store = useWorkflowStore;
  const ctx = useProjectContext();
  const spec = NODE_KINDS[node.kind];
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = String(node.settings.prompt ?? '');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }, [value]);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && runnable) {
      e.preventDefault();
      void ctx.startRun(node.id).catch(() => {});
    }
    e.stopPropagation(); // keep Backspace/Delete from deleting the node while typing
  };
  return (
    <div className="flow-prompt nodrag nowheel">
      <textarea
        ref={ref}
        className="nodrag"
        value={value}
        placeholder={spec.placeholder}
        aria-label={`${node.title || spec.title} prompt`}
        rows={1}
        disabled={!ctx.canEdit}
        onChange={(e) => store.getState().updateSettings(node.id, { prompt: e.target.value })}
        onKeyDown={onKey}
        data-testid={`prompt-${node.id}`}
      />
      {!isComment && spec.executable ? (
        <span className="flow-run-split">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void ctx.startRun(node.id).catch(() => {})}
            aria-disabled={!runnable || undefined}
            title={runReason}
            data-testid={`run-${node.id}`}
          >
            {ctx.activeRun ? <Loader2 size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}{' '}
            Run
          </button>
          <button
            type="button"
            className="btn btn-primary"
            aria-label="Run options"
            onClick={() => void ctx.startRun().catch(() => {})}
            aria-disabled={!runnable || undefined}
            title={runReason ?? 'Run the whole workflow'}
          >
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </div>
  );
}

function NodePreview({
  node,
  progress,
  error,
}: {
  node: WorkflowNode;
  progress?: { done: number; total: number; unit: string };
  error?: string;
}) {
  const { project, latestArtifactFor } = useProjectContext();
  const art = latestArtifactFor(node.id);
  const upload = useBlobUrl(
    node.kind === 'reference' && project.reference.source === 'upload'
      ? project.reference.uploadBlobKey
      : undefined,
  );
  const artImage = useBlobUrl(art?.preview.kind === 'image' ? art.preview.blobKey : undefined);
  if (node.kind === 'reference') {
    return (
      <div className="flow-preview">
        {project.reference.source === 'upload' ? (
          upload.data ? (
            <img src={upload.data} alt={`Reference: ${project.reference.uploadName}`} />
          ) : (
            <span>Loading reference…</span>
          )
        ) : (
          <FixtureThumb
            fixtureId={project.reference.fixtureId}
            alt={`Catalog fixture ${project.reference.fixtureId}`}
          />
        )}
        <span className="badge flow-badge">
          {project.reference.source === 'upload' ? 'Your image' : 'Catalog fixture'}
        </span>
      </div>
    );
  }
  if (node.kind === 'brief') {
    return (
      <div className="flow-preview is-text">
        <div>
          <strong>{project.brief.keyMessage}</strong>
          <div style={{ color: 'var(--text-secondary)' }}>{project.brief.goal}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {project.brief.aspects.join(' · ')} · {project.brief.tone}
          </div>
        </div>
      </div>
    );
  }
  if (node.kind === 'text') {
    return (
      <div className="flow-preview is-text">
        {String(node.settings.prompt ?? '') || <span style={{ color: 'var(--text-muted)' }}>Empty text</span>}
      </div>
    );
  }
  if (node.kind === 'review') {
    return (
      <div className="flow-preview">
        <div className="flow-placeholder">
          <span>Review and accept outputs in the Outputs tab.</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flow-preview" style={{ color: 'var(--danger)' }}>
        <div className="flow-placeholder">
          <span>{error}</span>
        </div>
      </div>
    );
  }
  if (progress) {
    return (
      <div className="flow-preview" aria-live="polite">
        <div className="flow-placeholder">
          <Loader2 size={20} aria-hidden="true" />
          <span className="numeric">
            {progress.done}/{progress.total} {progress.unit}
          </span>
        </div>
        <div
          className="flow-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div style={{ width: `${(100 * progress.done) / progress.total}%` }} />
        </div>
      </div>
    );
  }
  if (art) {
    return (
      <div className="flow-preview">
        {art.preview.kind === 'fixture' ? (
          <FixtureThumb fixtureId={art.preview.fixtureId as 'serum-bottle'} alt={art.title} />
        ) : art.preview.kind === 'image' && artImage.data ? (
          <img src={artImage.data} alt={art.title} />
        ) : (
          <div className="flow-placeholder">
            <span>{art.title}</span>
            <span style={{ fontSize: '0.75rem' }}>{art.mime ?? art.kind}</span>
          </div>
        )}
        <span className="badge flow-badge">
          v{art.revision} · {art.provenance.source === 'engine-demo' ? 'demo output' : art.provenance.source}
        </span>
      </div>
    );
  }
  return (
    <div className="flow-preview">
      <div className="flow-placeholder">
        <Zap size={18} aria-hidden="true" />
        <span>Your generation will appear here</span>
      </div>
    </div>
  );
}
