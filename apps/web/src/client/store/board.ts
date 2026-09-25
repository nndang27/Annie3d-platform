import {
  applyOps,
  type BoardSnapshot,
  downstreamOf,
  type EdgeRecord,
  type Graph,
  type GraphOp,
  graphFrom,
  NODE_DEFS,
  type NodeRecord,
  type NodeVersionDto,
  newId,
  OpError,
} from '@annie3d/contracts';
import { create } from 'zustand';
import { api } from '../api/client';
import { record } from '../lib/perf';
import { loadOutbox, type PendingBatch, saveGuest, saveOutbox } from './persist';

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

export interface BoardState {
  /**
   * guest: kept in this browser; remote: a cloud board synced to the server; file: a desktop
   * board file, edited in memory and written by Save (lib/doc.ts).
   */
  mode: 'loading' | 'guest' | 'remote' | 'file';
  boardId: string | null;
  title: string;
  graph: Graph;
  versions: Map<string, NodeVersionDto>;
  stale: Set<string>;
  seq: number;
  undoStack: GraphOp[][];
  redoStack: GraphOp[][];
  saveState: SaveState;
  lastError: string | null;
}

const initial: BoardState = {
  mode: 'loading',
  boardId: null,
  title: 'Untitled board',
  graph: { nodes: new Map(), edges: new Map() },
  versions: new Map(),
  stale: new Set(),
  seq: 0,
  undoStack: [],
  redoStack: [],
  saveState: 'saved',
  lastError: null,
};

export const useBoard = create<BoardState>()(() => initial);
const set = useBoard.setState;
const get = useBoard.getState;

// ------------------------------------------------------------------ hooks
/**
 * A desktop board file on its working copy keeps some results only in the file (lib/doc.ts):
 * they are put back after every snapshot, and outgoing ops never point the server at them.
 */
let afterSnapshot: () => void = () => {};
let outgoing: (ops: GraphOp[]) => GraphOp[] = (ops) => ops;
export function setBoardHooks(h: { afterSnapshot: () => void; outgoing: (ops: GraphOp[]) => GraphOp[] }) {
  afterSnapshot = h.afterSnapshot;
  outgoing = h.outgoing;
}

// ------------------------------------------------------------------ loading
export function loadSnapshot(s: BoardSnapshot) {
  // The in-memory queue belongs to one board. Unsent batches of the previous board stay in
  // IndexedDB under its id and resume when it is reopened; they must never go to this board.
  const sameBoard = get().boardId === s.board.id;
  if (!sameBoard) resetQueue();
  // A snapshot carries only each node's current version. On a resync of the same board (after a
  // rejected batch) keep the versions already known: they are immutable, and dropping them lost
  // the history, so reverting to v1 in the editor left the node pointing at a version the canvas
  // no longer had (E2E editor.spec.ts:67 under load, 2026-09-25).
  const versions = new Map(sameBoard ? get().versions : []);
  for (const v of s.versions) versions.set(v.id, v);
  set({
    ...initial,
    mode: 'remote',
    boardId: s.board.id,
    title: s.board.title,
    seq: s.board.seq,
    graph: graphFrom(
      s.nodes.map(({ stale: _s, ...n }) => n),
      s.edges as EdgeRecord[],
    ),
    versions,
    stale: new Set(s.nodes.filter((n) => n.stale).map((n) => n.id)),
  });
  afterSnapshot();
  void resumeOutbox(s.board.id);
}

export interface LocalBoard {
  title: string;
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  versions: NodeVersionDto[];
  stale?: string[];
}

export function loadGuestBoard(g: LocalBoard) {
  loadLocalBoard(g, 'guest');
}

/** A board that lives on this device: in the browser (guest) or in a desktop board file. */
export function loadLocalBoard(g: LocalBoard, mode: 'guest' | 'file') {
  resetQueue();
  set({
    ...initial,
    mode,
    boardId: null,
    title: g.title,
    graph: graphFrom(g.nodes, g.edges),
    versions: new Map(g.versions.map((v) => [v.id, v])),
    stale: new Set(g.stale ?? []),
  });
}

export function upsertVersions(vs: NodeVersionDto[]) {
  const versions = new Map(get().versions);
  for (const v of vs) versions.set(v.id, v);
  set({ versions });
}

// ------------------------------------------------------------------ edits
/**
 * The single mutation path: optimistic local apply with the shared reducer, undo entry from the
 * inverse ops, then queue for the server (remote) or persist (guest).
 */
export function dispatch(ops: GraphOp[], opts: { undoable?: boolean } = {}): boolean {
  const st = get();
  let res: ReturnType<typeof applyOps>;
  try {
    res = applyOps(st.graph, ops);
  } catch (e) {
    if (e instanceof OpError) {
      set({ lastError: e.code });
      return false;
    }
    throw e;
  }
  const stale = propagateStale(res.graph, st.stale, ops, res.touched);
  set({
    graph: res.graph,
    stale,
    undoStack: opts.undoable === false ? st.undoStack : [...st.undoStack.slice(-199), res.inverse],
    redoStack: opts.undoable === false ? st.redoStack : [],
    lastError: null,
  });
  enqueue(ops);
  return true;
}

export function undo() {
  const t0 = performance.now();
  const st = get();
  const inv = st.undoStack.at(-1);
  if (!inv) return;
  const res = applyOps(st.graph, inv);
  set({ graph: res.graph, undoStack: st.undoStack.slice(0, -1), redoStack: [...st.redoStack, res.inverse] });
  enqueue(inv);
  record('undo.apply', performance.now() - t0, 'undo');
}
export function redo() {
  const t0 = performance.now();
  const st = get();
  const ops = st.redoStack.at(-1);
  if (!ops) return;
  const res = applyOps(st.graph, ops);
  set({ graph: res.graph, redoStack: st.redoStack.slice(0, -1), undoStack: [...st.undoStack, res.inverse] });
  enqueue(ops);
  record('undo.apply', performance.now() - t0, 'redo');
}

/**
 * Applies ops that the server already committed (run results, other collaborators): no undo
 * entry and no outbox. Ops that no longer apply locally are ignored; the next snapshot heals.
 */
export function applyRemote(ops: GraphOp[], seq?: number, opts: { undoable?: boolean } = {}) {
  const st = get();
  try {
    const res = applyOps(st.graph, ops);
    set({
      graph: res.graph,
      seq: Math.max(st.seq, seq ?? st.seq),
      stale: propagateStale(res.graph, st.stale, ops, res.touched),
      // Agent edits are undoable like your own: ⌘Z sends the inverse as a normal batch.
      ...(opts.undoable ? { undoStack: [...st.undoStack.slice(-199), res.inverse], redoStack: [] } : {}),
    });
  } catch (e) {
    if (!(e instanceof OpError)) throw e;
  }
}

export function setStale(update: (prev: Set<string>) => Set<string>) {
  set({ stale: update(get().stale) });
}

/** Drag frames update positions locally only; one node.move op is sent on drag stop. */
export function setPositionsLocal(moves: { id: string; x: number; y: number }[]) {
  const g = get().graph;
  const nodes = new Map(g.nodes);
  for (const m of moves) {
    const n = nodes.get(m.id);
    if (n) nodes.set(m.id, { ...n, x: m.x, y: m.y });
  }
  set({ graph: { nodes, edges: g.edges } });
}

/** Downstream runnable nodes of a changed node show "stale" until re-run (client hint). */
function propagateStale(g: Graph, prev: Set<string>, ops: GraphOp[], touched: Set<string>): Set<string> {
  const meaningful = ops.some((o) => o.type !== 'node.move');
  if (!meaningful) return prev;
  const next = new Set(prev);
  for (const id of touched) {
    const self = g.nodes.get(id);
    const selfChanged = ops.some(
      (o) =>
        (o.type === 'node.update' && o.id === id && !!o.patch.settings) ||
        (o.type === 'edge.create' && o.edge.target === id) ||
        o.type === 'edge.delete',
    );
    if (self && NODE_DEFS[self.kind].runnable && self.currentVersionId && selfChanged) next.add(id);
    for (const d of downstreamOf(g, id)) {
      const n = g.nodes.get(d);
      if (n && NODE_DEFS[n.kind].runnable && n.currentVersionId) next.add(d);
    }
  }
  for (const id of next) if (!g.nodes.has(id)) next.delete(id);
  return next;
}

// ------------------------------------------------------------------ sync (outbox)
let queue: PendingBatch[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let guestTimer: ReturnType<typeof setTimeout> | null = null;

function resetQueue() {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}

function enqueue(ops: GraphOp[]) {
  const st = get();
  // A board file is written by Save; lib/doc.ts tracks unsaved changes.
  if (st.mode === 'file') return;
  if (st.mode === 'guest') {
    if (guestTimer) clearTimeout(guestTimer);
    guestTimer = setTimeout(() => {
      const s = get();
      void saveGuest({
        title: s.title,
        nodes: [...s.graph.nodes.values()],
        edges: [...s.graph.edges.values()],
        versions: [...s.versions.values()],
      });
    }, 300);
    return;
  }
  if (st.mode !== 'remote' || !st.boardId) return;
  ops = outgoing(ops);
  if (!ops.length) return;
  queue.push({ opId: newId(), ops });
  set({ saveState: 'saving' });
  void saveOutbox(st.boardId, queue);
  // Batch edits made within 250 ms into one request (Linear TransactionQueue batching).
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 250);
}

async function flush() {
  const boardId = get().boardId;
  if (flushing || !boardId || !queue.length) return;
  flushing = true;
  try {
    while (queue.length) {
      // Merge everything queued so far into one batch with a stable id (retries stay idempotent).
      if (queue.length > 1) {
        const merged: PendingBatch = { opId: queue[0]!.opId, ops: queue.flatMap((b) => b.ops) };
        queue = [merged];
        await saveOutbox(boardId, queue);
      }
      const batch = queue[0]!;
      try {
        const r = await api.applyOps(boardId, batch.opId, batch.ops as GraphOp[]);
        queue.shift();
        set({ seq: r.seq });
        await saveOutbox(boardId, queue);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (status === 0 || status >= 500 || status === 429) {
          set({ saveState: navigator.onLine ? 'error' : 'offline' });
          setTimeout(() => void flush(), 2000);
          return;
        }
        // 4xx: the server rejected the batch (e.g. conflict). Drop it and resync from the source of truth.
        queue.shift();
        await saveOutbox(boardId, queue);
        set({ lastError: (e as Error).message });
        const snap = await api.board(boardId);
        loadSnapshot(snap);
      }
    }
    set({ saveState: 'saved' });
  } finally {
    flushing = false;
  }
}

/** After a reload: re-apply unsent batches locally, then send them (Figma: reconnect = state + replay). */
async function resumeOutbox(boardId: string) {
  const pending = await loadOutbox(boardId);
  if (!pending.length) return;
  let g = get().graph;
  const ok: PendingBatch[] = [];
  for (const b of pending) {
    try {
      g = applyOps(g, b.ops as GraphOp[]).graph;
      ok.push(b);
    } catch {
      /* already applied or no longer valid */
    }
  }
  queue = ok;
  set({ graph: g, saveState: ok.length ? 'saving' : 'saved' });
  void flush();
}

export function pendingCount() {
  return queue.length;
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
}
