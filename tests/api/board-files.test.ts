// @vitest-environment node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { Client } from './client';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const MIME = { 'content-type': 'application/vnd.annie3d+zip' };

function manifest(files: { nodeId: string; files: unknown[] }[], nodes: { id: string; kind: string }[]) {
  return {
    format: 'annie3d',
    version: 2,
    exportedAt: new Date().toISOString(),
    title: 'Board file',
    nodes: nodes.map((n, i) => ({ ...n, x: i * 400, y: 0, label: null, settings: {} })),
    edges: [],
    outputs: files,
  };
}

async function board(c: Client) {
  return (await c.json('/api/boards', { method: 'POST', json: { title: 'Target' } })).body.board.id as string;
}

describe('.annie3d files on the server', () => {
  it('refuses a zip bomb: a deflated asset is rejected before anything is read', async () => {
    const c = await Client.signedUp();
    const id = randomUUID();
    const m = manifest(
      [
        {
          nodeId: id,
          files: [{ path: 'assets/a.png', kind: 'image', mime: 'image/png', role: 'primary', variants: [] }],
        },
      ],
      [{ id, kind: 'photo' }],
    );
    // 200 MB of zeros deflate to about 200 KB.
    const zeros = new Uint8Array(200 * 1024 * 1024);
    const bomb = zipSync({
      'annie3d.json': strToU8(JSON.stringify(m)),
      'assets/a.png': [zeros, { level: 9 }],
    });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    const r = await c.json(`/api/boards/${await board(c)}/import`, {
      method: 'POST',
      headers: MIME,
      body: bomb,
    });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/compressed/);
  });

  it('refuses a file whose asset does not match the checksum its name claims', async () => {
    const c = await Client.signedUp();
    const id = randomUUID();
    const bytes = randomBytes(4096);
    const lie = sha(randomBytes(16));
    const m = manifest(
      [
        {
          nodeId: id,
          files: [
            { path: `assets/${lie}.png`, kind: 'image', mime: 'image/png', role: 'primary', variants: [] },
          ],
        },
      ],
      [{ id, kind: 'photo' }],
    );
    const zip = zipSync({
      'annie3d.json': strToU8(JSON.stringify(m)),
      [`assets/${lie}.png`]: [bytes, { level: 0 }],
    });
    const r = await c.json(`/api/boards/${await board(c)}/import`, {
      method: 'POST',
      headers: MIME,
      body: zip,
    });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/checksum/);
  });

  it('imports through R2 (the path for files over 80 MB) and rebuilds Export bundles', async () => {
    const c = await Client.signedUp();
    const [photo, exp] = [randomUUID(), randomUUID()];
    const png = randomBytes(300_000);
    const glb = randomBytes(200_000);
    const [pngPath, glbPath] = [`assets/${sha(png)}.png`, `assets/${sha(glb)}.glb`];
    const m = manifest(
      [
        {
          nodeId: photo,
          files: [{ path: pngPath, kind: 'image', mime: 'image/png', role: 'primary', variants: [] }],
        },
        {
          nodeId: exp,
          files: [
            {
              path: 'assets/bundle.zip',
              kind: 'file',
              mime: 'application/zip',
              role: 'primary',
              variants: [],
              bundle: [
                { name: 'serum-image-1.png', path: pngPath },
                { name: 'serum-web.glb', path: glbPath },
              ],
            },
          ],
        },
      ],
      [
        { id: photo, kind: 'photo' },
        { id: exp, kind: 'export' },
      ],
    );
    const file = zipSync({
      'annie3d.json': strToU8(JSON.stringify(m)),
      [pngPath]: [png, { level: 0 }],
      [glbPath]: [glb, { level: 0 }],
    });
    const boardId = await board(c);
    const up = await c.json(`/api/boards/${boardId}/import-upload`, {
      method: 'POST',
      json: { byteSize: file.length },
    });
    expect(up.status).toBe(201);
    expect(up.body.parts).toHaveLength(1);
    const put = await fetch(up.body.parts[0].url, { method: 'PUT', body: file });
    expect(put.status).toBe(200);
    const done = await c.json(`/api/boards/${boardId}/import-upload/complete?x=0&y=0`, {
      method: 'POST',
      json: { uploadId: up.body.uploadId, parts: [{ partNumber: 1, etag: put.headers.get('etag') }] },
    });
    expect(done.status).toBe(201);
    expect(done.body.nodeIds).toHaveLength(2);
    // The bundle came back as a real ZIP holding the same bytes.
    const zipOut = done.body.versions.find(
      (v: { outputs: { mime: string }[] }) => v.outputs[0].mime === 'application/zip',
    );
    const res = await c.req(zipOut.outputs[0].urls.original);
    expect(res.status).toBe(200);
    const inner = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(inner).sort()).toEqual(['serum-image-1.png', 'serum-web.glb']);
    expect(sha(inner['serum-web.glb']!)).toBe(sha(glb));
    // The temporary upload is gone; importing it again fails.
    const again = await c.json(`/api/boards/${boardId}/import-upload/complete`, {
      method: 'POST',
      json: { uploadId: up.body.uploadId, parts: [{ partNumber: 1, etag: put.headers.get('etag') }] },
    });
    expect(again.status).toBeGreaterThanOrEqual(400);
  });
});
