import { downstreamOf, NODE_DEFS, type RunEvent } from '@annie3d/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { applyRemote, setStale, upsertVersions, useBoard } from '../store/board';
import { setError, setProgress, useRuns } from '../store/runs';
import { toast } from '../store/ui';
import { perfEnd } from './perf';

/**
 * Follows one run over its WebSocket. On a drop it reconnects with `?after=<last seq>` and
 * backs off exponentially (Figma/Linear: reconnect = resume from the last applied sequence),
 * so no event is applied twice and none is missed.
 */
export function followRun(runId: string, queryClient: QueryClient) {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let lastSeq = 0;
  useRuns.setState({ activeRunId: runId, lastSeq: 0 });

  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/api/runs/${runId}/events?after=${lastSeq}`);
    socket.onopen = () => {
      attempt = 0;
    };
    socket.onmessage = (m) => {
      const e = JSON.parse(String(m.data)) as RunEvent;
      if (e.seq <= lastSeq) return;
      lastSeq = e.seq;
      useRuns.setState({ lastSeq });
      apply(e, queryClient);
      if (e.type === 'run.finished') stop();
    };
    socket.onclose = () => {
      if (closed) return;
      attempt++;
      setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt));
    };
  };
  const stop = () => {
    closed = true;
    socket?.close();
  };
  connect();
  return stop;
}

function apply(e: RunEvent, queryClient: QueryClient) {
  switch (e.type) {
    case 'run.queued':
      perfEnd('run.start');
      useRuns.setState({ plan: new Set(e.plan) });
      for (const id of e.plan) {
        setError(id, null);
        setProgress(id, { runId: e.runId, progress: 0, stage: 'Queued' });
      }
      return;
    case 'step.started':
      setProgress(e.nodeId, { runId: e.runId, progress: 0.02, stage: 'Starting' });
      return;
    case 'step.progress':
      setProgress(e.nodeId, { runId: e.runId, progress: e.progress, stage: e.stage });
      return;
    case 'step.succeeded': {
      upsertVersions([e.version]);
      applyRemote(
        [{ type: 'node.update', id: e.nodeId, patch: { currentVersionId: e.versionId } }],
        e.boardSeq,
      );
      setProgress(e.nodeId, null);
      // The node is fresh; downstream nodes outside this run now have changed inputs.
      const plan = useRuns.getState().plan;
      const g = useBoard.getState().graph;
      setStale((prev) => {
        const next = new Set(prev);
        next.delete(e.nodeId);
        for (const d of downstreamOf(g, e.nodeId)) {
          const n = g.nodes.get(d);
          if (n && NODE_DEFS[n.kind].runnable && n.currentVersionId && !plan.has(d)) next.add(d);
        }
        return next;
      });
      return;
    }
    case 'step.failed':
      setProgress(e.nodeId, null);
      setError(e.nodeId, { code: e.code, message: e.message, gate: e.gate });
      return;
    case 'step.skipped':
      setProgress(e.nodeId, null);
      return;
    case 'run.finished': {
      perfEnd('run.total', e.status);
      for (const [id, p] of useRuns.getState().progress) if (p.runId === e.runId) setProgress(id, null);
      useRuns.setState({
        activeRunId: null,
        plan: new Set(),
        ...(e.status === 'succeeded' || e.status === 'partial' ? { lastFinishedRunId: e.runId } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      const msg = {
        succeeded: `Run finished: ${e.chargedCredits} credits used`,
        partial: `Run finished with errors: ${e.chargedCredits} credits used`,
        failed: 'Run failed. Credits refunded.',
        cancelled: `Run cancelled: ${e.chargedCredits} credits used`,
      }[e.status];
      toast(msg, e.status === 'succeeded' ? 'info' : 'error');
      return;
    }
    default:
  }
}
