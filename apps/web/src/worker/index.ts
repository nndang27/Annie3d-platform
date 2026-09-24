import { Hono } from 'hono';
import { createAuth } from './auth';
import type { AppEnv } from './env';
import { closeDb, getDb } from './lib/db';
import { HttpError } from './lib/http';
import { loadSession } from './lib/session';
import { assetRoutes } from './routes/assets';
import { boardRoutes } from './routes/boards';
import { creditRoutes } from './routes/credits';
import { exportRoutes } from './routes/exports';
import { me } from './routes/me';
import { publicRoutes } from './routes/public';
import { runRoutes } from './routes/runs';
import { shareRoutes } from './routes/shares';

export { RunRoom } from './durable/run-room';
export type { Env } from './env';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set('requestId', c.req.header('cf-ray') ?? crypto.randomUUID());
  await next();
  // WebSocket upgrades carry immutable headers from the Durable Object; leave them untouched.
  if (c.res.status === 101) return;
  // API responses: never sniffed, never framed, no referrer leakage (best-practices skill).
  c.header('x-content-type-options', 'nosniff');
  c.header('x-frame-options', 'DENY');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  c.header('x-request-id', c.get('requestId'));
});
app.use('/api/*', closeDb);
app.use('/s/*', closeDb);
app.use('/billing/*', closeDb);
app.use('/billing/*', loadSession);

app.onError((err, c) => {
  if (err instanceof HttpError)
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: c.get('requestId'),
      path: c.req.path,
      message: String(err),
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    }),
  );
  return c.json(
    {
      error: {
        code: 'internal',
        message: 'Something went wrong. Try again.',
        details: { requestId: c.get('requestId') },
      },
    },
    500,
  );
});
app.notFound((c) =>
  c.req.path.startsWith('/api/')
    ? c.json({ error: { code: 'not_found', message: 'Unknown endpoint' } }, 404)
    : c.env.ASSETS.fetch(c.req.raw),
);

app.get('/api/health', async (c) => {
  const started = Date.now();
  const r = await getDb(c).execute('select 1 as ok');
  return c.json({ ok: r.rows.length === 1, env: c.env.APP_ENV, dbMs: Date.now() - started });
});

// Better Auth owns /api/auth/* (Google sign-in, session, sign-out).
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env, getDb(c)).handler(c.req.raw));

app.use('/api/*', loadSession);
app.route('/', me);
app.route('/', boardRoutes);
app.route('/', assetRoutes);
app.route('/', creditRoutes);
app.route('/', publicRoutes);
app.route('/', runRoutes);
app.route('/', exportRoutes);
app.route('/', shareRoutes);

export default app;
