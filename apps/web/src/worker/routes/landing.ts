import { APP_PATH } from '@annie3d/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { localeOf } from '../lib/i18n';

/**
 * annie3d.app/ is the landing page (since 2026-10-08), in the visitor's language (the language
 * cookie, then Accept-Language); the canvas is at /app. The pages are the static site's own
 * (/home, /<code>/home), served here so the root needs no redirect.
 * - Old links to the canvas at the root carry a query (?file=, ?checkout=, ?lang=, ?edit=): they
 *   open the canvas with the same query.
 * - /home moves to "/" (one address per page).
 */
export const landingRoutes = new Hono<AppEnv>();

landingRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  if (url.search) return c.redirect(`${APP_PATH}${url.search}`, 302);
  const locale = localeOf(c.req.raw);
  const page = locale === 'en' ? '/home/' : `/${locale}/home/`;
  const res = await c.env.ASSETS.fetch(new Request(new URL(page, url), { headers: c.req.raw.headers }));
  const out = new Response(res.body, res);
  out.headers.set('vary', 'Cookie, Accept-Language');
  return out;
});

for (const path of ['/home', '/home/'])
  landingRoutes.get(path, (c) => c.redirect(`/${new URL(c.req.url).search}`, 301));
