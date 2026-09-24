// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BASE, Client } from './client';

/**
 * Runs on the live stack: Worker + RunRoom Durable Object + simulator engines + Neon + R2.
 * The simulator is sped up with the dev-only `x-annie3d-sim-speed` header.
 */
const FAST = { 'x-annie3d-sim-speed': '0.02' };

interface Ev {
  type: string;
  seq: number;
  nodeId?: string;
  [k: string]: unknown;
}

/** Collects run events over the WebSocket until `run.finished` (or `until` matches). */
function listen(c: Client, runId: string, after = 0, until?: (e: Ev) => boolean) {
  const url = `${BASE.replace('http', 'ws')}/api/runs/${runId}/events?after=${after}`;
  // Node's WebSocket (undici) accepts headers; browsers send the cookie automatically.
  const ws = new WebSocket(url, { headers: { cookie: c.cookie, origin: BASE } } as never);
  const events: Ev[] = [];
  const done = new Promise<Ev[]>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout; got ${events.map((e) => e.type).join(',')}`)),
      90_000,
    );
    ws.onmessage = (m) => {
      const e = JSON.parse(String(m.data)) as Ev;
      events.push(e);
      if (e.type === 'run.finished' || until?.(e)) {
        clearTimeout(timer);
        ws.close();
        resolve(events);
      }
    };
    ws.onerror = () => reject(new Error('websocket error'));
  });
  return { ws, done, events };
}

async function start(c: Client, boardId: string, nodeId: string | null, scope: string, key = randomUUID()) {
  return c.json(`/api/boards/${boardId}/runs`, {
    method: 'POST',
    headers: FAST,
    json: { idempotencyKey: key, nodeId, scope },
  });
}

async function ops(c: Client, boardId: string, list: unknown[]) {
  const r = await c.json(`/api/boards/${boardId}/ops`, {
    method: 'POST',
    json: { opId: randomUUID(), ops: list },
  });
  expect([200, 201]).toContain(r.status);
  return r.body;
}

describe('runs (live stack)', () => {
  let a: Client;
  let boardId: string;
  let byKind: Record<string, string>;

  beforeAll(async () => {
    a = await Client.signedUp('Runner');
    const board = await a.json('/api/boards', {
      method: 'POST',
      json: { title: 'Run me', starter: 'splash-hero' },
    });
    boardId = board.body.board.id;
    byKind = Object.fromEntries(board.body.nodes.map((n: { kind: string; id: string }) => [n.kind, n.id]));
    // Attach a real photo to the Photo node (presigned upload + upload version).
    const png = readFileSync('fixtures/test-upload.png');
    const up = await a.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'image',
        filename: 'p.png',
        mime: 'image/png',
        byteSize: png.length,
        sha256: createHash('sha256').update(png).digest('hex'),
      },
    });
    if (up.body.mode === 'single') {
      await fetch(up.body.url, { method: 'PUT', headers: up.body.headers, body: png });
      await a.json(`/api/assets/${up.body.assetId}/complete`, { method: 'POST', json: {} });
    }
    const assetId = up.body.mode === 'existing' ? up.body.asset.id : up.body.assetId;
    await ops(a, boardId, [
      {
        type: 'node.update',
        id: byKind.photo,
        patch: { settings: { assetId }, currentVersionId: randomUUID() },
      },
    ]);
  }, 60_000);

  let firstRunId: string;
  it('runs the whole line, streams gap-free events and charges exactly the estimate', async () => {
    const r = await start(a, boardId, null, 'all');
    expect(r.status).toBe(201);
    expect(r.body.estimatedCredits).toBe(12 + 4 + 6 + 15 + 1);
    expect(r.body.steps).toHaveLength(5);
    firstRunId = r.body.id;
    const events = await listen(a, r.body.id).done;
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events[0]!.type).toBe('run.queued');
    const ok = events.filter((e) => e.type === 'step.succeeded');
    expect(ok).toHaveLength(5);
    expect(events.some((e) => e.type === 'step.progress')).toBe(true);
    const fin = events.at(-1)!;
    expect(fin).toMatchObject({ type: 'run.finished', status: 'succeeded', chargedCredits: 38 });
    // Model before packshot/stage, stage before video, video before export (topological order).
    const order = ok.map((e) => e.nodeId);
    expect(order.indexOf(byKind.model3d)).toBeLessThan(order.indexOf(byKind.stage));
    expect(order.indexOf(byKind.stage)).toBeLessThan(order.indexOf(byKind.adVideo));
    const pack = ok.find((e) => e.nodeId === byKind.packshot)! as unknown as {
      version: { outputs: unknown[] };
    };
    expect(pack.version.outputs).toHaveLength(4);

    const me = await a.json('/api/me');
    expect(me.body.credits).toEqual({ balance: 22, reserved: 0, freeRunAvailable: false });
    const snap = await a.json(`/api/boards/${boardId}`);
    for (const n of snap.body.nodes)
      if (['model3d', 'stage', 'packshot', 'adVideo', 'export'].includes(n.kind)) {
        expect(n.currentVersionId).toBeTruthy();
        expect(n.stale).toBe(false);
      }
    const model = snap.body.versions.find((v: { nodeId: string }) => v.nodeId === byKind.model3d);
    expect(model.outputs[0].urls.turntable).toContain('variant=turntable_mp4');
    const glb = await a.req(model.outputs[0].urls.original);
    expect(glb.status).toBe(200);
    expect(glb.headers.get('content-type')).toBe('model/gltf-binary');
  }, 120_000);

  it('replays exactly the missed events to a reconnecting client', async () => {
    const all = await listen(a, firstRunId).done;
    const tail = await listen(a, firstRunId, 3).done;
    expect(tail.map((e) => e.seq)).toEqual(all.slice(3).map((e) => e.seq));
  }, 60_000);

  it('an unchanged board is up to date: nothing is scheduled or charged', async () => {
    const est = await a.json(`/api/boards/${boardId}/runs/estimate`, {
      method: 'POST',
      json: { nodeId: null, scope: 'all' },
    });
    expect(est.body.totalCredits).toBe(0);
    expect(est.body.plan.every((p: { cached: boolean }) => p.cached)).toBe(true);
    const r = await start(a, boardId, null, 'all');
    expect(r.status).toBe(409);
    expect(r.body.error.details).toEqual({ upToDate: true });
  });

  it('changing a node re-runs only it and what depends on it', async () => {
    await ops(a, boardId, [
      { type: 'node.update', id: byKind.stage, patch: { settings: { look: 'dark-lab' } } },
    ]);
    const est = await a.json(`/api/boards/${boardId}/runs/estimate`, {
      method: 'POST',
      json: { nodeId: null, scope: 'all' },
    });
    expect(est.body.totalCredits).toBe(6 + 15 + 1);
    const r = await start(a, boardId, null, 'all');
    expect(r.body.steps).toHaveLength(3);
    const events = await listen(a, r.body.id).done;
    const fresh = events.filter((e) => e.type === 'step.succeeded' && !e.cached).map((e) => e.nodeId);
    expect(new Set(fresh)).toEqual(new Set([byKind.stage, byKind.adVideo, byKind.export]));
    expect((await a.json('/api/me')).body.credits.balance).toBe(0);
  }, 90_000);

  it('refuses a run the workspace cannot pay for (402) without holding credits', async () => {
    await ops(a, boardId, [
      { type: 'node.update', id: byKind.adVideo, patch: { settings: { durationSec: 6 } } },
    ]);
    const r = await start(a, boardId, byKind.adVideo, 'node');
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe('insufficient_credits');
    expect(r.body.error.details).toMatchObject({ available: 0 });
    expect((await a.json('/api/me')).body.credits.reserved).toBe(0);
  });

  it('a failed quality gate refunds the step and skips what depends on it', async () => {
    const co = await a.json('/api/billing/checkout', {
      method: 'POST',
      json: { planId: 'creator', returnUrl: `${BASE}/` },
    });
    await a.json(`/api/billing/simulated/confirm${new URL(co.body.checkoutUrl).search}`, {
      method: 'POST',
    });
    const before = (await a.json('/api/me')).body.credits.balance;
    await ops(a, boardId, [
      { type: 'node.update', id: byKind.model3d, patch: { settings: { prompt: 'glass bottle #fail' } } },
    ]);
    const r = await start(a, boardId, byKind.model3d, 'from_here');
    const events = await listen(a, r.body.id).done;
    const failed = events.find((e) => e.type === 'step.failed')!;
    expect(failed).toMatchObject({
      nodeId: byKind.model3d,
      code: 'gate_failed',
      gate: 'silhouette_iou',
      refundedCredits: 12,
    });
    expect(events.filter((e) => e.type === 'step.skipped').length).toBeGreaterThanOrEqual(3);
    expect(events.at(-1)).toMatchObject({ status: 'failed', chargedCredits: 0 });
    expect((await a.json('/api/me')).body.credits).toMatchObject({ balance: before, reserved: 0 });
  }, 90_000);

  it('cancel stops the run, charges only finished steps and releases the rest', async () => {
    await ops(a, boardId, [
      { type: 'node.update', id: byKind.model3d, patch: { settings: { prompt: 'glass bottle #slow' } } },
    ]);
    const before = (await a.json('/api/me')).body.credits.balance;
    const r = await a.json(`/api/boards/${boardId}/runs`, {
      method: 'POST',
      headers: { 'x-annie3d-sim-speed': '0.5' },
      json: { idempotencyKey: randomUUID(), nodeId: byKind.model3d, scope: 'from_here' },
    });
    const l = listen(a, r.body.id);
    await new Promise<void>((res) => {
      const t = setInterval(() => {
        if (l.events.some((e) => e.type === 'step.progress')) {
          clearInterval(t);
          res();
        }
      }, 50);
    });
    const cancel = await a.json(`/api/runs/${r.body.id}/cancel`, { method: 'POST' });
    expect(cancel.status).toBe(202);
    const events = await l.done;
    expect(events.at(-1)).toMatchObject({ type: 'run.finished', status: 'cancelled', chargedCredits: 0 });
    expect(events.some((e) => e.type === 'step.skipped' && e.reason === 'cancelled')).toBe(true);
    expect((await a.json('/api/me')).body.credits).toMatchObject({ balance: before, reserved: 0 });
  }, 90_000);

  it('is idempotent per key and allows one active run per board', async () => {
    await ops(a, boardId, [
      { type: 'node.update', id: byKind.model3d, patch: { settings: { prompt: 'glass bottle' } } },
    ]);
    const key = randomUUID();
    const one = await start(a, boardId, byKind.model3d, 'node', key);
    const two = await start(a, boardId, byKind.model3d, 'node', key);
    expect(two.body.id).toBe(one.body.id);
    const other = await start(a, boardId, byKind.model3d, 'node');
    expect(other.status).toBe(409);
    await listen(a, one.body.id).done;
    const me = (await a.json('/api/me')).body.credits;
    expect(me.reserved).toBe(0);
  }, 90_000);

  it('keeps runs private to their workspace', async () => {
    const eve = await Client.signedUp('Eve');
    expect((await eve.json(`/api/runs/${firstRunId}`)).status).toBe(404);
    expect((await eve.json(`/api/runs/${firstRunId}/cancel`, { method: 'POST' })).status).toBe(404);
    await expect(listen(eve, firstRunId).done).rejects.toThrow();
  }, 30_000);
});

describe('example board seeding (F1 for signed-in users)', () => {
  it('imports the example with rendered outputs as fresh versions, without copying files', async () => {
    const { starterGraph, STARTERS } = await import('../../packages/contracts/src/index');
    const { FIXTURE_FOR_STARTER, FIXTURE_MANIFEST, uuidFromHash } = await import('../../fixtures/index');
    const nodes = [];
    const edges = [];
    for (const [row, s] of STARTERS.entries()) {
      const g = starterGraph(s, { x: 0, y: row * 900 });
      const photoId = uuidFromHash(
        FIXTURE_MANIFEST.products[FIXTURE_FOR_STARTER[s]].files['photo.png']!.sha256,
      );
      for (const n of g.nodes) {
        const { version: _v, currentVersionId: _c, ...rest } = n;
        nodes.push(n.kind === 'photo' ? { ...rest, settings: { ...rest.settings, assetId: photoId } } : rest);
      }
      edges.push(...g.edges);
    }
    const c = await Client.signedUp('Newcomer');
    const t0 = Date.now();
    const r = await c.json('/api/boards', {
      method: 'POST',
      json: { title: 'Example board', starter: 'blank', fromGuest: { nodes, edges } },
    });
    const ms = Date.now() - t0;
    console.log(`example board create + seed: ${ms} ms`);
    expect(r.status).toBe(201);
    expect(r.body.versions).toHaveLength(3 + 3 * 5);
    expect(r.body.nodes.filter((n: { stale: boolean }) => n.stale)).toHaveLength(0);
    const pack = r.body.versions.find((v: { outputs: unknown[] }) => v.outputs.length === 4);
    expect(pack).toBeTruthy();
    // Served from the shared public fixture object through the workspace-scoped asset route.
    const img = await c.req(pack.outputs[0].urls.original);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    const est = await c.json(`/api/boards/${r.body.board.id}/runs/estimate`, {
      method: 'POST',
      json: { nodeId: null, scope: 'all' },
    });
    expect(est.body.totalCredits).toBe(0);
    expect((await c.json('/api/me')).body.credits.balance).toBe(60);
  }, 60_000);
});

describe('region edits (F8) and versions (F9)', () => {
  it('applies an instruction to selected faces as a new version, keeps the base, and can revert', async () => {
    const { starterGraph } = await import('../../packages/contracts/src/index');
    const { FIXTURE_MANIFEST, uuidFromHash } = await import('../../fixtures/index');
    const c = await Client.signedUp('Editor');
    const g = starterGraph('splash-hero');
    const photoId = uuidFromHash(FIXTURE_MANIFEST.products.serum.files['photo.png']!.sha256);
    const nodes = g.nodes.map(({ version: _v, currentVersionId: _c, ...n }) =>
      n.kind === 'photo' ? { ...n, settings: { ...n.settings, assetId: photoId } } : n,
    );
    const board = await c.json('/api/boards', {
      method: 'POST',
      json: { title: 'E', starter: 'blank', fromGuest: { nodes, edges: g.edges } },
    });
    const model = board.body.nodes.find((n: { kind: string }) => n.kind === 'model3d');
    const base = model.currentVersionId;
    const edit = (faces: number[], key = randomUUID()) =>
      c.json(`/api/boards/${board.body.board.id}/nodes/${model.id}/edits`, {
        method: 'POST',
        headers: FAST,
        json: {
          idempotencyKey: key,
          baseVersionId: base,
          selection: { faces },
          instruction: 'Make the cap matte black',
        },
      });
    const r = await edit(Array.from({ length: 60 }, (_, i) => i));
    expect(r.status).toBe(201);
    expect(r.body.estimatedCredits).toBe(4);
    const events = await listen(c, r.body.id).done;
    const ok = events.find((e) => e.type === 'step.succeeded') as unknown as {
      versionId: string;
      version: {
        source: string;
        parentVersionId: string;
        versionNo: number;
        outputs: { sha256: string; urls: { original: string; poster: string | null } }[];
      };
    };
    expect(ok.version).toMatchObject({ source: 'edit', parentVersionId: base, versionNo: 2 });
    expect(ok.version.outputs[0]!.urls.poster).toBeTruthy(); // inherits the base previews
    const snap = await c.json(`/api/boards/${board.body.board.id}`);
    const baseV = (await c.json(`/api/boards/${board.body.board.id}/nodes/${model.id}/versions`)).body
      .versions;
    expect(baseV.map((v: { versionNo: number }) => v.versionNo)).toEqual([2, 1]);
    const edited = baseV[0].outputs[0];
    const original = baseV[1].outputs[0];
    expect(edited.sha256).not.toBe(original.sha256);
    const glb = await c.req(edited.urls.original);
    expect(glb.status).toBe(200);
    expect(new TextDecoder().decode((await glb.arrayBuffer()).slice(0, 4))).toBe('glTF');
    // The edit keeps the node fresh (same inputs), so nothing downstream is forced to re-run by itself.
    expect(snap.body.nodes.find((n: { id: string }) => n.id === model.id).stale).toBe(false);
    // Revert (F9) is an ordinary op.
    const rev = await c.json(`/api/boards/${board.body.board.id}/nodes/${model.id}/select-version`, {
      method: 'POST',
      json: { versionId: base },
    });
    expect(rev.status).toBe(200);
    expect(
      (await c.json(`/api/boards/${board.body.board.id}`)).body.nodes.find(
        (n: { id: string }) => n.id === model.id,
      ).currentVersionId,
    ).toBe(base);
    // Faces outside the model fail the selection gate and are refunded.
    const bad = await edit([9_999_999]);
    const badEvents = await listen(c, bad.body.id).done;
    expect(badEvents.find((e) => e.type === 'step.failed')).toMatchObject({
      gate: 'selection',
      refundedCredits: 4,
    });
    expect((await c.json('/api/me')).body.credits).toMatchObject({ balance: 56, reserved: 0 });
  }, 90_000);
});
