import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { LOCALES } from '../../packages/i18n/src/locales.ts';

// Static pages for SEO and the OAuth consent screen: /home and /legal/*, in English there and
// under /<code>/ in every other language (/vi/home, /vi/legal/terms). The Worker serves the landing
// page at "/" (in the visitor's language) and sends /home to "/"; the canvas is at /app. Built
// output is copied into apps/web/public by `pnpm build`.
const rootHome = (url) => url.replace(/\/home\/?$/, '/').replace(/(\.app)\/\/$/, '$1/');
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://annie3d.app',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // The site's CSP (apps/web/public/_headers: script-src 'self') blocks inline scripts, so the
  // language-choice script is always emitted as a file in /_astro. Other assets: Vite's default.
  vite: { build: { assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined) } },
  integrations: [
    sitemap({
      filter: (page) => page.includes('/home'),
      // English home is listed at its real address, the root.
      serialize: (item) => ({
        ...item,
        url: /\/[a-z]{2}\/home\/?$/.test(item.url) ? item.url : rootHome(item.url),
        links: item.links?.map((l) =>
          /\/[a-z]{2}\/home\/?$/.test(l.url) ? l : { ...l, url: rootHome(l.url) },
        ),
      }),
      // hreflang alternates between the language versions of each page (English unprefixed).
      i18n: { defaultLocale: 'en', locales: Object.fromEntries(LOCALES.map((l) => [l.code, l.tag])) },
    }),
  ],
});
