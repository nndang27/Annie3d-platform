import { NODE_KINDS, type NodeKind, topologicalOrder } from '@annie3d/contracts';
import { Button, cx, Menu, Select, useToast } from '@annie3d/ui';
import { ArrowDown, ArrowUp, Link2, Link2Off, Play, PlusSquare, Trash2 } from 'lucide-react';
import { useProjectContext } from '@/routes/project/context';
import { useRunStore } from '@/stores/runStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { PALETTE_KINDS as ADDABLE_KINDS, NODE_ICON } from './nodeMeta';

/** Accessible alternative to the canvas: same document, click/keyboard commands instead of dragging. */
export function WorkflowList({ readOnly }: { readOnly: boolean }) {
  const doc = useWorkflowStore((s) => s.history.present);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const store = useWorkflowStore;
  const toast = useToast();
  const ctx = useProjectContext();
  const ordered = topologicalOrder(doc);

  const move = (id: string, dir: -1 | 1) => {
    const idx = ordered.findIndex((n) => n.id === id);
    const other = ordered[idx + dir];
    if (!other) return;
    const a = doc.nodes.find((n) => n.id === id)!;
    store.getState().moveNode(id, { ...other.position });
    store.getState().moveNode(other.id, { ...a.position });
  };

  return (
    <div style={{ padding: '16px 20px 120px', maxWidth: 760 }} data-testid="workflow-list">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1 }}>
          Steps in execution order. Connect, reorder and run without dragging.
        </p>
        {!readOnly ? (
          <Menu
            label="Add step"
            items={ADDABLE_KINDS.map((k: NodeKind) => ({
              label: NODE_KINDS[k].title,
              onSelect: () =>
                store.getState().addNode(k, { x: (doc.nodes.at(-1)?.position.x ?? 0) + 380, y: 200 }),
            }))}
            trigger={(p) => (
              <button type="button" className="btn btn-secondary btn-sm" {...p}>
                <PlusSquare size={16} aria-hidden="true" /> Add step
              </button>
            )}
          />
        ) : null}
      </div>
      <ol className="step-list" aria-label="Workflow steps">
        {ordered.map((n, i) => {
          const spec = NODE_KINDS[n.kind];
          const Icon = NODE_ICON[n.kind];
          const selected = n.id === selectedNodeId;
          return (
            <li
              key={n.id}
              className={cx('step-item', selected && 'is-selected')}
              data-testid={`list-step-${n.id}`}
            >
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => store.getState().select(selected ? null : n.id)}
                  aria-pressed={selected}
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 600,
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  {n.title || spec.title}
                </button>
                <StepStatusLine nodeId={n.id} />
                {spec.inputs.length ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {spec.inputs.map((p) => {
                      const edge = doc.edges.find((e) => e.target === n.id && e.targetPort === p.id);
                      const candidates = doc.nodes.filter(
                        (m) => m.id !== n.id && NODE_KINDS[m.kind].output?.type === p.type,
                      );
                      return (
                        <label
                          key={p.id}
                          style={{
                            display: 'inline-flex',
                            gap: 6,
                            alignItems: 'center',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {p.label}
                            {p.required ? ' *' : ''} from
                          </span>
                          <Select
                            small
                            value={edge?.source ?? ''}
                            disabled={readOnly}
                            aria-label={`${p.label} input of ${n.title || spec.title}`}
                            onChange={(e) => {
                              if (edge) store.getState().disconnect(edge.id);
                              if (!e.target.value) return;
                              const src = doc.nodes.find((m) => m.id === e.target.value)!;
                              const out = NODE_KINDS[src.kind].output!;
                              const ok = store.getState().connect({
                                source: src.id,
                                sourcePort: out.id,
                                target: n.id,
                                targetPort: p.id,
                              });
                              if (!ok)
                                toast.push({
                                  message: store.getState().lastConnectionError ?? 'Invalid connection',
                                  tone: 'danger',
                                });
                            }}
                            style={{ width: 200 }}
                          >
                            <option value="">Not connected</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title || NODE_KINDS[c.kind].title}
                              </option>
                            ))}
                          </Select>
                          {edge ? (
                            <Link2 size={14} aria-hidden="true" style={{ color: 'var(--success)' }} />
                          ) : (
                            <Link2Off size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {!readOnly ? (
                  <>
                    <Button
                      variant="tertiary"
                      icon
                      size="sm"
                      aria-label={`Move ${n.title || spec.title} earlier`}
                      onClick={() => move(n.id, -1)}
                      disabledReason={i === 0 ? 'Already first.' : undefined}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="tertiary"
                      icon
                      size="sm"
                      aria-label={`Move ${n.title || spec.title} later`}
                      onClick={() => move(n.id, 1)}
                      disabledReason={i === ordered.length - 1 ? 'Already last.' : undefined}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </Button>
                  </>
                ) : null}
                {spec.executable ? (
                  <Button
                    variant="tertiary"
                    icon
                    size="sm"
                    aria-label={`Run only ${n.title || spec.title}`}
                    onClick={() => void ctx.startRun(n.id)}
                    disabledReason={
                      !ctx.canEdit ? 'Editors only.' : ctx.activeRun ? 'A run is already active.' : undefined
                    }
                  >
                    <Play size={16} aria-hidden="true" />
                  </Button>
                ) : null}
                {!readOnly ? (
                  <Button
                    variant="tertiary"
                    icon
                    size="sm"
                    aria-label={`Remove ${n.title || spec.title}`}
                    onClick={() => store.getState().removeNode(n.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepStatusLine({ nodeId }: { nodeId: string }) {
  const step = useRunStore((s) => s.steps[nodeId]);
  if (!step) return null;
  return (
    <div
      style={{
        fontSize: '0.8125rem',
        color: step.status === 'failed' ? 'var(--danger)' : 'var(--text-secondary)',
      }}
      aria-live="polite"
    >
      {step.status}
      {step.progress && step.status === 'running'
        ? ` · ${step.progress.done}/${step.progress.total} ${step.progress.unit}`
        : ''}
      {step.error ? ` · ${step.error}` : ''}
    </div>
  );
}
