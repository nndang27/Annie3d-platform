import { Hono } from 'hono';

export interface Env {
  ASSETS: Fetcher;
  UPLOADS: R2Bucket;
  ARTIFACTS: R2Bucket;
  PUBLIC: R2Bucket;
  APP_ENV: string;
  R2_KEY_PREFIX: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true, env: c.env.APP_ENV }));

export default app;
