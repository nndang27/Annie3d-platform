import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';

export const rumRoutes = new Hono<AppEnv>();

const Rum = z.object({
  path: z.string().max(200),
  vitals: z.record(z.string().max(32), z.number().finite()).refine((v) => Object.keys(v).length <= 12),
  samples: z
    .array(z.object({ name: z.string().max(40), ms: z.number().finite().min(0).max(3_600_000) }))
    .max(100),
  connection: z.string().max(16).optional(),
});

/**
 * Real-user performance beacons (sent by the browser when a tab is hidden). Written as one
 * structured log line per beacon, so Workers Logs (observability) can chart page-load vitals and
 * feature timings by country and colo without a database write on every page view.
 */
rumRoutes.post('/api/rum', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const lim = await c.env.RL_WRITE.limit({ key: `rum:${ip}` });
  if (!lim.success) return c.body(null, 204);
  const parsed = Rum.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 204);
  const cf = (c.req.raw as Request & { cf?: { country?: string; colo?: string } }).cf;
  console.log(
    JSON.stringify({
      event: 'rum',
      env: c.env.APP_ENV,
      country: cf?.country,
      colo: cf?.colo,
      ...parsed.data,
    }),
  );
  return c.body(null, 204);
});
