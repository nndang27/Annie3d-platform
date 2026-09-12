import { isTerminal, type RunEvent } from '@3dads/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockBackend } from '../backend';
import { VirtualClock } from '../clock';
import type { ScenarioId } from '../scenarios';
import { LATENCY } from '../scenarios';
import { openDemoStore } from '../store';

let scenario: ScenarioId = 'normal';
let clock: VirtualClock;
let backend: MockBackend;
let op = 0;
const opId = () => `op_${++op}`;

async function boot(memory = true, store?: Awaited<ReturnType<typeof openDemoStore>>) {
  clock = clock ?? new VirtualClock();
  const s = store ?? (await openDemoStore({ memory }));
  const b = new MockBackend({
    store: s,
    clock,
    scenario: () => scenario,
    latency: () => LATENCY.fast,
    sampleMp4Url: 'about:blank',
  });
  await b.ready;
  return { backend: b, store: s };
}

/** Drive the persisted scheduler deterministically. */
function runUntil(pred: () => boolean, maxMs = 60_000) {
  let elapsed = 0;
  while (!pred() && elapsed < maxMs) {
    clock.advance(25);
    elapsed += 25;
  }
  if (!pred()) throw new Error('condition not reached');
}

beforeEach(async () => {
  scenario = 'normal';
  clock = new VirtualClock();
  ({ backend } = await boot());
  await backend.signIn('mai@lumen.demo');
});

describe('session and scoping', () => {
  it('loads only the signed-in workspace and unloads on sign-out', async () => {
    expect(backend.ws?.workspaceId).toBe('ws_lumen');
    expect(backend.listProjects().length).toBeGreaterThan(0);
    await backend.signOut();
    expect(backend.ws).toBeNull();
    expect(() => backend.listProjects()).toThrow(/Sign in/);
    await backend.signIn('alex@northwind.demo');
    expect(backend.ws?.workspaceId).toBe('ws_northwind');
    expect(backend.listProjects().every((p) => p.id.startsWith('proj_'))).toBe(true);
    // Lumen ids never appear in Northwind
    const lumenIds = new Set<string>();
    await backend.signOut();
    await backend.signIn('mai@lumen.demo');
    for (const p of backend.listProjects()) lumenIds.add(p.id);
    await backend.signOut();
    await backend.signIn('alex@northwind.demo');
    for (const p of backend.listProjects()) expect(lumenIds.has(p.id)).toBe(false);
  });

  it('reports an expired session and refuses viewer mutations', async () => {
    backend.expireSession();
    expect(() => backend.listProjects()).toThrow(/expired/);
    await backend.signIn('sam@lumen.demo');
    const p = backend.listProjects()[0]!;
    expect(() => backend.renameProject(p.id, 'x')).toThrow(/editor role/);
  });
});

describe('runs', () => {
  it('is idempotent per operation id and completes with artifacts', () => {
    const p = backend.listProjects()[0]!;
    const id = opId();
    const r1 = backend.startRun({
      projectId: p.id,
      workflowId: backend.getProject(p.id).project.workflowId,
      operationId: id,
    });
    const r2 = backend.startRun({
      projectId: p.id,
      workflowId: backend.getProject(p.id).project.workflowId,
      operationId: id,
    });
    expect(r2.id).toBe(r1.id);
    expect(backend.listRuns(p.id).length).toBe(1);
    expect(() =>
      backend.startRun({ projectId: p.id, workflowId: r1.workflowId, operationId: opId() }),
    ).toThrow(/already active/);
    runUntil(() => isTerminal(backend.getRun(r1.id).status));
    const run = backend.getRun(r1.id);
    expect(run.status).toBe('completed');
    expect(run.steps.every((s) => s.status === 'completed')).toBe(true);
    expect(
      backend.listArtifacts({ projectId: p.id }).some((a) => a.runId === run.id && a.kind === 'ad-variant'),
    ).toBe(true);
    // charged exactly once
    expect(backend.usage().filter((u) => u.refId === run.id).length).toBe(1);
    expect(run.creditsCharged).toBe(7);
  });

  it('cancel drops late ticks and settles to cancelled with retained artifacts', () => {
    const p = backend.listProjects()[0]!;
    const wf = backend.getProject(p.id).project.workflowId;
    const run = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => backend.getRun(run.id).steps.some((s) => s.status === 'completed'));
    const before = backend.listArtifacts({ projectId: p.id }).filter((a) => a.runId === run.id).length;
    expect(before).toBeGreaterThan(0);
    const events: RunEvent[] = [];
    backend.subscribeRun(run.id, (e) => events.push(e));
    backend.cancelRun(run.id, opId());
    expect(backend.getRun(run.id).status).toBe('cancelling');
    expect(
      backend.scheduler.pending().filter((t) => t.kind === 'step.tick' && t.payload.runId === run.id).length,
    ).toBe(0);
    runUntil(() => backend.getRun(run.id).status === 'cancelled');
    clock.advance(5000);
    const final = backend.getRun(run.id);
    expect(final.status).toBe('cancelled');
    expect(events.filter((e) => e.type === 'step.completed').length).toBe(0);
    expect(events.at(-1)?.type).toBe('run.cancelled');
    expect(backend.listArtifacts({ projectId: p.id }).filter((a) => a.runId === run.id).length).toBe(before);
    // second cancel with a new op id is a no-op
    expect(backend.cancelRun(run.id, opId()).status).toBe('cancelled');
  });

  it('failure scenario fails the run, retry reuses completed artifacts', () => {
    scenario = 'run-failure';
    const p = backend.listProjects()[1]!;
    const wf = backend.getProject(p.id).project.workflowId;
    const run = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => isTerminal(backend.getRun(run.id).status));
    expect(backend.getRun(run.id).status).toBe('failed');
    expect(backend.getRun(run.id).error).toMatch(/Build 3D model failed/);
    scenario = 'partial-result';
    const retry = backend.retryRun(run.id, opId());
    expect(retry.retryOf).toBe(run.id);
    runUntil(() => isTerminal(backend.getRun(retry.id).status));
    const r = backend.getRun(retry.id);
    expect(r.status).toBe('failed');
    expect(r.steps.find((s) => s.nodeId === 'n-model')?.status).toBe('completed');
    expect(r.steps.find((s) => s.nodeId === 'n-scene')?.status).toBe('completed');
    expect(r.steps.find((s) => s.nodeId === 'n-anim')?.status).toBe('failed');
    scenario = 'normal';
    const retry2 = backend.retryRun(retry.id, opId());
    expect(retry2.steps.filter((s) => s.status === 'skipped').length).toBe(2);
    expect(retry2.steps.find((s) => s.nodeId === 'n-model')?.artifactId).toBe(
      r.steps.find((s) => s.nodeId === 'n-model')?.artifactId,
    );
    runUntil(() => isTerminal(backend.getRun(retry2.id).status));
    expect(backend.getRun(retry2.id).status).toBe('completed');
    expect(backend.getRun(retry2.id).creditsCharged).toBe(4); // model(2)+scene(1) skipped, anim 2 + ads 1 + export 1
  });

  it('waiting for input pauses until answered', () => {
    scenario = 'waiting-input';
    const p = backend.listProjects()[0]!;
    const wf = backend.getProject(p.id).project.workflowId;
    const run = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => backend.getRun(run.id).status === 'waiting_input');
    clock.advance(3000);
    expect(backend.getRun(run.id).status).toBe('waiting_input');
    expect(() => backend.answerInput(run.id, 'nope')).toThrow(/Choose one/);
    backend.answerInput(run.id, 'centered');
    runUntil(() => isTerminal(backend.getRun(run.id).status));
    expect(backend.getRun(run.id).status).toBe('completed');
    const ad = backend
      .listArtifacts({ projectId: p.id })
      .find((a) => a.runId === run.id && a.kind === 'ad-variant');
    expect(ad?.ad?.layout).toBe('centered');
  });

  it('replays events by cursor and reports gaps beyond retention', () => {
    const p = backend.listProjects()[0]!;
    const wf = backend.getProject(p.id).project.workflowId;
    const run = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => isTerminal(backend.getRun(run.id).status));
    const all = backend.replay(run.id, 0);
    expect(all.gap).toBe(false);
    expect(all.events[0]?.seq).toBe(1);
    const tail = backend.replay(run.id, all.cursor - 2);
    expect(tail.events.length).toBe(2);
    expect(backend.replay(run.id, all.cursor).events.length).toBe(0);
    // force retention overflow
    for (let i = 0; i < 260; i++)
      (backend as unknown as { emit: (r: unknown, t: string) => void }).emit(
        backend.getRun(run.id),
        'run.log',
      );
    const old = backend.replay(run.id, 1);
    expect(old.gap).toBe(true);
    expect(old.snapshot.id).toBe(run.id);
  });

  it('a newer selected revision is not overwritten by an older run', () => {
    const p = backend.listProjects()[0]!;
    const detail = backend.getProject(p.id).project;
    const selectedBefore = detail.selectedArtifactId!;
    const wf = detail.workflowId;
    const run = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => isTerminal(backend.getRun(run.id).status));
    const after = backend.getProject(p.id).project.selectedArtifactId!;
    const sel = backend.getArtifact(after);
    const prev = backend.getArtifact(selectedBefore);
    expect(sel.lineageId).toBe(prev.lineageId);
    expect(sel.revision).toBeGreaterThan(prev.revision);
    // user picks an explicit older revision; a later run must not override it
    backend.selectArtifact(p.id, selectedBefore);
    const run2 = backend.startRun({ projectId: p.id, workflowId: wf, operationId: opId() });
    runUntil(() => isTerminal(backend.getRun(run2.id).status));
    expect(backend.getProject(p.id).project.selectedArtifactId).toBe(selectedBefore);
  });
});

describe('persistence and recovery', () => {
  it('continues a run after reload from the persisted scheduler', async () => {
    const store = await openDemoStore({ memory: true });
    const { backend: b1 } = await boot(true, store);
    await b1.signIn('mai@lumen.demo');
    const p = b1.listProjects()[0]!;
    const run = b1.startRun({
      projectId: p.id,
      workflowId: b1.getProject(p.id).project.workflowId,
      operationId: opId(),
    });
    clock.advance(200);
    expect(b1.getRun(run.id).status).toBe('running');
    await b1.persistNow();
    b1.scheduler.dispose(); // simulate tab close
    clock.advance(30_000); // time passes while closed
    const { backend: b2 } = await boot(true, store);
    const r = b2.getRun(run.id);
    expect(r.status).toBe('completed');
    expect(b2.listRuns(p.id).length).toBe(1); // no duplicate execution
  });
});

describe('billing', () => {
  it('reconciles a checkout once regardless of repeated callbacks', () => {
    const c = backend.createCheckout({
      planId: 'team',
      interval: 'yearly',
      returnTo: '/app/settings/billing',
      operationId: 'chk-op',
    });
    expect(
      backend.createCheckout({ planId: 'team', interval: 'yearly', returnTo: '/app', operationId: 'chk-op' })
        .id,
    ).toBe(c.id);
    // success=true style: reconcile before the provider confirmed → still open, no entitlement
    expect(backend.reconcile(c.id).subscription.planId).toBe('studio');
    backend.simulateOutcome(c.id, 'success');
    const invoicesBefore = backend.invoices().length;
    const a = backend.reconcile(c.id);
    const b = backend.reconcile(c.id);
    expect(a.subscription.planId).toBe('team');
    expect(b.subscription.planId).toBe('team');
    expect(backend.invoices().length).toBe(invoicesBefore + 1);
    expect(b.checkout.callbacks).toBe(3);
    // repeated outcome clicks do nothing
    expect(backend.simulateOutcome(c.id, 'cancel').status).toBe('succeeded');
  });
  it('delayed confirmation grants entitlement only after the callback', () => {
    const c = backend.createCheckout({
      planId: 'team',
      interval: 'monthly',
      returnTo: '/app',
      operationId: opId(),
    });
    backend.simulateOutcome(c.id, 'delayed');
    expect(backend.reconcile(c.id).checkout.status).toBe('pending_confirmation');
    expect(backend.subscription().planId).toBe('studio');
    clock.advance(5000);
    expect(backend.reconcile(c.id).checkout.status).toBe('succeeded');
    expect(backend.subscription().planId).toBe('team');
  });
  it('declined and cancelled checkouts grant nothing', () => {
    const c = backend.createCheckout({
      planId: 'team',
      interval: 'monthly',
      returnTo: '/app',
      operationId: opId(),
    });
    backend.simulateOutcome(c.id, 'decline');
    expect(backend.reconcile(c.id).checkout.status).toBe('failed');
    expect(backend.subscription().planId).toBe('studio');
  });
  it('blocks runs beyond the credit allowance', () => {
    backend.subscription().creditsUsed = backend.subscription().creditsIncluded - 1;
    const p = backend.listProjects()[0]!;
    expect(() =>
      backend.startRun({
        projectId: p.id,
        workflowId: backend.getProject(p.id).project.workflowId,
        operationId: opId(),
      }),
    ).toThrow(/credits/);
  });
});

describe('projects and workflows', () => {
  it('enforces optimistic revisions on workflow and scene saves', () => {
    const p = backend.listProjects()[0]!;
    const detail = backend.getProject(p.id);
    const wf = backend.getWorkflow(detail.project.workflowId);
    const saved = backend.saveWorkflow(
      { ...wf, nodes: wf.nodes.map((n) => ({ ...n, position: { x: n.position.x + 10, y: n.position.y } })) },
      wf.revision,
    );
    expect(saved.revision).toBe(wf.revision + 1);
    expect(() => backend.saveWorkflow(wf, wf.revision)).toThrow(/changed elsewhere/);
    const rev = detail.sceneRevisions.at(-1)!;
    const r2 = backend.saveScene(p.id, {
      scene: rev.scene,
      ad: { ...rev.ad, headline: 'New' },
      baseRevision: detail.project.sceneRevision,
      source: 'manual',
    });
    expect(r2.revision).toBe(2);
    expect(() =>
      backend.saveScene(p.id, { scene: rev.scene, ad: rev.ad, baseRevision: 1, source: 'manual' }),
    ).toThrow(/saved elsewhere/);
  });
  it('duplicate is idempotent and delete removes dependants', async () => {
    const p = backend.listProjects()[0]!;
    const d1 = backend.duplicateProject(p.id, 'dup-1');
    const d2 = backend.duplicateProject(p.id, 'dup-1');
    expect(d1.id).toBe(d2.id);
    await backend.removeProject(d1.id);
    expect(() => backend.getProject(d1.id)).toThrow(/does not exist/);
  });
  it('rejects bad uploads with the file name and reason', async () => {
    scenario = 'upload-reject';
    const big = new Blob([new Uint8Array(300 * 1024)], { type: 'image/png' });
    await expect(
      backend.createProject({
        operationId: opId(),
        name: 'x',
        productName: 'y',
        productDescription: '',
        brief: { goal: 'g', audience: 'a', tone: 'clean', aspects: ['1:1'], keyMessage: 'k' },
        reference: { source: 'upload', file: big, name: 'big.png', fixtureId: 'serum-bottle' },
      }),
    ).rejects.toThrow(/big.png/);
    const txt = new Blob(['hello'], { type: 'text/plain' });
    await expect(
      backend.createProject({
        operationId: opId(),
        name: 'x',
        productName: 'y',
        productDescription: '',
        brief: { goal: 'g', audience: 'a', tone: 'clean', aspects: ['1:1'], keyMessage: 'k' },
        reference: { source: 'upload', file: txt, name: 'notes.txt', fixtureId: 'serum-bottle' },
      }),
    ).rejects.toThrow(/not an image/);
  });
});
