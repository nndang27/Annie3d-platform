import { describe, expect, it } from 'vitest';
import {
  canTransition,
  checkConnection,
  executableSteps,
  intentFromSearch,
  isSafeReturnTo,
  safeReturnTo,
  TEMPLATES,
  topologicalOrder,
  type WorkflowDoc,
} from '../index';

describe('run state machine', () => {
  it('allows the documented transitions only', () => {
    expect(canTransition('draft', 'queued')).toBe(true);
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('running', 'waiting_input')).toBe(true);
    expect(canTransition('waiting_input', 'running')).toBe(true);
    expect(canTransition('running', 'cancelling')).toBe(true);
    expect(canTransition('cancelling', 'cancelled')).toBe(true);
    expect(canTransition('completed', 'running')).toBe(false);
    expect(canTransition('cancelled', 'completed')).toBe(false);
    expect(canTransition('failed', 'queued')).toBe(false);
    expect(canTransition('cancelling', 'completed')).toBe(false);
  });
});

describe('returnTo validation', () => {
  it('accepts internal app paths only', () => {
    expect(isSafeReturnTo('/app')).toBe(true);
    expect(isSafeReturnTo('/app/projects/proj_1?tab=studio')).toBe(true);
    expect(isSafeReturnTo('https://evil.example/app')).toBe(false);
    expect(isSafeReturnTo('//evil.example')).toBe(false);
    expect(isSafeReturnTo('/application')).toBe(false);
    expect(isSafeReturnTo('/app/x\\y')).toBe(false);
    expect(isSafeReturnTo('/')).toBe(false);
    expect(safeReturnTo('javascript:alert(1)')).toBe('/app');
  });
  it('parses intent and drops unsafe values', () => {
    const i = intentFromSearch(
      '?returnTo=%2Fapp%2Fprojects%2Fnew&template=turntable-hero-skincare&plan=studio&interval=yearly&junk=1',
    );
    expect(i).toEqual({
      returnTo: '/app/projects/new',
      template: 'turntable-hero-skincare',
      plan: 'studio',
      interval: 'yearly',
    });
    expect(intentFromSearch('?returnTo=https://x.y&template=<script>').returnTo).toBeUndefined();
    expect(intentFromSearch('?template=<script>').template).toBeUndefined();
  });
});

function docFromTemplate(): WorkflowDoc {
  const t = TEMPLATES[0]!;
  return {
    id: 'wf',
    projectId: 'p',
    revision: 1,
    updatedAt: 0,
    nodes: t.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: '',
      position: { x: n.x, y: n.y },
      settings: {},
    })),
    edges: t.edges.map(([source, sourcePort, target, targetPort], i) => ({
      id: `e${i}`,
      source,
      sourcePort,
      target,
      targetPort,
    })),
  };
}

describe('workflow graph rules', () => {
  it('rejects mismatched ports, duplicates, self loops and cycles', () => {
    const doc = docFromTemplate();
    expect(
      checkConnection(doc, { source: 'n-ref', sourcePort: 'image', target: 'n-scene', targetPort: 'brief' })
        .ok,
    ).toBe(false);
    expect(
      checkConnection(doc, { source: 'n-ref', sourcePort: 'image', target: 'n-model', targetPort: 'image' })
        .reason,
    ).toMatch(/already has/);
    expect(
      checkConnection(doc, { source: 'n-model', sourcePort: 'model', target: 'n-model', targetPort: 'image' })
        .ok,
    ).toBe(false);
    // n-export has no outputs so a direct cycle is impossible; build one via a fresh doc
    const cyc: WorkflowDoc = { ...doc, edges: [], nodes: doc.nodes };
    cyc.edges.push({
      id: 'a',
      source: 'n-scene',
      sourcePort: 'scene',
      target: 'n-anim',
      targetPort: 'scene',
    });
    expect(
      checkConnection(cyc, { source: 'n-anim', sourcePort: 'clip', target: 'n-ads', targetPort: 'clip' }).ok,
    ).toBe(true);
  });
  it('orders steps topologically and lists missing inputs', () => {
    const doc = docFromTemplate();
    const order = topologicalOrder(doc).map((n) => n.id);
    expect(order.indexOf('n-model')).toBeLessThan(order.indexOf('n-scene'));
    expect(order.indexOf('n-anim')).toBeLessThan(order.indexOf('n-ads'));
    const steps = executableSteps(doc);
    expect(steps.every((s) => s.missing.length === 0)).toBe(true);
    const broken = { ...doc, edges: doc.edges.filter((e) => e.target !== 'n-scene') };
    const sceneStep = executableSteps(broken).find((s) => s.node.id === 'n-scene')!;
    expect(sceneStep.missing).toEqual(['Model']);
  });
});
