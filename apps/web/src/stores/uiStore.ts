import { create } from 'zustand';

export type WorkflowView = 'canvas' | 'list';

interface UiStore {
  navCollapsed: boolean;
  workflowView: WorkflowView;
  inspectorOpen: boolean;
  selectedRunId: string | null;
  toggleNav(): void;
  setWorkflowView(v: WorkflowView): void;
  setInspectorOpen(open: boolean): void;
  setSelectedRunId(id: string | null): void;
}

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export const useUiStore = create<UiStore>((set, get) => ({
  navCollapsed: readPref('annie3d.ui.navCollapsed', false),
  workflowView: readPref<WorkflowView>(
    'annie3d.ui.workflowView',
    typeof window !== 'undefined' && window.innerWidth < 900 ? 'list' : 'canvas',
  ),
  inspectorOpen: false,
  selectedRunId: null,
  toggleNav: () => {
    const v = !get().navCollapsed;
    writePref('annie3d.ui.navCollapsed', v);
    set({ navCollapsed: v });
  },
  setWorkflowView: (v) => {
    writePref('annie3d.ui.workflowView', v);
    set({ workflowView: v });
  },
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
}));
