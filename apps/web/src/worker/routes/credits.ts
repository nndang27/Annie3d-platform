import { CheckoutRequest, EstimateRequest } from '@annie3d/contracts';
import { creditAccounts, creditEntries, grant, paymentEvents, subscriptions, workspaces } from '@annie3d/db';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { loadBoard, loadGraph } from '../services/boards';
import { sha256Hex } from '../services/hash';
import { planRun } from '../services/plan';

export const creditRoutes = new Hono<AppEnv>();

/** Illustrative prices until payments launch (docs/MVP_STRATEGY.md §10). */
export const PLANS = [
  { id: 'creator' as const, name: 'Creator', priceMonthlyUsd: 19, creditsPerMonth: 300 },
  { id: 'studio' as const, name: 'Studio', priceMonthlyUsd: 49, creditsPerMonth: 1000 },
];

creditRoutes.post('/api/boards/:boardId/runs/estimate', requireUser, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const req = await body(c, EstimateRequest);
  const db = getDb(c);
  const ws = c.get('workspaceId')!;
  await loadBoard(db, ws, boardId);
  const { graph } = await loadGraph(db, boardId);
  if (req.nodeId && !graph.nodes.has(req.nodeId)) throw httpError(404, 'not_found', 'Node not found');
  const plan = await planRun(db, graph, req.nodeId, req.scope);
  const [acc] = await db.select().from(creditAccounts).where(eq(creditAccounts.workspaceId, ws));
  const [w] = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  return c.json({
    plan: plan.map(({ nodeId, kind, credits, cached }) => ({ nodeId, kind, credits, cached })),
    totalCredits: plan.reduce((s, p) => s + p.credits, 0),
    balance: (acc?.balance ?? 0) - (acc?.reserved ?? 0),
    freeRunAvailable: !w?.freeRunUsedAt,
    signInRequired: false,
  });
});

creditRoutes.get('/api/credits', requireUser, async (c) => {
  const db = getDb(c);
  const ws = c.get('workspaceId')!;
  const [acc] = await db.select().from(creditAccounts).where(eq(creditAccounts.workspaceId, ws));
  const entries = await db
    .select()
    .from(creditEntries)
    .where(eq(creditEntries.workspaceId, ws))
    .orderBy(desc(creditEntries.createdAt))
    .limit(50);
  return c.json({
    balance: acc?.balance ?? 0,
    reserved: acc?.reserved ?? 0,
    entries: entries.map((e) => ({
      id: e.id,
      amount: e.amount,
      reason: e.reason,
      runId: e.runId,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

creditRoutes.get('/api/billing/plans', (c) => c.json({ plans: PLANS, provider: 'simulated' }));

// ---------------------------------------------------------------------------------------------
// Simulated checkout. Same shape as a real provider: checkout URL → confirmation → signed event
// → idempotent grant. Stripe/Paddle replace `/api/billing/simulated/*` without touching the rest.
// ---------------------------------------------------------------------------------------------
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

creditRoutes.post('/api/billing/checkout', requireEditor, async (c) => {
  const req = await body(c, CheckoutRequest);
  const plan = PLANS.find((p) => p.id === req.planId)!;
  const payload = btoa(
    JSON.stringify({
      ws: c.get('workspaceId'),
      plan: plan.id,
      nonce: crypto.randomUUID(),
      exp: Date.now() + 30 * 60_000,
    }),
  );
  const sig = await hmac(c.env.BETTER_AUTH_SECRET, payload);
  return c.json({
    checkoutUrl: `${c.env.APP_URL}/api/billing/simulated/confirm?p=${encodeURIComponent(payload)}&s=${sig}`,
    provider: 'simulated',
  });
});

creditRoutes.post('/api/billing/simulated/confirm', requireEditor, async (c) => {
  const p = c.req.query('p') ?? '';
  const s = c.req.query('s') ?? '';
  if ((await hmac(c.env.BETTER_AUTH_SECRET, p)) !== s)
    throw httpError(400, 'bad_request', 'Invalid checkout signature');
  const data = JSON.parse(atob(p)) as { ws: string; plan: 'creator' | 'studio'; nonce: string; exp: number };
  if (data.exp < Date.now()) throw httpError(400, 'bad_request', 'Checkout expired');
  if (data.ws !== c.get('workspaceId'))
    throw httpError(403, 'forbidden', 'Checkout belongs to another workspace');
  const db = getDb(c);
  const plan = PLANS.find((x) => x.id === data.plan)!;
  const inserted = await db
    .insert(paymentEvents)
    .values({ provider: 'simulated', eventId: data.nonce, type: 'checkout.completed', payload: data })
    .onConflictDoNothing()
    .returning();
  if (inserted.length) {
    await grant(db, data.ws, plan.creditsPerMonth, 'purchase', `simulated:${data.nonce}`, c.get('user')!.id);
    await db.insert(subscriptions).values({
      workspaceId: data.ws,
      provider: 'simulated',
      providerSubscriptionId: `sim_${data.nonce}`,
      plan: plan.id,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
    });
    await db.update(workspaces).set({ plan: plan.id }).where(eq(workspaces.id, data.ws));
    await db
      .update(paymentEvents)
      .set({ processedAt: new Date() })
      .where(eq(paymentEvents.eventId, data.nonce));
  }
  const [acc] = await db.select().from(creditAccounts).where(eq(creditAccounts.workspaceId, data.ws));
  return c.json({ ok: true, duplicate: !inserted.length, plan: plan.id, balance: acc?.balance ?? 0 });
});

export { sha256Hex };
