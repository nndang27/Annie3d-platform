import { create } from 'zustand';

export interface ComposerResult {
  id: number;
  input: string;
  ok: boolean;
  message: string;
  suggestions?: string[];
}

interface ComposerStore {
  results: ComposerResult[];
  pushResult(r: Omit<ComposerResult, 'id'>): void;
  /** Text queued for insertion into the composer (e.g. "Reference in agent"). */
  pendingInsert: string | null;
  focusRequested: number;
  insert(text: string): void;
  focus(): void;
  consume(): string | null;
}

let counter = 0;
export const useComposerStore = create<ComposerStore>((set, get) => ({
  results: [],
  pushResult: (r) => set((s) => ({ results: [...s.results.slice(-4), { ...r, id: ++counter }] })),
  pendingInsert: null,
  focusRequested: 0,
  insert: (text) => set((s) => ({ pendingInsert: text, focusRequested: s.focusRequested + 1 })),
  focus: () => set((s) => ({ focusRequested: s.focusRequested + 1 })),
  consume: () => {
    const t = get().pendingInsert;
    if (t !== null) set({ pendingInsert: null });
    return t;
  },
}));
