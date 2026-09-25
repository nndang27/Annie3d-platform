// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { Client } from './client';

/** A one-photo `.annie3d` file whose photo bytes are `photo`. */
function boardFile(photo: Uint8Array) {
  const nodeId = randomUUID();
  const manifest = {
    format: 'annie3d',
    version: 1,
    exportedAt: new Date().toISOString(),
    title: 'Desk file',
    nodes: [{ id: nodeId, kind: 'photo', x: 0, y: 0, label: 'Photo', settings: {} }],
    edges: [],
    outputs: [
      {
        nodeId,
        files: [
          { path: 'assets/photo.png', kind: 'image', mime: 'image/png', role: 'primary', variants: [] },
        ],
      },
    ],
  };
  return zipSync({
    'annie3d.json': strToU8(JSON.stringify(manifest)),
    'assets/photo.png': [photo, { level: 0 }],
  });
}

async function importInto(c: Client, boardId: string, file: Uint8Array) {
  const r = await c.json(`/api/boards/${boardId}/import?x=0&y=0`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.annie3d+zip' },
    body: file as BodyInit,
  });
  expect(r.status).toBe(201);
  return r.body.versions[0].outputs[0].urls.original as string;
}

const purge = (c: Client, now: Date) =>
  c.json('/api/test/purge-working-copies', { method: 'POST', json: { now: now.toISOString() } });

describe('desktop working copies', () => {
  it('are hidden from board lists and deleted with their files after they expire', async () => {
    const c = await Client.signedUp();
    const kept = await c.json('/api/boards', { method: 'POST', json: { title: 'Cloud board' } });
    const wc = await c.json('/api/boards', {
      method: 'POST',
      json: { title: 'Desk file', workingCopy: true },
    });
    expect(wc.status).toBe(201);
    const list = await c.json('/api/boards');
    const ids = list.body.boards.map((b: { id: string }) => b.id);
    expect(ids).toContain(kept.body.board.id);
    expect(ids).not.toContain(wc.body.board.id);

    // One photo only the working copy uses, one shared with the cloud board (same bytes).
    const own = await importInto(c, wc.body.board.id, boardFile(randomBytes(2048)));
    const sharedBytes = randomBytes(2048);
    const shared = await importInto(c, wc.body.board.id, boardFile(sharedBytes));
    await importInto(c, kept.body.board.id, boardFile(sharedBytes));
    expect((await c.req(own)).status).toBe(200);

    // Not expired yet: nothing happens.
    expect((await purge(c, new Date())).body.boardsDeleted).toBe(0);
    expect((await c.req(`/api/boards/${wc.body.board.id}`)).status).toBe(200);

    // Eight days later (TTL 7): the working copy and its own photo are gone, the shared one stays.
    const r = await purge(c, new Date(Date.now() + 8 * 24 * 3600 * 1000));
    expect(r.status).toBe(200);
    expect(r.body.boardsDeleted).toBeGreaterThanOrEqual(1);
    expect(r.body.assetsDeleted).toBeGreaterThanOrEqual(1);
    expect((await c.req(`/api/boards/${wc.body.board.id}`)).status).toBe(404);
    expect((await c.req(own)).status).toBe(404);
    expect((await c.req(shared)).status).toBe(200);
    expect((await c.req(`/api/boards/${kept.body.board.id}`)).status).toBe(200);
  });
});
