import type { Run, RunStep } from '@annie3d/contracts';
import { create } from 'zustand';

interface RunStore {
  runId: string | null;
  status: Run['status'] | null;
  steps: Record<string, RunStep>;
  setRun(run: Run | null): void;
}

/** Narrow per-node view of the current run so a progress tick re-renders one node card, not the graph. */
export const useRunStore = create<RunStore>((set) => ({
  runId: null,
  status: null,
  steps: {},
  setRun: (run) =>
    set((s) => {
      if (!run) return s.runId === null ? s : { runId: null, status: null, steps: {} };
      const steps: Record<string, RunStep> = {};
      for (const st of run.steps) steps[st.nodeId] = st;
      return { runId: run.id, status: run.status, steps };
    }),
}));

export const selectStep = (nodeId: string) => (s: RunStore) => s.steps[nodeId];
