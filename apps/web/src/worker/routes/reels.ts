import { CreateReelRequest, type ReelDto } from '@annie3d/contracts';
import { assetVariants, reels } from '@annie3d/db';
import { desc, eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { assetDto } from '../services/assets';

export const reelRoutes = new Hono<AppEnv>();
type Db = ReturnType<typeof getDb>;
type ReelRow = typeof reels.$inferSelect;

async function reelDto(c: Context<AppEnv>, db: Db, r: ReelRow): Promise<z.infer<typeof ReelDto>> {
  const a = r.assetId
    ? await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, r.assetId!) })
    : null;
  const variants = a ? await db.select().from(assetVariants).where(eq(assetVariants.assetId, a.id)) : [];
  return {
    id: r.id,
    runId: r.runId,
    status: r.status as 'ready',
    asset: a ? assetDto(c.env, a, variants) : null,
  };
}

async function ownRun(c: Context<AppEnv>, db: Db) {
  const runId = uuidParam(c, 'runId');
  const run = await db.query.runs.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, runId), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!run) throw httpError(404, 'not_found', 'api.run.notFound');
  return run;
}

/**
 * F12 process reel: a 9:16 video, the ad on top and the canvas replay of the run below.
 * `client` mode: the browser records it (canvas + MediaRecorder), uploads it through the normal
 * presigned upload, then registers it here. `server` mode is the plug point for a render
 * worker; until one is attached it answers 501 so clients fall back to recording.
 */
reelRoutes.post('/api/runs/:runId/reels', requireEditor, async (c) => {
  const db = getDb(c);
  const run = await ownRun(c, db);
  const req = await body(c, CreateReelRequest);
  if (req.mode === 'server') throw httpError(501 as 400, 'bad_request', 'api.reel.serverNotAttached');
  if (!['succeeded', 'partial'].includes(run.status)) throw httpError(409, 'conflict', 'api.reel.afterRun');
  const a = await db.query.assets.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, req.assetId), eq(t.workspaceId, run.workspaceId)),
  });
  if (a?.kind !== 'video' || a.status !== 'ready')
    throw httpError(400, 'bad_request', 'api.reel.uploadFirst');
  const [row] = await db
    .insert(reels)
    .values({ runId: run.id, workspaceId: run.workspaceId, mode: 'client', status: 'ready', assetId: a.id })
    .returning();
  return c.json(await reelDto(c, db, row!), 201);
});

reelRoutes.get('/api/runs/:runId/reels', requireUser, async (c) => {
  const db = getDb(c);
  const run = await ownRun(c, db);
  const rows = await db
    .select()
    .from(reels)
    .where(eq(reels.runId, run.id))
    .orderBy(desc(reels.createdAt))
    .limit(10);
  return c.json({ reels: await Promise.all(rows.map((r) => reelDto(c, db, r))) });
});
