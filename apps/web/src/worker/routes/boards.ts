import {
  ApplyOpsRequest,
  CreateBoardRequest,
  Cursor,
  SelectVersionRequest,
  UpdateBoardRequest,
} from '@annie3d/contracts';
import { boardOps, boards, nodeVersions } from '@annie3d/db';
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, query, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { applyBatch, createBoard, loadBoard, snapshot, versionDtos } from '../services/boards';

export const boardRoutes = new Hono<AppEnv>();

boardRoutes.get('/api/boards', requireUser, async (c) => {
  const { cursor, limit } = query(c, Cursor);
  const db = getDb(c);
  const where = and(
    eq(boards.workspaceId, c.get('workspaceId')!),
    isNull(boards.archivedAt),
    cursor ? lt(boards.updatedAt, new Date(cursor)) : undefined,
  );
  const rows = await db
    .select()
    .from(boards)
    .where(where)
    .orderBy(desc(boards.updatedAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return c.json({
    boards: page.map((b) => ({
      id: b.id,
      title: b.title,
      updatedAt: b.updatedAt.toISOString(),
      thumbnailUrl: null,
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.updatedAt.toISOString() : null,
  });
});

boardRoutes.post('/api/boards', requireEditor, async (c) => {
  const req = await body(c, CreateBoardRequest);
  const db = getDb(c);
  const b = await createBoard(
    db,
    c.get('workspaceId')!,
    c.get('user')!.id,
    req.title,
    req.starter,
    req.fromGuest,
  );
  return c.json(await snapshot(db, c.env, c.get('workspaceId')!, b.id, c.get('role')!), 201);
});

boardRoutes.get('/api/boards/:boardId', requireUser, async (c) => {
  const id = uuidParam(c, 'boardId');
  const snap = await snapshot(getDb(c), c.env, c.get('workspaceId')!, id, c.get('role')!);
  c.header('cache-control', 'private, no-store');
  return c.json(snap);
});

boardRoutes.patch('/api/boards/:boardId', requireEditor, async (c) => {
  const id = uuidParam(c, 'boardId');
  const req = await body(c, UpdateBoardRequest);
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, id);
  await db.update(boards).set({ title: req.title }).where(eq(boards.id, id));
  return c.json({ ok: true });
});

boardRoutes.delete('/api/boards/:boardId', requireEditor, async (c) => {
  const id = uuidParam(c, 'boardId');
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, id);
  await db.update(boards).set({ archivedAt: new Date() }).where(eq(boards.id, id));
  return c.json({ ok: true });
});

boardRoutes.post('/api/boards/:boardId/ops', requireEditor, async (c) => {
  const id = uuidParam(c, 'boardId');
  const lim = await c.env.RL_WRITE.limit({ key: c.get('user')!.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many edits, slow down');
  const req = await body(c, ApplyOpsRequest);
  const res = await applyBatch(getDb(c), c.get('workspaceId')!, c.get('user')!.id, id, req.opId, req.ops);
  return c.json(res, res.duplicate ? 200 : 201);
});

boardRoutes.get('/api/boards/:boardId/ops', requireUser, async (c) => {
  const id = uuidParam(c, 'boardId');
  const after = Number(c.req.query('after') ?? '0');
  const db = getDb(c);
  const b = await loadBoard(db, c.get('workspaceId')!, id);
  const rows = await db
    .select()
    .from(boardOps)
    .where(and(eq(boardOps.boardId, id), gt(boardOps.seq, Number.isFinite(after) ? after : 0)))
    .orderBy(boardOps.seq)
    .limit(500);
  return c.json({
    ops: rows.map((r) => ({
      seq: r.seq,
      opId: r.opId,
      actorId: r.actorId,
      ops: r.ops,
      at: r.createdAt.toISOString(),
    })),
    seq: b.seq,
  });
});

boardRoutes.get('/api/boards/:boardId/nodes/:nodeId/versions', requireUser, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const nodeId = uuidParam(c, 'nodeId');
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, boardId);
  const ids = await db
    .select({ id: nodeVersions.id })
    .from(nodeVersions)
    .where(and(eq(nodeVersions.nodeId, nodeId), eq(nodeVersions.boardId, boardId)))
    .orderBy(desc(nodeVersions.versionNo))
    .limit(100);
  const dtos = await versionDtos(
    db,
    c.env,
    ids.map((r) => r.id),
  );
  return c.json({ versions: dtos.sort((a, b) => b.versionNo - a.versionNo) });
});

boardRoutes.post('/api/boards/:boardId/nodes/:nodeId/select-version', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const nodeId = uuidParam(c, 'nodeId');
  const { versionId } = await body(c, SelectVersionRequest);
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, boardId);
  const node = await db.query.boardNodes.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.id, nodeId), eq(t.boardId, boardId), isNull(t.deletedAt)),
  });
  if (!node) throw httpError(404, 'not_found', 'Node not found');
  // Goes through the op log so undo and replay see it like any other change.
  const res = await applyBatch(db, c.get('workspaceId')!, c.get('user')!.id, boardId, crypto.randomUUID(), [
    { type: 'node.update', id: nodeId, patch: { currentVersionId: versionId } },
  ]);
  return c.json(res);
});
