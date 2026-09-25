import { EDIT_CREDITS, EditRequest, NODE_DEFS, type RunDto, StartRunRequest } from '@annie3d/contracts';
import { boards, reserve, runSteps, runs, workspaces } from '@annie3d/db';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { AppEnv, Env } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { loadBoard, loadGraph } from '../services/boards';
import { workingCopyExpiry } from '../services/cleanup';
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
/** Shared pre-checks for any run on a board: rate limit, idempotent replay, one active run. */
async function preflight(c: Context<AppEnv>, boardId: string, idempotencyKey: string, dbIn?: Db) {
  const user = c.get('user')!;
  const ws = c.get('workspaceId')!;
  const lim = await c.env.RL_RUN.limit({ key: user.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many runs. Wait a minute.');
  const db = dbIn ?? getDb(c);
  const existing = await db.query.runs.findFirst({
    where: (t, { and, eq }) => and(eq(t.workspaceId, ws), eq(t.idempotencyKey, idempotencyKey)),
  });
  if (existing) return { db, existing: existing.id };
  await loadBoard(db, ws, boardId);
  const active = await db.query.runs.findFirst({
    where: (t, { and, eq, inArray }) => and(eq(t.boardId, boardId), inArray(t.status, ['queued', 'running'])),
  });
  if (active)
    throw httpError(409, 'conflict', 'A run is already in progress on this board', { runId: active.id });
  return { db, existing: null };
}

/**
 * Creates a run and hands it to its run room. Order matters for money: run + steps + credit
 * reservation in one transaction (reserve after the run row: credit_entries.run_id references
 * runs; failing throws and rolls everything back), then start.
 */
async function createRun(
  c: Context<AppEnv>,
  db: Db,
  r: {
    boardId: string;
    kind: 'graph' | 'edit';
    scope: 'node' | 'from_here' | 'with_upstream' | 'all';
    rootNodeId: string | null;
    idempotencyKey: string;
    steps: { nodeId: string; credits: number; inputHash: string | null }[];
    params?: Record<string, unknown>;
    runId?: string;
  },
) {
  const ws = c.get('workspaceId')!;
  const estimate = r.steps.reduce((s, p) => s + p.credits, 0);
  const runId = r.runId ?? crypto.randomUUID();
  // Test-only: speed up the simulator. Honoured only in local dev with test auth enabled.
  const testMode = c.env.APP_ENV === 'development' && c.env.ANNIE3D_TEST_AUTH === '1';
  const simSpeed = testMode ? Number(c.req.header('x-annie3d-sim-speed')) || undefined : undefined;
  await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    // The first run of a workspace is its free run (F11); the 60 granted credits pay for it.
    const free = await tx
      .update(workspaces)
      .set({ freeRunUsedAt: new Date() })
      .where(and(eq(workspaces.id, ws), isNull(workspaces.freeRunUsedAt)))
      .returning({ id: workspaces.id });
    // A desktop working copy stays while it is being used: each run restarts its time.
    await tx
      .update(boards)
      .set({ expiresAt: workingCopyExpiry() })
      .where(and(eq(boards.id, r.boardId), sql`${boards.expiresAt} IS NOT NULL`));
    await tx.insert(runs).values({
      id: runId,
      boardId: r.boardId,
      workspaceId: ws,
      requestedBy: c.get('user')!.id,
      kind: r.kind,
      scope: r.scope,
      rootNodeId: r.rootNodeId,
      estimatedCredits: estimate,
      idempotencyKey: r.idempotencyKey,
      usedFreeRun: free.length > 0,
      params: { ...(r.params ?? {}), ...(simSpeed ? { simSpeed } : {}) },
    });
    await tx.insert(runSteps).values(
      r.steps.map((p, i) => ({
        runId,
        nodeId: p.nodeId,
        seq: i + 1,
        credits: p.credits,
        inputHash: p.inputHash,
      })),
    );
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
  });
  await room(c.env, runId).start(runId, { plan: r.steps.map((p) => p.nodeId), estimatedCredits: estimate });
  return runId;
}

/**
 * Plans and starts a graph run (used by the Run API and by the agent). Returns null when
 * everything is up to date; throws 402/409 like the API.
 */
export async function startGraphRun(
  c: Context<AppEnv>,
  db: Db,
  boardId: string,
  nodeId: string | null,
  scope: 'node' | 'from_here' | 'with_upstream' | 'all',
  idempotencyKey: string,
  maxCredits = Number.POSITIVE_INFINITY,
): Promise<{ runId: string; credits: number } | { upToDate: true } | { overBudget: number }> {
  const { existing } = await preflight(c, boardId, idempotencyKey, db);
  if (existing) return { runId: existing, credits: 0 };
  const { graph } = await loadGraph(db, boardId);
  const plan = (await planRun(db, graph, nodeId, scope)).filter(
    (p) => NODE_DEFS[p.kind].runnable && !p.cached,
  );
  if (!plan.length) return { upToDate: true };
  const credits = plan.reduce((s, p) => s + p.credits, 0);
  if (credits > maxCredits) return { overBudget: credits };
  const runId = await createRun(c, db, {
    boardId,
    kind: 'graph',
    scope,
    rootNodeId: nodeId,
    idempotencyKey,
    steps: plan,
  });
  return { runId, credits };
}

runRoutes.post('/api/boards/:boardId/runs', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const req = await body(c, StartRunRequest);
  const { db, existing } = await preflight(c, boardId, req.idempotencyKey);
  if (existing) return c.json(await runDto(db, existing));
  const { graph } = await loadGraph(db, boardId);
  if (req.nodeId && !graph.nodes.has(req.nodeId)) throw httpError(404, 'not_found', 'Node not found');
  const full = (await planRun(db, graph, req.nodeId, req.scope)).filter((p) => NODE_DEFS[p.kind].runnable);
  if (!full.length) throw httpError(400, 'bad_request', 'Nothing to run: add a runnable node');
  // Cached steps are not scheduled: the plan already knows nothing upstream of them re-runs,
  // so running them would only repeat lookups (15 steps → 3 after a one-node edit).
  const plan = full.filter((p) => !p.cached);
  if (!plan.length) throw httpError(409, 'conflict', 'Everything is up to date', { upToDate: true });
  const runId = await createRun(c, db, {
    boardId,
    kind: 'graph',
    scope: req.scope,
    rootNodeId: req.nodeId,
    idempotencyKey: req.idempotencyKey,
    steps: plan,
  });
  return c.json(await runDto(db, runId), 201);
});

/**
 * F8 region edit: selected faces + instruction on one model version → a new version.
 * The face list goes to R2 (up to 2M ids), the run carries its key.
 */
runRoutes.post('/api/boards/:boardId/nodes/:nodeId/edits', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const nodeId = uuidParam(c, 'nodeId');
  const req = await body(c, EditRequest);
  const { db, existing } = await preflight(c, boardId, req.idempotencyKey);
  if (existing) return c.json(await runDto(db, existing));
  const node = await db.query.boardNodes.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.id, nodeId), eq(t.boardId, boardId), isNull(t.deletedAt)),
  });
  if (!node) throw httpError(404, 'not_found', 'Node not found');
  if (node.kind !== 'model3d' && node.kind !== 'upload3d')
    throw httpError(400, 'bad_request', 'Region edits apply to 3D model nodes');
  const base = await db.query.nodeVersions.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, req.baseVersionId), eq(t.nodeId, nodeId)),
  });
  if (!base) throw httpError(404, 'not_found', 'Version not found on this node');
  const faces = [...new Set(req.selection.faces)].sort((a, b) => a - b);
  if (!faces.length) throw httpError(400, 'bad_request', 'Select a region first');
  const runId = crypto.randomUUID();
  const facesKey = `${c.env.R2_KEY_PREFIX}ws/${c.get('workspaceId')}/edits/${runId}.u32`;
  await c.env.ARTIFACTS.put(facesKey, new Uint32Array(faces).buffer, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
  await createRun(c, db, {
    runId,
    boardId,
    kind: 'edit',
    scope: 'node',
    rootNodeId: nodeId,
    idempotencyKey: req.idempotencyKey,
    steps: [{ nodeId, credits: EDIT_CREDITS, inputHash: base.inputHash }],
    params: { baseVersionId: base.id, facesKey, faceCount: faces.length, instruction: req.instruction },
  });
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
