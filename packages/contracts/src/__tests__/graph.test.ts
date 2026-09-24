import { describe, expect, it } from 'vitest';
import {
  applyOps,
  canConnect,
  emptyGraph,
  type GraphOp,
  nextZKey,
  runPlan,
  topoOrder,
  upstreamOf,
} from '../graph';
import { newId } from '../ids';
import type { NodeKind } from '../nodes';

function build() {
  let g = emptyGraph();
  const ids = {
    photo: newId(),
    text: newId(),
    model: newId(),
    stage: newId(),
    pack: newId(),
    video: newId(),
  };
  const create = (id: string, kind: NodeKind, x = 0): GraphOp => ({
    type: 'node.create',
    node: { id, kind, x, y: 0, zKey: nextZKey(g) },
  });
  const edge = (source: string, target: string, targetPort: string): GraphOp => ({
    type: 'edge.create',
    edge: { id: newId(), source, sourcePort: 'out', target, targetPort },
  });
  for (const [k, kind] of [
    ['photo', 'photo'],
    ['text', 'text'],
    ['model', 'model3d'],
    ['stage', 'stage'],
    ['pack', 'packshot'],
    ['video', 'adVideo'],
  ] as const) {
    g = applyOps(g, [create(ids[k], kind)]).graph;
  }
  g = applyOps(g, [
    edge(ids.photo, ids.model, 'images'),
    edge(ids.model, ids.stage, 'model'),
    edge(ids.model, ids.pack, 'subject'),
    edge(ids.stage, ids.video, 'subject'),
    edge(ids.text, ids.video, 'headline'),
  ]).graph;
  return { g, ids, edge };
}

describe('connection rules', () => {
  it('rejects type mismatch, full ports, duplicates and cycles', () => {
    const { g, ids } = build();
    expect(
      canConnect(g, { source: ids.text, sourcePort: 'out', target: ids.model, targetPort: 'images' }),
    ).toEqual({ ok: false, error: 'type_mismatch' });
    expect(
      canConnect(g, { source: ids.model, sourcePort: 'out', target: ids.stage, targetPort: 'model' }),
    ).toEqual({ ok: false, error: 'duplicate' });
    expect(
      canConnect(g, { source: ids.pack, sourcePort: 'out', target: ids.stage, targetPort: 'model' }),
    ).toEqual({ ok: false, error: 'type_mismatch' });
    expect(
      canConnect(g, { source: ids.video, sourcePort: 'out', target: ids.video, targetPort: 'subject' }),
    ).toEqual({ ok: false, error: 'self_loop' });
    // images port takes up to 4 photos
    expect(
      canConnect(g, { source: newId(), sourcePort: 'out', target: ids.model, targetPort: 'images' }),
    ).toEqual({ ok: false, error: 'unknown_node' });
  });
  it('accepts either scene or model3d on the ad video subject port but only one edge', () => {
    const { g, ids } = build();
    expect(
      canConnect(g, { source: ids.model, sourcePort: 'out', target: ids.video, targetPort: 'subject' }),
    ).toEqual({ ok: false, error: 'port_full' });
  });
  it('detects cycles through the reducer', () => {
    const { g, ids, edge } = build();
    // packshot outputs image; model3d accepts images → model → packshot → model would be a cycle
    expect(() => applyOps(g, [edge(ids.pack, ids.model, 'images')])).toThrow('cycle');
  });
});

describe('ordering and plans', () => {
  it('orders topologically and stably', () => {
    const { g, ids } = build();
    const order = topoOrder(g);
    expect(order.indexOf(ids.photo)).toBeLessThan(order.indexOf(ids.model));
    expect(order.indexOf(ids.model)).toBeLessThan(order.indexOf(ids.stage));
    expect(order.indexOf(ids.stage)).toBeLessThan(order.indexOf(ids.video));
    expect(topoOrder(g)).toEqual(order);
  });
  it('plans only runnable nodes for each scope', () => {
    const { g, ids } = build();
    expect(runPlan(g, ids.video, 'with_upstream')).toEqual([ids.model, ids.stage, ids.video]);
    expect(new Set(runPlan(g, ids.model, 'from_here'))).toEqual(
      new Set([ids.model, ids.stage, ids.pack, ids.video]),
    );
    expect(runPlan(g, ids.pack, 'node')).toEqual([ids.pack]);
    expect(upstreamOf(g, ids.video)).toEqual(new Set([ids.stage, ids.model, ids.photo, ids.text]));
  });
});

describe('reducer', () => {
  it('inverse ops restore the exact previous graph (undo)', () => {
    const { g, ids } = build();
    const ops: GraphOp[] = [
      { type: 'node.move', moves: [{ id: ids.stage, x: 500, y: 90 }] },
      {
        type: 'node.update',
        id: ids.video,
        patch: { settings: { motion: 'splash-hero', aspect: '1:1' }, label: 'Hero' },
      },
      { type: 'node.delete', ids: [ids.model] },
    ];
    const { graph, inverse } = applyOps(g, ops);
    expect(graph.nodes.has(ids.model)).toBe(false);
    expect([...graph.edges.values()].some((e) => e.source === ids.model || e.target === ids.model)).toBe(
      false,
    );
    const back = applyOps(graph, inverse).graph;
    const strip = (x: typeof g) => ({
      nodes: [...x.nodes.values()].map(({ version, ...n }) => n).sort((a, b) => a.id.localeCompare(b.id)),
      edges: [...x.edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    });
    expect(strip(back)).toEqual(strip(g));
  });
  it('rejects stale writes with baseVersion (optimistic concurrency)', () => {
    const { g, ids } = build();
    const v = g.nodes.get(ids.stage)!.version;
    const g2 = applyOps(g, [
      { type: 'node.update', id: ids.stage, patch: { label: 'A' }, baseVersion: v },
    ]).graph;
    expect(() =>
      applyOps(g2, [{ type: 'node.update', id: ids.stage, patch: { label: 'B' }, baseVersion: v }]),
    ).toThrow('conflict');
  });
  it('validates settings against the node schema', () => {
    const { g, ids } = build();
    expect(() =>
      applyOps(g, [{ type: 'node.update', id: ids.video, patch: { settings: { durationSec: 7 } } }]),
    ).toThrow('invalid_settings');
  });
  it('keeps z-order keys strictly increasing', () => {
    const { g } = build();
    const keys = [...g.nodes.values()].map((n) => n.zKey);
    expect([...keys].sort()).toEqual(keys);
    expect(nextZKey(g) > keys.at(-1)!).toBe(true);
  });
});

import { graphFrom } from '../graph';
import { STARTERS, starterGraph } from '../starters';

describe('starters', () => {
  it('every starter is a valid graph accepted by the reducer rules', () => {
    for (const s of STARTERS) {
      const { nodes, edges } = starterGraph(s);
      const g = graphFrom(nodes, []);
      const out = applyOps(
        g,
        edges.map((e) => ({ type: 'edge.create', edge: e }) as GraphOp),
      ).graph;
      expect(out.edges.size).toBe(edges.length);
      expect(runPlan(out, null, 'all')).toHaveLength(5);
    }
  });
});

describe('undo of a multi-node delete', () => {
  it('restores the nodes, every wire and each node result pointer', () => {
    const { g: g0, ids } = build();
    const [vModel, vStage] = [newId(), newId()];
    const g = applyOps(g0, [
      { type: 'node.update', id: ids.model, patch: { currentVersionId: vModel, settings: { prompt: 'p' } } },
      { type: 'node.update', id: ids.stage, patch: { currentVersionId: vStage } },
    ]).graph;
    const del = applyOps(g, [{ type: 'node.delete', ids: [ids.model, ids.stage] }]);
    expect(del.graph.nodes.size).toBe(g.nodes.size - 2);
    const back = applyOps(del.graph, del.inverse).graph;
    expect(back.edges.size).toBe(g.edges.size);
    expect(back.nodes.get(ids.model)).toMatchObject({ currentVersionId: vModel, settings: { prompt: 'p' } });
    expect(back.nodes.get(ids.stage)?.currentVersionId).toBe(vStage);
  });
});
