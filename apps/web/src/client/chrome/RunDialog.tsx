import { NODE_DEFS } from '@annie3d/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api/client';
import { followRun } from '../lib/runSocket';
import { useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';

let stopFollowing: (() => void) | null = null;

/** Attach to a run (new, or already active after a reload) and stream its events. */
export function attachRun(runId: string, queryClient: ReturnType<typeof useQueryClient>) {
  stopFollowing?.();
  stopFollowing = followRun(runId, queryClient);
}

/**
 * F11: the cost is shown before anything is charged. Opens on every Run (node or Run all),
 * lists what will run and what is cached (free), and starts the run with an idempotency key.
 */
export function RunDialog() {
  const dialog = useUi((s) => s.dialog);
  const ref = useRef<HTMLDialogElement>(null);
  const open = dialog?.type === 'run';
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal modal-wide"
      aria-labelledby="run-title"
      onClose={() => useUi.getState().dialog?.type === 'run' && useUi.setState({ dialog: null })}
      data-testid="run-dialog"
    >
      {open && <RunBody nodeId={dialog.nodeId} scope={dialog.scope} />}
    </dialog>
  );
}

function RunBody({ nodeId, scope }: { nodeId: string | null; scope: string }) {
  const boardId = useBoard((s) => s.boardId)!;
  const nodes = useBoard((s) => s.graph.nodes);
  const queryClient = useQueryClient();
  const [key] = useState(() => crypto.randomUUID());
  const [starting, setStarting] = useState(false);
  const est = useQuery({
    queryKey: ['estimate', boardId, nodeId, scope, useBoard.getState().seq],
    queryFn: () => api.estimate(boardId, nodeId, scope),
    staleTime: 0,
  });
  const close = () => useUi.setState({ dialog: null });
  const start = async () => {
    setStarting(true);
    try {
      const run = await api.startRun(boardId, { idempotencyKey: key, nodeId, scope });
      attachRun(run.id, queryClient);
      close();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'insufficient_credits') {
        useUi.setState({ dialog: { type: 'billing' } });
      } else if (e instanceof ApiError && e.code === 'conflict' && (e.details as { runId?: string })?.runId) {
        attachRun((e.details as { runId: string }).runId, queryClient);
        toast('A run is already in progress on this board', 'error');
        close();
      } else {
        toast((e as Error).message, 'error');
        setStarting(false);
      }
    }
  };
  if (est.isLoading) return <p className="muted">Checking cost…</p>;
  if (est.error || !est.data)
    return <p className="muted">Could not estimate this run. {(est.error as Error)?.message}</p>;
  const runnable = est.data.plan.filter((p) => NODE_DEFS[p.kind].runnable);
  const steps = runnable.filter((p) => !p.cached);
  const cached = runnable.length - steps.length;
  const total = est.data.totalCredits;
  const enough = est.data.balance >= total;
  if (!steps.length) {
    return (
      <>
        <h2 id="run-title">Everything is up to date</h2>
        <p className="muted">
          {cached} {cached === 1 ? 'node already has' : 'nodes already have'} results for their current
          inputs. Change a prompt, setting or input to run again.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={close} data-testid="run-close">
            OK
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 id="run-title">
        {steps.length === 1
          ? `Run ${label(nodes.get(steps[0]!.nodeId)?.label, steps[0]!.kind)}`
          : `Run ${steps.length} nodes`}
      </h2>
      <ul className="run-plan" data-testid="run-plan">
        {steps.map((p) => (
          <li key={p.nodeId}>
            <span>{label(nodes.get(p.nodeId)?.label, p.kind)}</span>
            <span className="muted">{p.credits} cr</span>
          </li>
        ))}
        {cached > 0 && (
          <li className="muted" data-testid="run-cached">
            <span>
              {cached} unchanged {cached === 1 ? 'node' : 'nodes'} reuse their results
            </span>
            <span>free</span>
          </li>
        )}
      </ul>
      <p className="run-total">
        <span>Total</span>
        <b data-testid="run-total">{total} credits</b>
      </p>
      <p className="muted">
        Balance {est.data.balance} cr{est.data.freeRunAvailable ? ' · your first run is free' : ''}. Failed
        steps are refunded.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={close}>
          Cancel
        </button>
        {enough ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void start()}
            disabled={starting}
            data-testid="run-confirm"
          >
            {starting ? 'Starting…' : `Run · ${total} cr`}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => useUi.setState({ dialog: { type: 'billing' } })}
            data-testid="get-credits"
          >
            Get credits
          </button>
        )}
      </div>
    </>
  );
}

function label(l: string | null | undefined, kind: keyof typeof NODE_DEFS) {
  return l ?? NODE_DEFS[kind].label;
}
