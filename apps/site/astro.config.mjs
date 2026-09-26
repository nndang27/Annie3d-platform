import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { LOCALES } from '../../packages/i18n/src/locales.ts';

// Static pages for SEO and the OAuth consent screen. The canvas owns "/", so these live at
// /home and /legal/*, in English there and under /<code>/ in every other language
// (/vi/home, /vi/legal/terms). Built output is copied into apps/web/public by `pnpm build`.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://annie3d.nndang2701.workers.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // The site's CSP (apps/web/public/_headers: script-src 'self') blocks inline scripts, so the
  // language-choice script is always emitted as a file in /_astro. Other assets: Vite's default.
  vite: { build: { assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined) } },
  integrations: [
    sitemap({
      filter: (page) => page.includes('/home'),
      // hreflang alternates between the language versions of each page (English unprefixed).
      i18n: { defaultLocale: 'en', locales: Object.fromEntries(LOCALES.map((l) => [l.code, l.tag])) },
    }),
  ],
});
