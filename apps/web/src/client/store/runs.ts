import { create } from 'zustand';

export interface NodeProgress {
  runId: string;
  progress: number;
  stage: string;
}

/** Live run progress per node (fed by the run WebSocket in P5). Kept apart from board records. */
export const useRuns = create<{ progress: Map<string, NodeProgress>; activeRunId: string | null }>()(() => ({
  progress: new Map(),
  activeRunId: null,
}));
