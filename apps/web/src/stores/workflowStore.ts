import {
  checkConnection,
  type NodeKind,
  type NodeSettings,
  type WorkflowDoc,
  type WorkflowEdge,
  type WorkflowNode,
} from '@annie3d/contracts';
import { create } from 'zustand';
import { commit, initUndoable, isDirty, markSaved, redo, replace, type Undoable, undo } from './undoable';

interface WorkflowStore {
  workflowId: string | null;
  baseRevision: number;
  history: Undoable<WorkflowDoc>;
  selectedNodeId: string | null;
  saving: boolean;
  saveError: string | null;
  lastConnectionError: string | null;
  load(doc: WorkflowDoc): void;
  select(id: string | null): void;
  moveNode(id: string, position: { x: number; y: number }, opts?: { transient?: boolean }): void;
  addNode(
    kind: NodeKind,
    position: { x: number; y: number },
    settings?: NodeSettings,
    title?: string,
  ): string;
  duplicateNode(id: string): string | null;
  clipboard: WorkflowNode | null;
  copyNode(id: string): void;
  pasteNode(position?: { x: number; y: number }): string | null;
  removeNode(id: string): void;
  renameNode(id: string, title: string): void;
  updateSettings(id: string, settings: NodeSettings): void;
  connect(edge: Omit<WorkflowEdge, 'id'>): boolean;
  disconnect(edgeId: string): void;
  undo(): void;
  redo(): void;
  markSaved(doc: WorkflowDoc): void;
  setSaving(saving: boolean, error?: string | null): void;
  dirty(): boolean;
}

let nodeCounter = 0;

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowId: null,
  baseRevision: 0,
  history: initUndoable<WorkflowDoc>({
    id: '',
    projectId: '',
    revision: 0,
    nodes: [],
    edges: [],
    updatedAt: 0,
  }),
  selectedNodeId: null,
  saving: false,
  saveError: null,
  lastConnectionError: null,
  load: (doc) =>
    set({
      workflowId: doc.id,
      baseRevision: doc.revision,
      history: initUndoable(doc),
      saveError: null,
      lastConnectionError: null,
    }),
  select: (id) => set({ selectedNodeId: id }),
  moveNode: (id, position, opts) =>
    set((s) => {
      const doc = s.history.present;
      const next = { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, position } : n)) };
      return { history: opts?.transient ? replace(s.history, next) : commit(s.history, next) };
    }),
  addNode: (kind, position, settings = {}, title = '') => {
    const id = `n-${kind}-${Date.now().toString(36)}-${++nodeCounter}`;
    set((s) => {
      const doc = s.history.present;
      const node: WorkflowNode = { id, kind, title, position, settings: { ...settings } };
      return { history: commit(s.history, { ...doc, nodes: [...doc.nodes, node] }), selectedNodeId: id };
    });
    return id;
  },
  duplicateNode: (id) => {
    const src = get().history.present.nodes.find((n) => n.id === id);
    if (!src) return null;
    return get().addNode(
      src.kind,
      { x: src.position.x + 40, y: src.position.y + 40 },
      src.settings,
      src.title,
    );
  },
  clipboard: null,
  copyNode: (id) => {
    const src = get().history.present.nodes.find((n) => n.id === id);
    if (src) set({ clipboard: structuredClone(src) });
  },
  pasteNode: (position) => {
    const c = get().clipboard;
    if (!c) return null;
    return get().addNode(
      c.kind,
      position ?? { x: c.position.x + 60, y: c.position.y + 60 },
      c.settings,
      c.title,
    );
  },
  removeNode: (id) =>
    set((s) => {
      const doc = s.history.present;
      return {
        history: commit(s.history, {
          ...doc,
          nodes: doc.nodes.filter((n) => n.id !== id),
          edges: doc.edges.filter((e) => e.source !== id && e.target !== id),
        }),
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      };
    }),
  renameNode: (id, title) =>
    set((s) => {
      const doc = s.history.present;
      return {
        history: commit(s.history, {
          ...doc,
          nodes: doc.nodes.map((n) => (n.id === id ? { ...n, title } : n)),
        }),
      };
    }),
  updateSettings: (id, settings) =>
    set((s) => {
      const doc = s.history.present;
      return {
        history: commit(s.history, {
          ...doc,
          nodes: doc.nodes.map((n) => (n.id === id ? { ...n, settings: { ...n.settings, ...settings } } : n)),
        }),
      };
    }),
  connect: (edge) => {
    const doc = get().history.present;
    const check = checkConnection(doc, edge);
    if (!check.ok) {
      set({ lastConnectionError: check.reason ?? 'Invalid connection.' });
      return false;
    }
    const id = `e-${edge.source}-${edge.sourcePort}-${edge.target}-${edge.targetPort}`;
    set((s) => ({
      history: commit(s.history, { ...doc, edges: [...doc.edges, { id, ...edge }] }),
      lastConnectionError: null,
    }));
    return true;
  },
  disconnect: (edgeId) =>
    set((s) => {
      const doc = s.history.present;
      return { history: commit(s.history, { ...doc, edges: doc.edges.filter((e) => e.id !== edgeId) }) };
    }),
  undo: () => set((s) => ({ history: undo(s.history) })),
  redo: () => set((s) => ({ history: redo(s.history) })),
  markSaved: (doc) =>
    set((s) => ({
      history: markSaved({
        ...s.history,
        present: { ...s.history.present, revision: doc.revision, updatedAt: doc.updatedAt },
      }),
      baseRevision: doc.revision,
      saving: false,
      saveError: null,
    })),
  setSaving: (saving, error = null) => set({ saving, saveError: error }),
  dirty: () => isDirty(get().history),
}));

export const selectDoc = (s: WorkflowStore) => s.history.present;
export const selectNodeIds = (s: WorkflowStore) => s.history.present.nodes.map((n) => n.id);
