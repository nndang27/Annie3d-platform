import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { streamObject } from './assets';

const MIME: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  glb: 'model/gltf-binary',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  json: 'application/json',
};

/**
 * Versioned, immutable demo media (the example board and the run simulator).
 * Served from the PUBLIC bucket through the Workers Cache API so repeated requests
 * do not hit R2 (Cloudflare docs: "Cache API" + R2 public bucket guidance).
 */
export const publicRoutes = new Hono<AppEnv>().get(
  '/api/public/fixtures/:ver{v[0-9]+}/:product{[a-z0-9-]+}/:file{[a-z0-9_]+\\.(png|webp|jpg|glb|mp4|m4a)}',
  async (c) => {
    const { ver, product, file } = c.req.param();
    const key = `fixtures/${ver}/${product}/${file}`;
    const mime = MIME[file.split('.').pop()!]!;
    const ranged = c.req.header('range');
    const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
    const cacheKey = new Request(new URL(c.req.path, c.req.url).toString());
    if (cache && !ranged) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }
    const res = await streamObject(c.req.raw, c.env.PUBLIC, key, mime, 'public, max-age=31536000, immutable');
    if (cache && !ranged && res.status === 200) c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
);
