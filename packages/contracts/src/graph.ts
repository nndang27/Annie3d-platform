import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';
import { NODE_DEFS, type NodeKind, NodeKindSchema, parseSettings } from './nodes';
import type { PortType } from './ports';

// ---------------------------------------------------------------------------------------------
// Records. Session state (selection, viewport, open editor) is never part of these records
// (Excalidraw removed `isSelected` from shared elements for the same reason).
// ---------------------------------------------------------------------------------------------

export interface NodeRecord {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  label: string | null;
  settings: Record<string, unknown>;
  /** Fractional index for z-order (Figma "Realtime editing of ordered sequences"). */
  zKey: string;
  /** Row version, bumped on every change; used for optimistic concurrency. */
  version: number;
  currentVersionId: string | null;
}

export interface EdgeRecord {
  id: string;
  source: string;
  sourcePort: 'out';
  target: string;
  targetPort: string;
}

export interface Graph {
  nodes: Map<string, NodeRecord>;
  edges: Map<string, EdgeRecord>;
}

export function emptyGraph(): Graph {
  return { nodes: new Map(), edges: new Map() };
}

export function graphFrom(nodes: NodeRecord[], edges: EdgeRecord[]): Graph {
  return { nodes: new Map(nodes.map((n) => [n.id, n])), edges: new Map(edges.map((e) => [e.id, e])) };
}

// ---------------------------------------------------------------------------------------------
// Operations: the only way to change a board. The UI, the agent and the server all apply the
// same ops (Linear sync engine: every change is a transaction with enough data to undo it).
// ---------------------------------------------------------------------------------------------

const coord = z.number().finite().min(-1e7).max(1e7);
const id = z.string().uuid();

export const NodeCreate = z.object({
  type: z.literal('node.create'),
  node: z.object({
    id,
    kind: NodeKindSchema,
    x: coord,
    y: coord,
    label: z.string().max(120).nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    zKey: z.string().min(1).max(64),
  }),
});
export const NodeUpdate = z.object({
  type: z.literal('node.update'),
  id,
  patch: z.object({
    label: z.string().max(120).nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    currentVersionId: z.string().uuid().nullable().optional(),
    zKey: z.string().min(1).max(64).optional(),
  }),
  baseVersion: z.number().int().nonnegative().optional(),
});
export const NodeMove = z.object({
  type: z.literal('node.move'),
  moves: z
    .array(z.object({ id, x: coord, y: coord }))
    .min(1)
    .max(1000),
});
export const NodeDelete = z.object({ type: z.literal('node.delete'), ids: z.array(id).min(1).max(1000) });
export const EdgeCreate = z.object({
  type: z.literal('edge.create'),
  edge: z.object({
    id,
    source: id,
    sourcePort: z.literal('out'),
    target: id,
    targetPort: z.string().min(1).max(32),
  }),
});
export const EdgeDelete = z.object({ type: z.literal('edge.delete'), ids: z.array(id).min(1).max(1000) });

export const GraphOp = z.discriminatedUnion('type', [
  NodeCreate,
  NodeUpdate,
  NodeMove,
  NodeDelete,
  EdgeCreate,
  EdgeDelete,
]);
export type GraphOp = z.infer<typeof GraphOp>;

export const OpBatch = z.object({
  /** Idempotency key: a retried batch with the same id is applied once. */
  opId: z.string().uuid(),
  ops: z.array(GraphOp).min(1).max(500),
});
export type OpBatch = z.infer<typeof OpBatch>;

// ---------------------------------------------------------------------------------------------
// Connection rules
// ---------------------------------------------------------------------------------------------

export type ConnectError =
  | 'unknown_node'
  | 'unknown_port'
  | 'self_loop'
  | 'type_mismatch'
  | 'port_full'
  | 'duplicate'
  | 'cycle'
  | 'no_output';

export function outputTypeOf(kind: NodeKind): PortType | null {
  return NODE_DEFS[kind].output?.type ?? null;
}

export function canConnect(
  g: Graph,
  e: Omit<EdgeRecord, 'id'>,
): { ok: true } | { ok: false; error: ConnectError } {
  const src = g.nodes.get(e.source);
  const dst = g.nodes.get(e.target);
  if (!src || !dst) return { ok: false, error: 'unknown_node' };
  if (e.source === e.target) return { ok: false, error: 'self_loop' };
  const out = outputTypeOf(src.kind);
  if (!out) return { ok: false, error: 'no_output' };
  const port = NODE_DEFS[dst.kind].inputs.find((p) => p.id === e.targetPort);
  if (!port) return { ok: false, error: 'unknown_port' };
  if (!port.accepts.includes(out)) return { ok: false, error: 'type_mismatch' };
  let count = 0;
  for (const x of g.edges.values()) {
    if (x.target === e.target && x.targetPort === e.targetPort) {
      if (x.source === e.source) return { ok: false, error: 'duplicate' };
      count++;
    }
  }
  if (count >= (port.max ?? 1)) return { ok: false, error: 'port_full' };
  if (reaches(g, e.target, e.source)) return { ok: false, error: 'cycle' };
  return { ok: true };
}

/** True when `to` is reachable from `from` following edges forward. */
export function reaches(g: Graph, from: string, to: string): boolean {
  const out = adjacency(g).out;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === to) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of out.get(n) ?? []) stack.push(m);
  }
  return false;
}

export function adjacency(g: Graph): { out: Map<string, string[]>; in: Map<string, string[]> } {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const e of g.edges.values()) {
    (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e.target);
    (inn.get(e.target) ?? inn.set(e.target, []).get(e.target)!).push(e.source);
  }
  return { out, in: inn };
}

export function upstreamOf(g: Graph, nodeId: string): Set<string> {
  return closure(adjacency(g).in, nodeId);
}
export function downstreamOf(g: Graph, nodeId: string): Set<string> {
  return closure(adjacency(g).out, nodeId);
}
function closure(adj: Map<string, string[]>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of adj.get(n) ?? []) stack.push(m);
  }
  return seen;
}

/** Kahn topological order of the given node ids (all nodes when omitted). Throws on a cycle. */
export function topoOrder(g: Graph, subset?: Iterable<string>): string[] {
  const ids = new Set(subset ?? g.nodes.keys());
  const indeg = new Map<string, number>([...ids].map((i) => [i, 0]));
  const out = new Map<string, string[]>();
  for (const e of g.edges.values()) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e.target);
  }
  // Stable: ties broken by id so the same graph always yields the same order.
  const ready = [...ids].filter((i) => indeg.get(i) === 0).sort();
  const order: string[] = [];
  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    for (const m of out.get(n) ?? []) {
      const d = indeg.get(m)! - 1;
      indeg.set(m, d);
      if (d === 0) {
        ready.push(m);
        ready.sort();
      }
    }
  }
  if (order.length !== ids.size) throw new Error('cycle');
  return order;
}

/** Nodes a run of `scope` touches, in execution order, runnable nodes only. */
export function runPlan(
  g: Graph,
  nodeId: string | null,
  scope: 'node' | 'from_here' | 'with_upstream' | 'all',
): string[] {
  let set: Set<string>;
  if (scope === 'all' || nodeId === null) set = new Set(g.nodes.keys());
  else if (scope === 'node') set = new Set([nodeId]);
  else if (scope === 'from_here') set = new Set([nodeId, ...downstreamOf(g, nodeId)]);
  else set = new Set([nodeId, ...upstreamOf(g, nodeId)]);
  return topoOrder(g, set).filter((i) => NODE_DEFS[g.nodes.get(i)!.kind].runnable);
}

// ---------------------------------------------------------------------------------------------
// Pure reducer with inverse ops (undo), shared by client (optimistic) and server (authoritative)
// ---------------------------------------------------------------------------------------------

export class OpError extends Error {
  constructor(
    public code: ConnectError | 'not_found' | 'exists' | 'conflict' | 'invalid_settings',
    public opIndex: number,
  ) {
    super(code);
  }
}

export function applyOps(
  g: Graph,
  ops: GraphOp[],
): { graph: Graph; inverse: GraphOp[]; touched: Set<string> } {
  const graph: Graph = { nodes: new Map(g.nodes), edges: new Map(g.edges) };
  const inverse: GraphOp[] = [];
  const touched = new Set<string>();
  ops.forEach((op, i) => {
    switch (op.type) {
      case 'node.create': {
        if (graph.nodes.has(op.node.id)) throw new OpError('exists', i);
        let settings: Record<string, unknown>;
        try {
          settings = parseSettings(op.node.kind, op.node.settings) as Record<string, unknown>;
        } catch {
          throw new OpError('invalid_settings', i);
        }
        graph.nodes.set(op.node.id, {
          id: op.node.id,
          kind: op.node.kind,
          x: op.node.x,
          y: op.node.y,
          label: op.node.label ?? null,
          settings,
          zKey: op.node.zKey,
          version: 1,
          currentVersionId: null,
        });
        inverse.unshift({ type: 'node.delete', ids: [op.node.id] });
        touched.add(op.node.id);
        break;
      }
      case 'node.update': {
        const n = graph.nodes.get(op.id);
        if (!n) throw new OpError('not_found', i);
        if (op.baseVersion !== undefined && op.baseVersion !== n.version) throw new OpError('conflict', i);
        let settings = n.settings;
        if (op.patch.settings) {
          try {
            settings = parseSettings(n.kind, { ...n.settings, ...op.patch.settings }) as Record<
              string,
              unknown
            >;
          } catch {
            throw new OpError('invalid_settings', i);
          }
        }
        const prevPatch: z.infer<typeof NodeUpdate>['patch'] = {};
        if (op.patch.label !== undefined) prevPatch.label = n.label;
        if (op.patch.settings) prevPatch.settings = pick(n.settings, Object.keys(op.patch.settings));
        if (op.patch.currentVersionId !== undefined) prevPatch.currentVersionId = n.currentVersionId;
        if (op.patch.zKey !== undefined) prevPatch.zKey = n.zKey;
        graph.nodes.set(n.id, {
          ...n,
          label: op.patch.label !== undefined ? op.patch.label : n.label,
          settings,
          currentVersionId:
            op.patch.currentVersionId !== undefined ? op.patch.currentVersionId : n.currentVersionId,
          zKey: op.patch.zKey ?? n.zKey,
          version: n.version + 1,
        });
        inverse.unshift({ type: 'node.update', id: n.id, patch: prevPatch });
        touched.add(n.id);
        break;
      }
      case 'node.move': {
        const prev: { id: string; x: number; y: number }[] = [];
        for (const m of op.moves) {
          const n = graph.nodes.get(m.id);
          if (!n) throw new OpError('not_found', i);
          prev.push({ id: n.id, x: n.x, y: n.y });
          graph.nodes.set(n.id, { ...n, x: m.x, y: m.y, version: n.version + 1 });
          touched.add(n.id);
        }
        inverse.unshift({ type: 'node.move', moves: prev });
        break;
      }
      case 'node.delete': {
        const restoreEdges: EdgeRecord[] = [];
        const restoreNodes: NodeRecord[] = [];
        for (const nid of op.ids) {
          const n = graph.nodes.get(nid);
          if (!n) throw new OpError('not_found', i);
          restoreNodes.push(n);
          graph.nodes.delete(nid);
          touched.add(nid);
        }
        const gone = new Set(op.ids);
        for (const e of [...graph.edges.values()]) {
          if (gone.has(e.source) || gone.has(e.target)) {
            restoreEdges.push(e);
            graph.edges.delete(e.id);
          }
        }
        // Undo: recreate nodes first, then their edges.
        const undo: GraphOp[] = [
          ...restoreNodes.map(
            (n): GraphOp => ({
              type: 'node.create',
              node: {
                id: n.id,
                kind: n.kind,
                x: n.x,
                y: n.y,
                label: n.label,
                settings: n.settings,
                zKey: n.zKey,
              },
            }),
          ),
          ...restoreEdges.map((e): GraphOp => ({ type: 'edge.create', edge: { ...e } })),
        ];
        inverse.unshift(...undo);
        break;
      }
      case 'edge.create': {
        if (graph.edges.has(op.edge.id)) throw new OpError('exists', i);
        const check = canConnect(graph, op.edge);
        if (!check.ok) throw new OpError(check.error, i);
        graph.edges.set(op.edge.id, { ...op.edge });
        inverse.unshift({ type: 'edge.delete', ids: [op.edge.id] });
        touched.add(op.edge.target);
        break;
      }
      case 'edge.delete': {
        const restore: EdgeRecord[] = [];
        for (const eid of op.ids) {
          const e = graph.edges.get(eid);
          if (!e) throw new OpError('not_found', i);
          restore.push(e);
          graph.edges.delete(eid);
          touched.add(e.target);
        }
        inverse.unshift(...restore.map((e): GraphOp => ({ type: 'edge.create', edge: { ...e } })));
        break;
      }
    }
  });
  return { graph, inverse, touched };
}

function pick(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const k of keys) r[k] = o[k];
  return r;
}

/** z-order key strictly after the current top node. */
export function nextZKey(g: Graph): string {
  let top: string | null = null;
  for (const n of g.nodes.values()) if (top === null || n.zKey > top) top = n.zKey;
  return generateKeyBetween(top, null);
}
export { generateKeyBetween };
