// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Document, WebIO } from '../../apps/web/node_modules/@gltf-transform/core/dist/index.js';
import { BASE, Client } from './client';

const FAST = { 'x-annie3d-sim-speed': '0.02' };

/** A one-triangle GLB with no animation (fails Google Swirl's "animated" requirement). */
async function staticGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const pos = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos);
  const mesh = doc.createMesh('tri').addPrimitive(prim);
  doc.createScene().addChild(doc.createNode('n').setMesh(mesh));
  return new WebIO().writeBinary(doc);
}

async function exampleBoard(c: Client) {
  const { starterGraph } = await import('../../packages/contracts/src/index');
  const { FIXTURE_MANIFEST, uuidFromHash } = await import('../../fixtures/index');
  const g = starterGraph('splash-hero');
  const photoId = uuidFromHash(FIXTURE_MANIFEST.products.serum.files['photo.png']!.sha256);
  const nodes = g.nodes.map(({ version: _v, currentVersionId: _c, ...n }) =>
    n.kind === 'photo' ? { ...n, settings: { ...n.settings, assetId: photoId } } : n,
  );
  const r = await c.json('/api/boards', {
    method: 'POST',
    json: { title: 'Serum launch', starter: 'blank', fromGuest: { nodes, edges: g.edges } },
  });
  expect(r.status).toBe(201);
  return r.body;
}

describe('exports (F6)', () => {
  let c: Client;
  let board: any;
  beforeAll(async () => {
    c = await Client.signedUp('Exporter');
    board = await exampleBoard(c);
  }, 60_000);

  it('exports a model for each preset with a pass/fail report, idempotently', async () => {
    const model = board.nodes.find((n: any) => n.kind === 'model3d');
    const key = randomUUID();
    const web = await c.json('/api/exports', {
      method: 'POST',
      json: { idempotencyKey: key, nodeId: model.id, glbPreset: 'web' },
    });
    expect(web.status).toBe(201);
    expect(web.body.report).toMatchObject({ preset: 'web', passed: true });
    expect(web.body.report.checks.map((x: any) => x.id)).toEqual([
      'bytes',
      'triangles',
      'texture',
      'animation',
      'validator',
    ]);
    expect(web.body.files[0].mime).toBe('application/zip');
    expect(web.body.files.some((f: any) => f.mime === 'model/gltf-binary')).toBe(true);
    const again = await c.json('/api/exports', {
      method: 'POST',
      json: { idempotencyKey: key, nodeId: model.id, glbPreset: 'web' },
    });
    expect(again.body.id).toBe(web.body.id);
    const zip = await c.req(`${web.body.files[0].urls.original}?download=serum-web.zip`);
    expect(zip.headers.get('content-disposition')).toBe('attachment; filename="serum-web.zip"');
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
  });

  it('reports exactly which Google Swirl requirement a static model fails', async () => {
    const glb = await staticGlb();
    const up = await c.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'model3d',
        filename: 't.glb',
        mime: 'model/gltf-binary',
        byteSize: glb.length,
        sha256: createHash('sha256').update(glb).digest('hex'),
      },
    });
    await fetch(up.body.url, { method: 'PUT', headers: up.body.headers, body: glb });
    await c.json(`/api/assets/${up.body.assetId}/complete`, { method: 'POST', json: {} });
    const nodeId = randomUUID();
    const ops = await c.json(`/api/boards/${board.board.id}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [
          {
            type: 'node.create',
            node: { id: nodeId, kind: 'upload3d', x: 0, y: 2000, label: 'Static', settings: {}, zKey: 'z9' },
          },
          {
            type: 'node.update',
            id: nodeId,
            patch: { settings: { assetId: up.body.assetId }, currentVersionId: randomUUID() },
          },
        ],
      },
    });
    expect([200, 201]).toContain(ops.status);
    const r = await c.json('/api/exports', {
      method: 'POST',
      json: { idempotencyKey: randomUUID(), nodeId, glbPreset: 'google_swirl' },
    });
    expect(r.status).toBe(201);
    expect(r.body.report.passed).toBe(false);
    const failed = r.body.report.checks.filter((x: any) => !x.passed).map((x: any) => x.id);
    expect(failed).toEqual(['animation']);
  });

  it('an Export node run bundles the model, the ad video and the packshots into one zip', async () => {
    const pack = board.nodes.find((n: any) => n.kind === 'packshot');
    const exp = board.nodes.find((n: any) => n.kind === 'export');
    // The example's export version was seeded; change a setting so it really runs.
    await c.json(`/api/boards/${board.board.id}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [{ type: 'node.update', id: exp.id, patch: { settings: { glbPreset: 'google_merchant' } } }],
      },
    });
    // Also feed packshot images into the export (Starter lines wire model + video).
    await c.json(`/api/boards/${board.board.id}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [
          {
            type: 'edge.create',
            edge: {
              id: randomUUID(),
              source: pack.id,
              sourcePort: 'out',
              target: exp.id,
              targetPort: 'items',
            },
          },
        ],
      },
    });
    const run = await c.json(`/api/boards/${board.board.id}/runs`, {
      method: 'POST',
      headers: FAST,
      json: { idempotencyKey: randomUUID(), nodeId: exp.id, scope: 'node' },
    });
    expect(run.status).toBe(201);
    let v: any = null;
    for (let i = 0; i < 60 && !v; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const s = await c.json(`/api/runs/${run.body.id}`);
      if (s.body.status === 'succeeded') v = s.body;
      if (['failed', 'partial', 'cancelled'].includes(s.body.status))
        throw new Error(`run ${s.body.status}: ${JSON.stringify(s.body.steps)}`);
    }
    const snap = await c.json(`/api/boards/${board.board.id}`);
    const ver = snap.body.versions.find((x: any) => x.nodeId === exp.id);
    expect(ver.gates.every((g: any) => g.id.startsWith('google_merchant:') && g.passed)).toBe(true);
    const zip = ver.outputs.find((o: any) => o.mime === 'application/zip');
    const data = new Uint8Array(await (await c.req(zip.urls.original)).arrayBuffer());
    const text = new TextDecoder('latin1').decode(data);
    expect(text).toContain('-ad.mp4');
    expect(text).toContain('.glb');
    expect(text).toContain('-image-1.png');
  }, 60_000);
});

describe('shares (F10)', () => {
  let c: Client;
  let board: any;
  let share: any;
  beforeAll(async () => {
    c = await Client.signedUp('Mai Tran');
    board = await exampleBoard(c);
  }, 60_000);

  it('creates one link per board and serves a public payload with the hero video first', async () => {
    const r = await c.json('/api/shares', {
      method: 'POST',
      json: { targetType: 'board', targetId: board.board.id },
    });
    expect(r.status).toBe(201);
    share = r.body;
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(share.url).toBe(`${BASE}/s/${share.token}`);
    expect(
      (
        await c.json('/api/shares', {
          method: 'POST',
          json: { targetType: 'board', targetId: board.board.id },
        })
      ).body.id,
    ).toBe(share.id);
    const anon = new Client();
    const pub = await anon.json(`/api/public/shares/${share.token}`);
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ title: 'Serum launch', ownerName: 'Mai Tran', targetType: 'board' });
    expect(pub.body.assets[0].kind).toBe('video');
    const file = await anon.req(pub.body.assets[0].urls.original);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('video/mp4');
  });

  it('never serves assets outside the shared target', async () => {
    const other = await Client.signedUp('Other');
    const ob = await exampleBoard(other);
    const foreign = ob.versions[0].outputs[0].id;
    const r = await new Client().req(`/api/public/shares/${share.token}/assets/${foreign}/content`);
    expect(r.status).toBe(404);
  }, 60_000);

  it('renders an Open Graph page without JavaScript', async () => {
    const r = await new Client().req(`/s/${share.token}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('<meta property="og:title" content="Serum launch">');
    expect(html).toMatch(/<meta property="og:image" content="http:\/\/localhost:\d+\/api\/public\/shares\//);
    expect(html).toContain('og:video');
    expect(html).not.toContain('<script');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('revoking turns the link off everywhere', async () => {
    expect((await c.json(`/api/shares/${share.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await new Client().json(`/api/public/shares/${share.token}`)).status).toBe(404);
    expect((await new Client().req(`/s/${share.token}`)).status).toBe(404);
  });
  it('concurrent share requests yield one live link, and turning it off leaves none', async () => {
    // Opening the Share dialog twice at once (two tabs, or React StrictMode) sent two requests;
    // check-then-insert created two live links and "Turn off link" left the other public.
    const b = await exampleBoard(c);
    const make = () =>
      c.json('/api/shares', { method: 'POST', json: { targetType: 'board', targetId: b.board.id } });
    const made = await Promise.all(Array.from({ length: 6 }, make));
    expect(made.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    const tokens = new Set(made.map((r) => r.body.token));
    expect(tokens.size).toBe(1);
    expect((await c.json(`/api/shares/${made[0]!.body.id}`, { method: 'DELETE' })).status).toBe(200);
    for (const t of tokens) expect((await new Client().req(`/s/${t}`)).status).toBe(404);
  }, 60_000);
});

describe('hosted checkout (simulated provider)', () => {
  it('serves a signed checkout page and returns the browser to the app after paying', async () => {
    const c = await Client.signedUp('Payer');
    const co = await c.json('/api/billing/checkout', {
      method: 'POST',
      json: { planId: 'studio', returnUrl: `${BASE}/b/123?x=1` },
    });
    const url = new URL(co.body.checkoutUrl);
    expect(url.pathname).toBe('/billing/checkout');
    const pageRes = await c.req(url.pathname + url.search);
    const html = await pageRes.text();
    expect(html).toContain('Studio plan');
    expect(html).not.toContain('<script');
    const action = /action="([^"]+)"/.exec(html)![1]!.replace(/&amp;|&#38;/g, '&');
    const pay = await c.req(action, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    expect(pay.status).toBe(303);
    expect(pay.headers.get('location')).toBe('/b/123?x=1&checkout=success');
    expect((await c.json('/api/me')).body).toMatchObject({
      credits: { balance: 1060 },
      workspace: { plan: 'studio' },
    });
    expect((await c.req(`${url.pathname}?p=${url.searchParams.get('p')}&s=${'0'.repeat(64)}`)).status).toBe(
      400,
    );
  });

  it('never redirects to another origin', async () => {
    const c = await Client.signedUp('Payer2');
    const co = await c.json('/api/billing/checkout', {
      method: 'POST',
      json: { planId: 'creator', returnUrl: 'https://evil.example/steal' },
    });
    const url = new URL(co.body.checkoutUrl);
    const html = await (await c.req(url.pathname + url.search)).text();
    const action = /action="([^"]+)"/.exec(html)![1]!.replace(/&amp;|&#38;/g, '&');
    const pay = await c.req(action, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    expect(pay.headers.get('location')).toBe('/?checkout=success');
  });
});
