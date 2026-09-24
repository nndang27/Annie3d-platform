import { NODE_KINDS } from '@annie3d/contracts';
import { Button, Field, Input, Select } from '@annie3d/ui';
import { Play, Trash2, X } from 'lucide-react';
import { useProjectContext } from '@/routes/project/context';
import { useRunStore } from '@/stores/runStore';
import { useWorkflowStore } from '@/stores/workflowStore';

/** Progressive disclosure: settings appear only for the selected step. */
export function NodeInspector({ readOnly }: { readOnly: boolean }) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const node = useWorkflowStore((s) => s.history.present.nodes.find((n) => n.id === s.selectedNodeId));
  const edges = useWorkflowStore((s) => s.history.present.edges);
  const step = useRunStore((s) => (selectedNodeId ? s.steps[selectedNodeId] : undefined));
  const store = useWorkflowStore;
  const ctx = useProjectContext();
  if (!node) return null;
  const spec = NODE_KINDS[node.kind];
  const inputs = spec.inputs.map((p) => ({
    port: p,
    edge: edges.find((e) => e.target === node.id && e.targetPort === p.id),
  }));
  const art = ctx.latestArtifactFor(node.id);
  return (
    <aside
      className="inspector"
      aria-label={`Settings for ${node.title || spec.title}`}
      data-testid="node-inspector"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>{node.title || spec.title}</strong>
        <Button
          variant="tertiary"
          icon
          size="sm"
          aria-label="Close inspector"
          onClick={() => store.getState().select(null)}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>{spec.description}</p>
      {step ? (
        <div className="banner" role="status">
          <div className="banner-body">
            <div className="banner-title">Last run: {step.status}</div>
            {step.progress ? (
              <div className="numeric">
                {step.progress.done}/{step.progress.total} {step.progress.unit}
              </div>
            ) : null}
            {step.error ? <div style={{ color: 'var(--danger)' }}>{step.error}</div> : null}
          </div>
        </div>
      ) : null}
      <Field label="Prompt" help={spec.placeholder}>
        {({ id, describedBy }) => (
          <textarea
            id={id}
            className="textarea"
            value={String(node.settings.prompt ?? '')}
            onChange={(e) => store.getState().updateSettings(node.id, { prompt: e.target.value })}
            aria-describedby={describedBy}
            disabled={readOnly}
            rows={3}
            style={{ minHeight: 72 }}
          />
        )}
      </Field>
      {spec.settings.map((f) => (
        <Field key={f.key} label={f.label}>
          {({ id }) => (
            <Select
              id={id}
              small
              value={String(node.settings[f.key] ?? f.default)}
              onChange={(e) => store.getState().updateSettings(node.id, { [f.key]: e.target.value })}
              disabled={readOnly}
            >
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ))}
      <Field label="Step title" help={`Default: ${spec.title}`}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            small
            value={node.title}
            placeholder={spec.title}
            onChange={(e) => store.getState().renameNode(node.id, e.target.value)}
            aria-describedby={describedBy}
            disabled={readOnly}
          />
        )}
      </Field>
      {inputs.length ? (
        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>
            Inputs
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
            {inputs.map(({ port, edge }) => (
              <li key={port.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{port.label}</span>
                <span style={{ color: edge ? 'var(--success)' : 'var(--warning)' }}>
                  {edge ? 'connected' : 'missing'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {node.kind === 'export' ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Produces the editable scene JSON. Video and image exports are queued from the Studio tab.
        </p>
      ) : null}
      {art ? (
        <div>
          <div className="field-label">Latest output</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {art.title} · {art.provenance.note}
          </div>
          {art.kind !== 'export' && art.kind !== 'reference-image' ? (
            <Button size="sm" style={{ marginTop: 6 }} onClick={ctx.openStudio}>
              Open in Studio
            </Button>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
        {spec.executable ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void ctx.startRun(node.id)}
            disabledReason={
              !ctx.canEdit ? 'Editors only.' : ctx.activeRun ? 'A run is already active.' : undefined
            }
          >
            <Play size={14} aria-hidden="true" /> Run this step
          </Button>
        ) : null}
        {!readOnly ? (
          <Button size="sm" variant="destructive" onClick={() => store.getState().removeNode(node.id)}>
            <Trash2 size={14} aria-hidden="true" /> Remove step
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
