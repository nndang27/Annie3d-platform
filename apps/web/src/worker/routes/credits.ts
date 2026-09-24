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
  // Only same-origin return paths: a signed checkout must never redirect elsewhere.
  const origin = new URL(c.req.url).origin;
  const ret = new URL(req.returnUrl);
  const returnPath = ret.origin === origin ? `${ret.pathname}${ret.search}` : '/';
  const payload = btoa(
    JSON.stringify({
      ws: c.get('workspaceId'),
      plan: plan.id,
      nonce: crypto.randomUUID(),
      exp: Date.now() + 30 * 60_000,
      ret: returnPath,
    }),
  );
  const sig = await hmac(c.env.BETTER_AUTH_SECRET, payload);
  return c.json({
    checkoutUrl: `${origin}/billing/checkout?p=${encodeURIComponent(payload)}&s=${sig}`,
    provider: 'simulated',
  });
});

creditRoutes.post('/api/billing/simulated/confirm', requireEditor, async (c) => {
  const p = c.req.query('p') ?? '';
  const s = c.req.query('s') ?? '';
  if ((await hmac(c.env.BETTER_AUTH_SECRET, p)) !== s)
    throw httpError(400, 'bad_request', 'Invalid checkout signature');
  const data = JSON.parse(atob(p)) as {
    ws: string;
    plan: 'creator' | 'studio';
    nonce: string;
    exp: number;
    ret?: string;
  };
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
  // The hosted checkout page posts a form: send the browser back to the app.
  if ((c.req.header('content-type') ?? '').includes('application/x-www-form-urlencoded')) {
    const back = new URL(data.ret && data.ret.startsWith('/') ? data.ret : '/', new URL(c.req.url).origin);
    back.searchParams.set('checkout', 'success');
    return c.redirect(back.pathname + back.search, 303);
  }
  return c.json({ ok: true, duplicate: !inserted.length, plan: plan.id, balance: acc?.balance ?? 0 });
});

/**
 * Hosted checkout page of the simulated provider (what Stripe/Paddle would show). Signed link;
 * paying posts back to the confirm endpoint with the same signature.
 */
creditRoutes.get('/billing/checkout', requireUser, async (c) => {
  const p = c.req.query('p') ?? '';
  const s = c.req.query('s') ?? '';
  if (!/^[0-9a-f]{64}$/.test(s) || (await hmac(c.env.BETTER_AUTH_SECRET, p)) !== s)
    throw httpError(400, 'bad_request', 'Invalid checkout link');
  const data = JSON.parse(atob(p)) as { plan: 'creator' | 'studio'; exp: number; ret?: string };
  const plan = PLANS.find((x) => x.id === data.plan)!;
  const esc = (x: string) => x.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const action = `/api/billing/simulated/confirm?p=${encodeURIComponent(p)}&s=${s}`;
  c.header(
    'content-security-policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  );
  c.header('cache-control', 'no-store');
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout · Annie 3D</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17191d}
.card{background:#fff;border:1px solid #e4e4df;border-radius:16px;padding:28px;width:min(420px,calc(100vw - 32px));box-shadow:0 8px 30px rgb(0 0 0/.06)}
.row{display:flex;justify-content:space-between;margin:6px 0}.muted{color:#6b6f76;font-size:13px}.total{font-weight:600;font-size:18px;border-top:1px solid #e4e4df;padding-top:12px;margin-top:12px}
button{width:100%;margin-top:18px;background:#17191d;color:#fff;border:0;border-radius:10px;padding:12px;font:inherit;font-weight:600;cursor:pointer}.note{background:#fff7e6;color:#7a4d00;border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:14px}
a{color:#6b6f76;display:block;text-align:center;margin-top:12px;font-size:13px}</style></head><body>
<form class="card" method="post" action="${esc(action)}" data-testid="checkout-page">
<div class="note">Simulated checkout: no card is charged. A real provider replaces this page.</div>
<div class="muted">Annie 3D</div><h1 style="margin:4px 0 12px;font-size:22px">${esc(plan.name)} plan</h1>
<div class="row"><span>${plan.creditsPerMonth} credits every month</span><span>$${plan.priceMonthlyUsd}.00</span></div>
<div class="row total"><span>Due today</span><span>$${plan.priceMonthlyUsd}.00</span></div>
<button type="submit" data-testid="checkout-pay">Pay $${plan.priceMonthlyUsd}.00</button>
<a href="${esc(data.ret && data.ret.startsWith('/') ? data.ret : '/')}">Cancel and go back</a>
</form></body></html>`);
});

/** Public client config (the Google client id is public by design: it ships to every browser). */
creditRoutes.get('/api/public/config', (c) => {
  c.header('cache-control', 'public, max-age=300');
  return c.json({ googleClientId: c.env.GOOGLE_CLIENT_ID, billingProvider: 'simulated' });
});

export { sha256Hex };
