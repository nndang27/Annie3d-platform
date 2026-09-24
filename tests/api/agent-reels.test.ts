// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from './client';

const FAST = { 'x-annie3d-sim-speed': '0.02' };

async function exampleBoard(c: Client) {
  const { starterGraph, STARTERS } = await import('../../packages/contracts/src/index');
  const { FIXTURE_FOR_STARTER, FIXTURE_MANIFEST, uuidFromHash } = await import('../../fixtures/index');
  const nodes: any[] = [];
  const edges: any[] = [];
  for (const [row, s] of STARTERS.entries()) {
    const g = starterGraph(s, { x: 0, y: row * 900 });
    const photoId = uuidFromHash(
      FIXTURE_MANIFEST.products[FIXTURE_FOR_STARTER[s]].files['photo.png']!.sha256,
    );
    for (const { version: _v, currentVersionId: _c, ...n } of g.nodes)
      nodes.push(n.kind === 'photo' ? { ...n, settings: { ...n.settings, assetId: photoId } } : n);
    edges.push(...g.edges);
  }
  return (
    await c.json('/api/boards', {
      method: 'POST',
      json: { title: 'Agent board', starter: 'blank', fromGuest: { nodes, edges } },
    })
  ).body;
}

/** POSTs a message and collects the SSE events. */
async function say(c: Client, boardId: string, content: string, nodeIds: string[] = [], budgetCredits = 100) {
  const res = await c.req(`/api/boards/${boardId}/agent/messages`, {
    method: 'POST',
    headers: FAST,
    json: { content, budgetCredits, context: { nodeIds } },
  });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const text = await res.text();
  return text
    .split('\n\n')
    .map((b) =>
      b
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join(''),
    )
    .filter(Boolean)
    .map((d) => JSON.parse(d));
}

describe('agent (F7)', () => {
  let c: Client;
  let board: any;
  beforeAll(async () => {
    c = await Client.signedUp('Agent user');
    board = await exampleBoard(c);
  }, 60_000);

  it('asks instead of guessing when several nodes match', async () => {
    const ev = await say(c, board.board.id, 'make the stage darker');
    expect(ev[0].type).toBe('thread');
    expect(ev.filter((e) => e.type === 'ops')).toHaveLength(0);
    expect(
      ev
        .filter((e) => e.type === 'text')
        .map((e) => e.delta)
        .join(''),
    ).toMatch(/3 Stage nodes/);
    expect(ev.at(-1)).toEqual({ type: 'done', usage: { credits: 0 } });
  });

  it('edits the selected line through the op log and starts a run within budget', async () => {
    const stage = board.nodes.find((n: any) => n.kind === 'stage');
    const before = board.board.seq;
    const ev = await say(c, board.board.id, 'use the velvet look and run it', [stage.id]);
    const ops = ev.filter((e) => e.type === 'ops');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ applied: true, label: expect.stringContaining('Velvet') });
    expect(ops[0].seq).toBeGreaterThan(before);
    const run = ev.find((e) => e.type === 'run');
    expect(run?.runId).toBeTruthy();
    expect(ev.at(-1)).toMatchObject({ type: 'done', usage: { credits: 22 } });
    const snap = await c.json(`/api/boards/${board.board.id}`);
    expect(snap.body.nodes.find((n: any) => n.id === stage.id).settings.look).toBe('velvet');
  });

  it('refuses a run over the message budget and says so', async () => {
    const video = board.nodes.find((n: any) => n.kind === 'adVideo');
    // wait for the previous run to finish (one active run per board)
    for (let i = 0; i < 60; i++) {
      const runs = await c.json(`/api/boards/${board.board.id}/runs`);
      if (!runs.body.runs.some((r: any) => ['queued', 'running'].includes(r.status))) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const ev = await say(c, board.board.id, 'make it 6 seconds and render', [video.id], 5);
    expect(ev.find((e) => e.type === 'run')).toBeUndefined();
    expect(
      ev
        .filter((e) => e.type === 'text')
        .map((e) => e.delta)
        .join(''),
    ).toMatch(/needs \d+ credits, more than this message's budget of 5/);
  }, 60_000);

  it('keeps the thread with applied edits for history', async () => {
    const threads = await c.json(`/api/boards/${board.board.id}/agent/threads`);
    expect(threads.body.threads.length).toBeGreaterThan(0);
    const msgs = await c.json(`/api/agent/threads/${threads.body.threads[0].id}/messages`);
    expect(
      msgs.body.messages.some(
        (m: any) => m.role === 'assistant' && m.parts.some((p: any) => p.type === 'ops'),
      ),
    ).toBe(true);
  });
});

describe('process reels (F12)', () => {
  it('registers a browser-recorded reel for a finished run', async () => {
    const c = await Client.signedUp('Reeler');
    const board = await exampleBoard(c);
    const stage = board.nodes.find((n: any) => n.kind === 'stage');
    await c.json(`/api/boards/${board.board.id}/ops`, {
      method: 'POST',
      json: {
        opId: randomUUID(),
        ops: [{ type: 'node.update', id: stage.id, patch: { settings: { look: 'velvet' } } }],
      },
    });
    const run = await c.json(`/api/boards/${board.board.id}/runs`, {
      method: 'POST',
      headers: FAST,
      json: { idempotencyKey: randomUUID(), nodeId: stage.id, scope: 'node' },
    });
    expect(
      (
        await c.json(`/api/runs/${run.body.id}/reels`, {
          method: 'POST',
          json: { mode: 'client', assetId: randomUUID() },
        })
      ).status,
    ).toBe(409);
    for (let i = 0; i < 60; i++) {
      if ((await c.json(`/api/runs/${run.body.id}`)).body.status === 'succeeded') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    // A tiny WebM (EBML header) stands in for the MediaRecorder output.
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2048, 1)]);
    const up = await c.json('/api/assets/uploads', {
      method: 'POST',
      json: {
        kind: 'video',
        filename: 'reel.webm',
        mime: 'video/webm',
        byteSize: webm.length,
        sha256: createHash('sha256').update(webm).digest('hex'),
      },
    });
    await fetch(up.body.url, { method: 'PUT', headers: up.body.headers, body: webm });
    expect(
      (await c.json(`/api/assets/${up.body.assetId}/complete`, { method: 'POST', json: {} })).status,
    ).toBe(200);
    const reel = await c.json(`/api/runs/${run.body.id}/reels`, {
      method: 'POST',
      json: { mode: 'client', assetId: up.body.assetId },
    });
    expect(reel.status).toBe(201);
    expect(reel.body).toMatchObject({ status: 'ready', asset: { kind: 'video', mime: 'video/webm' } });
    expect((await c.json(`/api/runs/${run.body.id}/reels`)).body.reels).toHaveLength(1);
    expect(
      (await c.json(`/api/runs/${run.body.id}/reels`, { method: 'POST', json: { mode: 'server' } })).status,
    ).toBe(501);
  }, 60_000);
});
