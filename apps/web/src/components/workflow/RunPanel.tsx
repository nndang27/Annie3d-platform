import { isTerminal, type Run, type RunEvent } from '@3dads/contracts';
import { Badge, Button, formatRelative } from '@3dads/ui';
import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useState } from 'react';
import { RunStatusBadge } from '@/components/RunStatusBadge';
import { useProjectContext } from '@/routes/project/context';
import { useServices } from '@/services/context';
import { useInvalidate, useRuns } from '@/services/queries';
import { useUiStore } from '@/stores/uiStore';

export function RunPanel({
  run,
  events,
  connection,
}: {
  run: Run | null;
  events: RunEvent[];
  connection: string;
}) {
  const ctx = useProjectContext();
  const services = useServices();
  const inv = useInvalidate();
  const runs = useRuns(ctx.project.id);
  const setSelectedRunId = useUiStore((s) => s.setSelectedRunId);
  const [busy, setBusy] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  const act = async (name: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(name);
    try {
      await fn();
      inv.runs(ctx.project.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14, fontSize: '0.875rem' }} data-testid="run-panel">
      {run ? (
        <div className="card card-pad" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <RunStatusBadge status={run.status} />
            <span className="mono">{run.id}</span>
            {connection !== 'live' && !isTerminal(run.status) ? (
              <Badge tone="warning">{connection}</Badge>
            ) : null}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
              {formatRelative(run.createdAt)}
            </span>
          </div>
          {run.retryOf ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              Retry of {run.retryOf}; successful steps were reused.
            </div>
          ) : null}
          <ol
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
            aria-label="Run steps"
          >
            {run.steps.map((s) => (
              <li
                key={s.nodeId}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}
              >
                <span>
                  {s.title}
                  {s.error ? (
                    <span style={{ display: 'block', color: 'var(--danger)' }}>{s.error}</span>
                  ) : null}
                </span>
                <span className="numeric" style={{ color: 'var(--text-secondary)' }}>
                  {s.status === 'running' && s.progress
                    ? `${s.progress.done}/${s.progress.total} ${s.progress.unit}`
                    : s.status}
                </span>
                {s.status === 'running' && s.progress ? (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      height: 4,
                      background: 'var(--bg-subtle)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={s.progress.total}
                    aria-valuenow={s.progress.done}
                    aria-label={`${s.title} progress`}
                  >
                    <div
                      style={{
                        width: `${(100 * s.progress.done) / s.progress.total}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        transition: 'width 120ms linear',
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {run.status === 'waiting_input' && run.inputRequest ? (
            <div className="banner banner-warning" role="alert" style={{ display: 'grid', gap: 8 }}>
              <div>
                <strong>Needs your input:</strong> {run.inputRequest.question}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="select select-sm"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  aria-label="Answer"
                  style={{ width: 180 }}
                >
                  <option value="">Choose…</option>
                  {run.inputRequest.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="primary"
                  loading={busy === 'answer'}
                  disabledReason={answer ? undefined : 'Choose an option first.'}
                  onClick={() => void act('answer', () => services.runs.answerInput(run.id, answer))}
                  data-testid="answer-input"
                >
                  Answer and resume
                </Button>
              </div>
            </div>
          ) : null}
          {run.error ? (
            <div className="banner banner-danger" role="alert">
              <div className="banner-body">
                <div className="banner-title">{run.error}</div>
                <div>
                  Outputs from finished steps are kept. Retry runs only the failed step and those after it.
                </div>
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!isTerminal(run.status) && run.status !== 'cancelling' ? (
              <Button
                size="sm"
                loading={busy === 'cancel'}
                onClick={() => void act('cancel', () => ctx.cancelRun())}
                disabledReason={ctx.canEdit ? undefined : 'Editors only.'}
                data-testid="cancel-run"
              >
                <Square size={14} aria-hidden="true" /> Stop run
              </Button>
            ) : null}
            {run.status === 'running' ? (
              <Button
                size="sm"
                loading={busy === 'pause'}
                onClick={() => void act('pause', () => services.runs.pause(run.id))}
                disabledReason={ctx.canEdit ? undefined : 'Editors only.'}
              >
                <Pause size={14} aria-hidden="true" /> Pause
              </Button>
            ) : null}
            {run.status === 'paused' ? (
              <Button
                size="sm"
                variant="primary"
                loading={busy === 'resume'}
                onClick={() => void act('resume', () => services.runs.resume(run.id))}
              >
                <Play size={14} aria-hidden="true" /> Resume
              </Button>
            ) : null}
            {run.status === 'failed' || run.status === 'cancelled' ? (
              <Button
                size="sm"
                variant="primary"
                loading={busy === 'retry'}
                onClick={() => void act('retry', () => ctx.retryRun(run.id))}
                disabledReason={ctx.canEdit ? undefined : 'Editors only.'}
                data-testid="retry-run"
              >
                <RotateCcw size={14} aria-hidden="true" />{' '}
                {run.status === 'failed' ? 'Retry failed step' : 'Run again'}
              </Button>
            ) : null}
            {run.status === 'completed' ? (
              <Button size="sm" variant="primary" onClick={ctx.openStudio}>
                Review output
              </Button>
            ) : null}
          </div>
          <details className="disclosure">
            <summary>Activity ({events.length} recent events)</summary>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                maxHeight: 180,
                overflow: 'auto',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
              aria-live="off"
            >
              {events
                .slice(-40)
                .reverse()
                .map((e) => (
                  <li key={e.seq} style={{ display: 'flex', gap: 8 }}>
                    <span className="mono" style={{ width: 36 }}>
                      #{e.seq}
                    </span>
                    <span>{describeEvent(e)}</span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      ) : (
        <div className="empty" style={{ padding: 20 }}>
          <div className="empty-title">No run selected</div>
          <div>Press Run to execute the workflow. Runs continue on the server if you navigate away.</div>
        </div>
      )}
      <div>
        <div className="field-label" style={{ marginBottom: 6 }}>
          History
        </div>
        {runs.data?.length ? (
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}
            data-testid="run-history"
          >
            {runs.data.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="menu-item"
                  aria-current={run?.id === r.id ? 'true' : undefined}
                  onClick={() => setSelectedRunId(r.id)}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: run?.id === r.id ? 'var(--bg-subtle)' : undefined,
                  }}
                >
                  <RunStatusBadge status={r.status} />
                  <span style={{ flex: 1 }} className="numeric">
                    {r.steps.filter((s) => s.status === 'completed').length}/{r.steps.length} steps ·{' '}
                    {r.creditsCharged} cr
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatRelative(r.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No runs yet.</p>
        )}
      </div>
    </div>
  );
}

function describeEvent(e: RunEvent): string {
  const p = e.payload as Record<string, string | number>;
  switch (e.type) {
    case 'run.accepted':
      return `Accepted (${p.steps} steps, ${p.credits} credits reserved)`;
    case 'step.started':
      return `Started ${p.title}`;
    case 'step.progress':
      return `${p.nodeId}: ${p.done}/${p.total} ${p.unit}`;
    case 'step.completed':
      return `Completed ${p.nodeId}`;
    case 'artifact.created':
      return `Output ${p.title}`;
    case 'step.failed':
      return `Failed ${p.nodeId}: ${p.error}`;
    case 'run.waiting_input':
      return `Waiting for input: ${p.question}`;
    default:
      return e.type;
  }
}
