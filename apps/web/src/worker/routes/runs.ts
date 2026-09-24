import { NODE_DEFS, type RunDto, StartRunRequest } from '@annie3d/contracts';
import { reserve, runSteps, runs, workspaces } from '@annie3d/db';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { AppEnv, Env } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { loadBoard, loadGraph } from '../services/boards';
import { planRun } from '../services/plan';

export const runRoutes = new Hono<AppEnv>();

type Db = ReturnType<typeof getDb>;

const room = (env: Env, runId: string) =>
  env.RUN_ROOM.get(env.RUN_ROOM.idFromName(runId)) as unknown as {
    start(runId: string, q: { plan: string[]; estimatedCredits: number }): Promise<void>;
    cancel(): Promise<void>;
    fetch(r: Request): Promise<Response>;
  };

async function runDto(db: Db, runId: string): Promise<RunDto> {
  const run = await db.query.runs.findFirst({ where: (t, { eq }) => eq(t.id, runId) });
  if (!run) throw httpError(404, 'not_found', 'Run not found');
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.seq));
  return {
    id: run.id,
    boardId: run.boardId,
    status: run.status as RunDto['status'],
    scope: run.scope as RunDto['scope'],
    rootNodeId: run.rootNodeId,
    estimatedCredits: run.estimatedCredits,
    chargedCredits: run.chargedCredits,
    steps: steps.map((s) => ({
      id: s.id,
      nodeId: s.nodeId!,
      seq: s.seq,
      status: s.status as RunDto['steps'][number]['status'],
      credits: s.credits,
      outputVersionId: s.outputVersionId,
      errorCode: s.errorCode,
    })),
    lastEventSeq: run.lastEventSeq,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

async function ownRun(c: Context<AppEnv>, runId: string) {
  const db = getDb(c);
  const run = await db.query.runs.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, runId), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!run) throw httpError(404, 'not_found', 'Run not found');
  return run;
}

/**
 * Start a run. Order matters for money: plan → insert run+steps and reserve credits in one
 * transaction → hand to the run room. A retried POST with the same idempotency key returns
 * the same run and never reserves twice.
 */
runRoutes.post('/api/boards/:boardId/runs', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const req = await body(c, StartRunRequest);
  const user = c.get('user')!;
  const ws = c.get('workspaceId')!;
  const lim = await c.env.RL_RUN.limit({ key: user.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many runs. Wait a minute.');
  const db = getDb(c);
  const existing = await db.query.runs.findFirst({
    where: (t, { and, eq }) => and(eq(t.workspaceId, ws), eq(t.idempotencyKey, req.idempotencyKey)),
  });
  if (existing) return c.json(await runDto(db, existing.id));
  await loadBoard(db, ws, boardId);
  const active = await db.query.runs.findFirst({
    where: (t, { and, eq, inArray }) => and(eq(t.boardId, boardId), inArray(t.status, ['queued', 'running'])),
  });
  if (active)
    throw httpError(409, 'conflict', 'A run is already in progress on this board', { runId: active.id });
  const { graph } = await loadGraph(db, boardId);
  if (req.nodeId && !graph.nodes.has(req.nodeId)) throw httpError(404, 'not_found', 'Node not found');
  const full = (await planRun(db, graph, req.nodeId, req.scope)).filter((p) => NODE_DEFS[p.kind].runnable);
  if (!full.length) throw httpError(400, 'bad_request', 'Nothing to run: add a runnable node');
  // Cached steps are not scheduled: the plan already knows nothing upstream of them re-runs,
  // so running them would only repeat lookups (15 steps → 3 after a one-node edit).
  const plan = full.filter((p) => !p.cached);
  if (!plan.length) throw httpError(409, 'conflict', 'Everything is up to date', { upToDate: true });
  const estimate = plan.reduce((s, p) => s + p.credits, 0);
  const runId = crypto.randomUUID();
  // Test-only: speed up the simulator. Honoured only in local dev with test auth enabled.
  const testMode = c.env.APP_ENV === 'development' && c.env.ANNIE3D_TEST_AUTH === '1';
  const simSpeed = testMode ? Number(c.req.header('x-annie3d-sim-speed')) || undefined : undefined;

  const created = await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    // The first run of a workspace is its free run (F11); the 60 granted credits pay for it.
    const free = await tx
      .update(workspaces)
      .set({ freeRunUsedAt: new Date() })
      .where(and(eq(workspaces.id, ws), isNull(workspaces.freeRunUsedAt)))
      .returning({ id: workspaces.id });
    await tx.insert(runs).values({
      id: runId,
      boardId,
      workspaceId: ws,
      requestedBy: user.id,
      scope: req.scope,
      rootNodeId: req.nodeId,
      estimatedCredits: estimate,
      idempotencyKey: req.idempotencyKey,
      usedFreeRun: free.length > 0,
      params: simSpeed ? { simSpeed } : {},
    });
    await tx.insert(runSteps).values(
      plan.map((p, i) => ({
        runId,
        nodeId: p.nodeId,
        seq: i + 1,
        credits: p.credits,
        inputHash: p.inputHash,
      })),
    );
    // Reserve after the run row exists (credit_entries.run_id references runs). Failing here
    // throws and rolls the whole transaction back, so no run and no hold remain.
    const held = await reserve(tx, ws, runId, estimate);
    if (!held.ok) {
      const acc = await tx.execute<{ a: number }>(
        sql`SELECT (balance - reserved)::int AS a FROM credit_accounts WHERE workspace_id = ${ws}`,
      );
      throw httpError(402, 'insufficient_credits', 'Not enough credits for this run', {
        needed: estimate,
        available: acc.rows[0]?.a ?? 0,
      });
    }
    return true;
  });
  if (created)
    await room(c.env, runId).start(runId, { plan: plan.map((p) => p.nodeId), estimatedCredits: estimate });
  return c.json(await runDto(db, runId), 201);
});

runRoutes.get('/api/boards/:boardId/runs', requireUser, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, boardId);
  const rows = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.boardId, boardId))
    .orderBy(desc(runs.createdAt))
    .limit(20);
  return c.json({ runs: await Promise.all(rows.map((r) => runDto(db, r.id))) });
});

runRoutes.get('/api/runs/:runId', requireUser, async (c) => {
  const run = await ownRun(c, uuidParam(c, 'runId'));
  return c.json(await runDto(getDb(c), run.id));
});

runRoutes.post('/api/runs/:runId/cancel', requireEditor, async (c) => {
  const run = await ownRun(c, uuidParam(c, 'runId'));
  if (['queued', 'running'].includes(run.status)) await room(c.env, run.id).cancel();
  return c.json(await runDto(getDb(c), run.id), 202);
});

/** WebSocket of run events. Authorised here, then handed to the run's Durable Object. */
runRoutes.get('/api/runs/:runId/events', requireUser, async (c) => {
  if (c.req.header('upgrade') !== 'websocket')
    throw httpError(426 as 400, 'bad_request', 'Expected a WebSocket upgrade');
  const run = await ownRun(c, uuidParam(c, 'runId'));
  return room(c.env, run.id).fetch(c.req.raw);
});
