import type { AdComposition, SceneDoc } from '@3dads/contracts';
import { create } from 'zustand';
import { commit, initUndoable, isDirty, markSaved, redo, replace, type Undoable, undo } from './undoable';

export interface SceneState {
  scene: SceneDoc;
  ad: AdComposition;
}

interface SceneStore {
  projectId: string | null;
  baseRevision: number;
  history: Undoable<SceneState>;
  saving: boolean;
  saveError: string | null;
  load(projectId: string, revision: number, state: SceneState): void;
  /** Commit an edit into history (one undo step). */
  edit(
    patch: { scene?: Partial<SceneDoc>; ad?: Partial<AdComposition> },
    opts?: { transient?: boolean },
  ): void;
  undo(): void;
  redo(): void;
  markSaved(revision: number): void;
  setSaving(saving: boolean, error?: string | null): void;
  canUndo(): boolean;
  canRedo(): boolean;
  dirty(): boolean;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  projectId: null,
  baseRevision: 0,
  history: initUndoable<SceneState>({
    scene: null as unknown as SceneDoc,
    ad: null as unknown as AdComposition,
  }),
  saving: false,
  saveError: null,
  load: (projectId, revision, state) =>
    set({ projectId, baseRevision: revision, history: initUndoable(state), saveError: null }),
  edit: (patch, opts) =>
    set((s) => {
      const cur = s.history.present;
      const next: SceneState = {
        scene: patch.scene
          ? {
              ...cur.scene,
              ...patch.scene,
              placement: { ...cur.scene.placement, ...(patch.scene.placement ?? {}) },
              animation: { ...cur.scene.animation, ...(patch.scene.animation ?? {}) },
            }
          : cur.scene,
        ad: patch.ad ? { ...cur.ad, ...patch.ad } : cur.ad,
      };
      return { history: opts?.transient ? replace(s.history, next) : commit(s.history, next) };
    }),
  undo: () => set((s) => ({ history: undo(s.history) })),
  redo: () => set((s) => ({ history: redo(s.history) })),
  markSaved: (revision) =>
    set((s) => ({ history: markSaved(s.history), baseRevision: revision, saving: false, saveError: null })),
  setSaving: (saving, error = null) => set({ saving, saveError: error }),
  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,
  dirty: () => isDirty(get().history),
}));

export const selectScene = (s: SceneStore) => s.history.present.scene;
export const selectAd = (s: SceneStore) => s.history.present.ad;
