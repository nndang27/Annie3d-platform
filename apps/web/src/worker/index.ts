import { createDb } from '@annie3d/db';
import { Hono } from 'hono';
import { createAuth, publicOrigin } from './auth';
import type { AppEnv, Env } from './env';
import { closeDb, getDb } from './lib/db';
import { errorResponse, unknownEndpoint } from './lib/http';
import { localeOf } from './lib/i18n';
import { loadSession } from './lib/session';
import { agentRoutes } from './routes/agent';
import { assetRoutes } from './routes/assets';
import { boardFileRoutes } from './routes/boardFile';
import { boardRoutes } from './routes/boards';
import { creditRoutes } from './routes/credits';
import { exportRoutes } from './routes/exports';
import { me } from './routes/me';
import { publicRoutes } from './routes/public';
import { reelRoutes } from './routes/reels';
import { rumRoutes } from './routes/rum';
import { runRoutes } from './routes/runs';
import { shareRoutes } from './routes/shares';
import { simRoutes } from './routes/sim';
import { purgeWorkingCopies } from './services/cleanup';

export { RunRoom } from './durable/run-room';
export { SimRoom } from './durable/sim-room';
export type { Env } from './env';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set('requestId', c.req.header('cf-ray') ?? crypto.randomUUID());
  const t0 = Date.now();
  await next();
  // WebSocket upgrades carry immutable headers from the Durable Object; leave them untouched.
  if (c.res.status === 101) return;
  // API responses: never sniffed, never framed, no referrer leakage (best-practices skill).
  c.header('x-content-type-options', 'nosniff');
  c.header('x-frame-options', 'DENY');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  c.header('x-request-id', c.get('requestId'));
  // Worker time per response (Workers clocks advance across I/O, so this is DB/R2 + compute);
  // the Performance panel reads it through Resource Timing (Server-Timing, same origin).
  c.header('server-timing', `app;dur=${Date.now() - t0}`);
});
app.use('/api/*', closeDb);
app.use('/s/*', closeDb);
app.use('/billing/*', closeDb);
app.use('/billing/*', loadSession);

app.onError(errorResponse);
app.notFound((c) => (c.req.path.startsWith('/api/') ? unknownEndpoint(c) : c.env.ASSETS.fetch(c.req.raw)));

app.get('/api/health', async (c) => {
  const started = Date.now();
  const r = await getDb(c).execute('select 1 as ok');
  return c.json({ ok: r.rows.length === 1, env: c.env.APP_ENV, dbMs: Date.now() - started });
});

// Better Auth owns /api/auth/* (Google sign-in, session, sign-out).
app.on(['GET', 'POST'], '/api/auth/*', (c) =>
  createAuth(c.env, getDb(c), publicOrigin(c.env, c.req.raw), localeOf(c.req.raw)).handler(c.req.raw),
);

// Test-only (local, test auth on): run the working-copy cleanup as of a given time.
app.post('/api/test/purge-working-copies', async (c) => {
  if (c.env.APP_ENV !== 'development' || c.env.ANNIE3D_TEST_AUTH !== '1') return unknownEndpoint(c);
  const { now } = (await c.req.json().catch(() => ({}))) as { now?: string };
  return c.json(await purgeWorkingCopies(c.env, getDb(c), now ? new Date(now) : new Date()));
});

app.use('/api/*', loadSession);
app.route('/', me);
app.route('/', boardRoutes);
app.route('/', assetRoutes);
app.route('/', creditRoutes);
app.route('/', publicRoutes);
app.route('/', runRoutes);
app.route('/', exportRoutes);
app.route('/', simRoutes);
app.route('/', rumRoutes);
app.route('/', boardFileRoutes);
app.route('/', shareRoutes);
app.route('/', agentRoutes);
app.route('/', reelRoutes);

export default {
  fetch: app.fetch,
  /** Daily cron (wrangler.jsonc triggers): delete expired desktop working copies. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const { db, client } = createDb(env.HYPERDRIVE.connectionString);
    ctx.waitUntil(
      (async () => {
        await client.connect();
        try {
          const r = await purgeWorkingCopies(env, db);
          console.log(JSON.stringify({ level: 'info', event: 'working_copies.purged', ...r }));
        } finally {
          await client.end().catch(() => {});
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
