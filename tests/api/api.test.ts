// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BASE, Client } from './client';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('API (live stack)', () => {
  let a: Client;
  let b: Client;
  let boardId: string;
  let snap: any;
  beforeAll(async () => {
    a = await Client.signedUp('Alice');
    b = await Client.signedUp('Bob');
  });

  it('health reaches the database', async () => {
    const r = await new Client().json('/api/health');
    expect(r.body.ok).toBe(true);
  });

  it('requires a session and returns uniform errors', async () => {
    const r = await new Client().json('/api/me');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('unauthenticated');
    const nf = await a.json('/api/nope');
    expect(nf.status).toBe(404);
  });

  it('provisions a workspace with the free credits on sign-up', async () => {
    const r = await a.json('/api/me');
    expect(r.body.workspace.role).toBe('owner');
    expect(r.body.credits).toEqual({ balance: 60, reserved: 0, freeRunAvailable: true });
  });

  it('creates a starter board and returns a full snapshot', async () => {
    const r = await a.json('/api/boards', {
      method: 'POST',
      json: { title: 'Splash', starter: 'splash-hero' },
    });
    expect(r.status).toBe(201);
    snap = r.body;
    boardId = snap.board.id;
    expect(snap.nodes).toHaveLength(7);
    expect(snap.edges).toHaveLength(7);
    expect(snap.board.seq).toBe(1);
  });

  it('isolates tenants: another user cannot read or edit the board', async () => {
    expect((await b.json(`/api/boards/${boardId}`)).status).toBe(404);
    const w = await b.json(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [{ type: 'node.move', moves: [{ id: snap.nodes[0].id, x: 1, y: 1 }] }],
      },
    });
    expect(w.status).toBe(404);
  });

  it('applies op batches idempotently and advances seq', async () => {
    const node = snap.nodes[0];
    const opId = randomUUID();
    const batch = { opId, ops: [{ type: 'node.move', moves: [{ id: node.id, x: 42, y: 7 }] }] };
    const first = await a.json(`/api/boards/${boardId}/ops`, { method: 'POST', json: batch });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ seq: 2, duplicate: false });
    const again = await a.json(`/api/boards/${boardId}/ops`, { method: 'POST', json: batch });
    expect(again.body).toEqual({ seq: 2, duplicate: true });
    const s = await a.json(`/api/boards/${boardId}`);
    const moved = s.body.nodes.find((n: any) => n.id === node.id);
    expect([moved.x, moved.y]).toEqual([42, 7]);
  });

  it('rejects invalid graphs authoritatively (type mismatch, stale baseVersion)', async () => {
    const text = snap.nodes.find((n: any) => n.kind === 'text');
    const model = snap.nodes.find((n: any) => n.kind === 'model3d');
    const bad = await a.json(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [
          {
            type: 'edge.create',
            edge: {
              id: randomUUID(),
              source: text.id,
              sourcePort: 'out',
              target: model.id,
              targetPort: 'images',
            },
          },
        ],
      },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.reason).toBe('type_mismatch');
    const stale = await a.json(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [{ type: 'node.update', id: model.id, patch: { label: 'X' }, baseVersion: 999 }],
      },
    });
    expect(stale.status).toBe(409);
  });

  it('undo through inverse ops restores a deleted node with its edges', async () => {
    const stage = snap.nodes.find((n: any) => n.kind === 'stage');
    const before = await a.json(`/api/boards/${boardId}`);
    const del = await a.json(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: { opId: randomUUID(), ops: [{ type: 'node.delete', ids: [stage.id] }] },
    });
    expect(del.status).toBe(201);
    const mid = await a.json(`/api/boards/${boardId}`);
    expect(mid.body.nodes.some((n: any) => n.id === stage.id)).toBe(false);
    const edges = before.body.edges.filter((e: any) => e.source === stage.id || e.target === stage.id);
    const undo = [
      {
        type: 'node.create',
        node: {
          id: stage.id,
          kind: 'stage',
          x: stage.x,
          y: stage.y,
          label: stage.label,
          settings: stage.settings,
          zKey: stage.zKey,
        },
      },
      ...edges.map((e: any) => ({ type: 'edge.create', edge: e })),
    ];
    const r = await a.json(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: { opId: randomUUID(), ops: undo },
    });
    expect(r.status).toBe(201);
    const after = await a.json(`/api/boards/${boardId}`);
    expect(after.body.nodes).toHaveLength(7);
    expect(after.body.edges).toHaveLength(7);
    const since = await a.json(`/api/boards/${boardId}/ops?after=1`);
    expect(since.body.ops.map((o: any) => o.seq)).toEqual([2, 3, 4]);
  });

  it('estimates credits for a full run', async () => {
    const r = await a.json(`/api/boards/${boardId}/runs/estimate`, {
      method: 'POST',
      json: { nodeId: null, scope: 'all' },
    });
    expect(r.status).toBe(200);
    expect(r.body.plan).toHaveLength(5);
    expect(r.body.totalCredits).toBe(12 + 4 + 6 + 15 + 1);
    expect(r.body.balance).toBe(60);
  });

  it('uploads a real PNG to R2 via a presigned URL, verifies it, dedupes and serves it with ETag', async () => {
    const png = readFileSync('fixtures/test-upload.png');
    const create = await a.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'image',
        filename: 'serum.png',
        mime: 'image/png',
        byteSize: png.length,
        sha256: sha(png),
      },
    });
    expect(create.status).toBe(201);
    expect(create.body.mode).toBe('single');
    const put = await fetch(create.body.url, { method: 'PUT', headers: create.body.headers, body: png });
    expect(put.status).toBe(200);
    const done = await a.json(`/api/assets/${create.body.assetId}/complete`, { method: 'POST', json: {} });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('ready');
    expect(done.body.width).toBeGreaterThan(0);
    const again = await a.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'image',
        filename: 'copy.png',
        mime: 'image/png',
        byteSize: png.length,
        sha256: sha(png),
      },
    });
    expect(again.body.mode).toBe('existing');
    const content = await a.req(`/api/assets/${create.body.assetId}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get('cache-control')).toContain('immutable');
    const etag = content.headers.get('etag')!;
    expect(Buffer.from(await content.arrayBuffer()).equals(png)).toBe(true);
    const cached = await a.req(`/api/assets/${create.body.assetId}/content`, {
      headers: { 'if-none-match': etag },
    });
    expect(cached.status).toBe(304);
    expect((await b.req(`/api/assets/${create.body.assetId}/content`)).status).toBe(404);
  });

  it('rejects a file whose bytes do not match its declared type', async () => {
    const fake = Buffer.from('this is not a png at all, just text pretending to be one');
    const create = await a.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'image',
        filename: 'fake.png',
        mime: 'image/png',
        byteSize: fake.length,
        sha256: sha(fake),
      },
    });
    await fetch(create.body.url, { method: 'PUT', headers: create.body.headers, body: fake });
    const done = await a.json(`/api/assets/${create.body.assetId}/complete`, { method: 'POST', json: {} });
    expect(done.status).toBe(400);
    expect(done.body.error.message).toMatch(/does not match/);
    const refused = await a.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'image',
        filename: 'x.exe',
        mime: 'application/x-msdownload',
        byteSize: 10,
        sha256: 'a'.repeat(64),
      },
    });
    expect(refused.status).toBe(415);
  });

  it('simulated checkout grants credits exactly once', async () => {
    const co = await a.json('/api/billing/checkout', {
      method: 'POST',
      json: { planId: 'creator', returnUrl: `${BASE}/` },
    });
    const path = `/api/billing/simulated/confirm${new URL(co.body.checkoutUrl).search}`;
    const one = await a.json(path, { method: 'POST' });
    const two = await a.json(path, { method: 'POST' });
    expect(one.body.duplicate).toBe(false);
    expect(two.body.duplicate).toBe(true);
    expect(two.body.balance).toBe(360);
    expect((await b.json(path, { method: 'POST' })).status).toBe(403);
  });
});

describe('byte ranges (video scrubbing)', () => {
  it('serves 206 with Content-Range only when a Range header is sent', async () => {
    const c = await Client.signedUp('Range');
    const png = readFileSync('fixtures/test-upload.png');
    const create = await c.json('/api/assets/uploads', {
      method: 'POST',
      json: { kind: 'image', filename: 'r.png', mime: 'image/png', byteSize: png.length, sha256: sha(png) },
    });
    await fetch(create.body.url, { method: 'PUT', headers: create.body.headers, body: png });
    await c.json(`/api/assets/${create.body.assetId}/complete`, { method: 'POST', json: {} });
    const part = await c.req(`/api/assets/${create.body.assetId}/content`, {
      headers: { range: 'bytes=0-99' },
    });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-99/${png.length}`);
    expect((await part.arrayBuffer()).byteLength).toBe(100);
  });
});
