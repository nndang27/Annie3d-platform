// @vitest-environment node
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../client';
import { grant, openAccount, reserve, settle } from '../ledger';

/**
 * Runs against a real, disposable Neon branch (DATABASE_TEST_URL) — never against dev or
 * production. Each connection is its own pg client so concurrency is real.
 */
const url = process.env.DATABASE_TEST_URL;
const d = url ? describe : describe.skip;

const clients: { db: Db; end: () => Promise<void> }[] = [];
async function conn(): Promise<Db> {
  const { db, client } = createDb(url!);
  await client.connect();
  clients.push({ db, end: () => client.end() });
  return db;
}
async function one<T = Record<string, unknown>>(db: Db, q: ReturnType<typeof sql>): Promise<T> {
  return (await db.execute(q)).rows[0] as T;
}
async function fixture(db: Db) {
  const user = await one<{ id: string }>(db, sql`INSERT INTO users (name, email) VALUES ('Test', ${`t-${crypto.randomUUID()}@example.com`}) RETURNING id`);
  const ws = await one<{ id: string }>(db, sql`INSERT INTO workspaces (name, created_by) VALUES ('WS', ${user.id}) RETURNING id`);
  const board = await one<{ id: string }>(db, sql`INSERT INTO boards (workspace_id, title) VALUES (${ws.id}, 'B') RETURNING id`);
  return { userId: user.id, wsId: ws.id, boardId: board.id };
}
async function run(db: Db, boardId: string, wsId: string) {
  return (await one<{ id: string }>(db, sql`INSERT INTO runs (board_id, workspace_id, scope, estimated_credits, idempotency_key) VALUES (${boardId}, ${wsId}, 'all', 5, uuidv7()) RETURNING id`)).id;
}
async function node(db: Db, boardId: string, wsId: string, kind = 'model3d', zKey = 'a0') {
  return one<{ id: string }>(db, sql`INSERT INTO board_nodes (id, board_id, workspace_id, kind, x, y, z_key) VALUES (uuidv7(), ${boardId}, ${wsId}, ${kind}, 0, 0, ${zKey}) RETURNING id`);
}
async function expectPgError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => {
    const err = (e as { cause?: { code?: string }; code?: string });
    return (err.cause?.code ?? err.code) === code;
  });
}

d('database (live Neon test branch)', () => {
  let db: Db;
  beforeAll(async () => {
    db = await conn();
  });
  afterAll(async () => {
    await Promise.all(clients.map((c) => c.end()));
  });

  it('never overdraws credits under 20 concurrent reservations', async () => {
    const { wsId, boardId } = await fixture(db);
    await openAccount(db, wsId, 60, `free:${wsId}`);
    const conns = await Promise.all(Array.from({ length: 20 }, () => conn()));
    const runIds = await Promise.all(conns.map(() => run(db, boardId, wsId)));
    const results = await Promise.all(conns.map((c, i) => reserve(c, wsId, runIds[i]!, 5)));
    expect(results.filter((r) => r.ok)).toHaveLength(12);
    const acc = await one<{ balance: string; reserved: string }>(db, sql`SELECT balance, reserved FROM credit_accounts WHERE workspace_id = ${wsId}`);
    expect([Number(acc.balance), Number(acc.reserved)]).toEqual([60, 60]);
    for (let i = 0; i < 12; i++) await settle(db, wsId, runIds[i]!, 5, 3);
    const after = await one<{ balance: string; reserved: string }>(db, sql`SELECT balance, reserved FROM credit_accounts WHERE workspace_id = ${wsId}`);
    expect([Number(after.balance), Number(after.reserved)]).toEqual([24, 0]);
  });

  it('applies a payment grant once even when the webhook arrives twice at the same time', async () => {
    const { wsId } = await fixture(db);
    await openAccount(db, wsId, 0, null);
    const [a, b] = await Promise.all([conn(), conn()]);
    const ref = `evt_${crypto.randomUUID()}`;
    const r = await Promise.allSettled([grant(a, wsId, 100, 'purchase', ref, null), grant(b, wsId, 100, 'purchase', ref, null)]);
    const acc = await one<{ balance: string }>(db, sql`SELECT balance FROM credit_accounts WHERE workspace_id = ${wsId}`);
    expect(Number(acc.balance)).toBe(100);
    expect(r.some((x) => x.status === 'fulfilled' && x.value.ok)).toBe(true);
  });

  it('keeps the ledger append-only but lets a workspace delete cascade', async () => {
    const { wsId } = await fixture(db);
    await openAccount(db, wsId, 10, null);
    await expectPgError(db.execute(sql`UPDATE credit_entries SET amount = 999 WHERE workspace_id = ${wsId}`), '23001');
    await expectPgError(db.execute(sql`DELETE FROM credit_entries WHERE workspace_id = ${wsId}`), '23001');
    await db.execute(sql`DELETE FROM workspaces WHERE id = ${wsId}`);
    const left = await one<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM credit_entries WHERE workspace_id = ${wsId}`);
    expect(left.n).toBe(0);
  });

  it('rejects a negative balance at the table level', async () => {
    const { wsId } = await fixture(db);
    await openAccount(db, wsId, 5, null);
    await expectPgError(db.execute(sql`UPDATE credit_accounts SET balance = -1 WHERE workspace_id = ${wsId}`), '23514');
  });

  it('dedupes ready assets by content hash per workspace', async () => {
    const { wsId } = await fixture(db);
    const sha = 'a'.repeat(64);
    const ins = (key: string, status: string) =>
      db.execute(sql`INSERT INTO assets (workspace_id, kind, mime, byte_size, sha256, bucket, storage_key, status) VALUES (${wsId}, 'image', 'image/png', 10, ${sha}, 'uploads', ${key}, ${status})`);
    await ins(`k-${crypto.randomUUID()}`, 'ready');
    await ins(`k-${crypto.randomUUID()}`, 'pending');
    await expectPgError(ins(`k-${crypto.randomUUID()}`, 'ready'), '23505');
    await expectPgError(
      db.execute(sql`INSERT INTO assets (workspace_id, kind, mime, byte_size, sha256, bucket, storage_key) VALUES (${wsId}, 'image', 'image/png', 10, 'not-a-hash', 'uploads', ${`k-${crypto.randomUUID()}`})`),
      '23514',
    );
  });

  it('enforces live edge uniqueness, no self loops, and object-shaped settings', async () => {
    const { wsId, boardId } = await fixture(db);
    const a = await node(db, boardId, wsId, 'photo');
    const b = await node(db, boardId, wsId, 'model3d', 'a1');
    const edge = () => db.execute(sql`INSERT INTO board_edges (id, board_id, workspace_id, source_node_id, target_node_id, target_port) VALUES (uuidv7(), ${boardId}, ${wsId}, ${a.id}, ${b.id}, 'images')`);
    await edge();
    await expectPgError(edge(), '23505');
    await db.execute(sql`UPDATE board_edges SET deleted_at = now() WHERE source_node_id = ${a.id}`);
    await edge(); // allowed again once the old edge is a tombstone
    await expectPgError(db.execute(sql`INSERT INTO board_edges (id, board_id, workspace_id, source_node_id, target_node_id, target_port) VALUES (uuidv7(), ${boardId}, ${wsId}, ${a.id}, ${a.id}, 'images')`), '23514');
    await expectPgError(db.execute(sql`UPDATE board_nodes SET settings = '[1,2]'::jsonb WHERE id = ${a.id}`), '23514');
  });

  it('only accepts a current version that belongs to the node', async () => {
    const { wsId, boardId } = await fixture(db);
    const a = await node(db, boardId, wsId);
    const b = await node(db, boardId, wsId, 'model3d', 'a1');
    const v = await one<{ id: string }>(db, sql`INSERT INTO node_versions (node_id, board_id, workspace_id, version_no, source) VALUES (${b.id}, ${boardId}, ${wsId}, 1, 'run') RETURNING id`);
    await expectPgError(db.execute(sql`UPDATE board_nodes SET current_version_id = ${v.id} WHERE id = ${a.id}`), '23503');
    await db.execute(sql`UPDATE board_nodes SET current_version_id = ${v.id} WHERE id = ${b.id}`);
    await expectPgError(db.execute(sql`INSERT INTO node_versions (node_id, board_id, workspace_id, version_no, source) VALUES (${b.id}, ${boardId}, ${wsId}, 1, 'run')`), '23505');
  });

  it('makes op batches idempotent per board and orders z-keys byte-wise', async () => {
    const { wsId, boardId } = await fixture(db);
    const opId = crypto.randomUUID();
    await db.execute(sql`INSERT INTO board_ops (board_id, seq, op_id, ops) VALUES (${boardId}, 1, ${opId}, '[]'::jsonb)`);
    await expectPgError(db.execute(sql`INSERT INTO board_ops (board_id, seq, op_id, ops) VALUES (${boardId}, 2, ${opId}, '[]'::jsonb)`), '23505');
    for (const k of ['a0V', 'Zz', 'a0', 'a1']) await node(db, boardId, wsId, 'note', k);
    const order = (await db.execute<{ z_key: string }>(sql`SELECT z_key FROM board_nodes WHERE board_id = ${boardId} ORDER BY z_key`)).rows.map((r) => r.z_key);
    expect(order).toEqual(['Zz', 'a0', 'a0V', 'a1']);
  });

  it('maintains updated_at in the database', async () => {
    const { boardId } = await fixture(db);
    const before = await one<{ updated_at: Date }>(db, sql`SELECT updated_at FROM boards WHERE id = ${boardId}`);
    await new Promise((r) => setTimeout(r, 20));
    await db.execute(sql`UPDATE boards SET title = 'Renamed' WHERE id = ${boardId}`);
    const after = await one<{ updated_at: Date }>(db, sql`SELECT updated_at FROM boards WHERE id = ${boardId}`);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });
});
