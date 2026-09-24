import { create } from 'zustand';

export interface NodeProgress {
  runId: string;
  progress: number;
  stage: string;
}

export interface NodeError {
  code: string;
  message: string;
  gate: string | null;
}

export interface RunsState {
  /** Live run progress per node (fed by the run WebSocket). Kept apart from board records. */
  progress: Map<string, NodeProgress>;
  /** Last failure per node until it runs again. */
  errors: Map<string, NodeError>;
  activeRunId: string | null;
  /** Nodes in the active run's plan (not marked stale while they are about to re-run). */
  plan: Set<string>;
  lastSeq: number;
  /** Last run that finished with results (offered as a process reel, F12). */
  lastFinishedRunId: string | null;
}

export const useRuns = create<RunsState>()(() => ({
  progress: new Map(),
  errors: new Map(),
  activeRunId: null,
  plan: new Set(),
  lastSeq: 0,
  lastFinishedRunId: null,
}));

export function setProgress(nodeId: string, p: NodeProgress | null) {
  useRuns.setState((s) => {
    const progress = new Map(s.progress);
    if (p) progress.set(nodeId, p);
    else progress.delete(nodeId);
    return { progress };
  });
}

export function setError(nodeId: string, e: NodeError | null) {
  useRuns.setState((s) => {
    const errors = new Map(s.errors);
    if (e) errors.set(nodeId, e);
    else errors.delete(nodeId);
    return { errors };
  });
}
