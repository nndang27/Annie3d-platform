import {
  applyOps,
  type EdgeRecord,
  graphFrom,
  type NodeRecord,
  STARTERS,
  starterGraph,
} from '@annie3d/contracts';
import { describe, expect, it } from 'vitest';
import { plan } from './simulated';

function board(lines = 3) {
  const nodes: NodeRecord[] = [];
  const edges: EdgeRecord[] = [];
  STARTERS.slice(0, lines).forEach((s, i) => {
    const g = starterGraph(s, { x: 0, y: i * 900 });
    nodes.push(...g.nodes);
    edges.push(...g.edges);
  });
  return graphFrom(nodes, edges);
}
const ask = (graph: ReturnType<typeof board>, message: string, nodeIds: string[] = []) =>
  plan({ message, graph, nodeIds, budgetCredits: 100, history: [], locale: 'en' });

describe('simulated agent planner', () => {
  it('asks which one when several nodes match and nothing is selected', () => {
    const r = ask(board(), 'Make the stage darker');
    expect(r.changes).toHaveLength(0);
    expect(r.questions[0]).toMatch(/3 Stage nodes/);
  });

  it('targets the line of the selected node only', () => {
    const g = board();
    const model = [...g.nodes.values()].find((n) => n.kind === 'model3d')!;
    const r = ask(g, 'use the velvet look, warmer', [model.id]);
    const stageOps = r.changes.flatMap((c) => c.ops);
    expect(stageOps.length).toBe(2);
    const next = applyOps(g, stageOps).graph;
    const stages = [...next.nodes.values()].filter((n) => n.kind === 'stage');
    const changed = stages.filter(
      (s) => s.settings.look === 'velvet' && String(s.settings.prompt).includes('warmer'),
    );
    expect(changed).toHaveLength(1);
  });

  it('maps durations to the nearest allowed length, aspects and headlines', () => {
    const g = board(1);
    const r = ask(g, 'make it 7 seconds, square, headline: "Glow all day"');
    const labels = r.changes.map((c) => c.label).join(' | ');
    expect(labels).toContain('duration → 6s (closest to 7s)');
    expect(labels).toContain('aspect → 1:1');
    expect(labels).toContain('Headline → “Glow all day”');
    expect(() =>
      applyOps(
        g,
        r.changes.flatMap((c) => c.ops),
      ),
    ).not.toThrow();
  });

  it('adds a connected packshot node and recognises run requests', () => {
    const g = board(1);
    const r = ask(g, 'add packshots and run it');
    expect(r.wantsRun).toBe(true);
    const next = applyOps(
      g,
      r.changes.flatMap((c) => c.ops),
    ).graph;
    expect([...next.nodes.values()].filter((n) => n.kind === 'packshot')).toHaveLength(2);
  });

  it('does not report a change that changes nothing', () => {
    const g = board(1); // teardown line: its stage already uses Dark lab
    const r = ask(g, 'use the dark lab look');
    expect(r.changes).toHaveLength(0);
    expect(r.notes[0]).toMatch(/already has Dark lab/);
  });

  it('treats "make it square" as an edit, not a run', () => {
    expect(ask(board(1), 'make it square').wantsRun).toBe(false);
  });

  it('explains what it can do when it understands nothing', () => {
    const r = ask(board(1), 'hello');
    expect(r.changes).toHaveLength(0);
    expect(r.questions).toHaveLength(0);
    expect(r.wantsRun).toBe(false);
  });
});
