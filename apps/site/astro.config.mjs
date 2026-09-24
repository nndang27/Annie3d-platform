import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Static pages for SEO and the OAuth consent screen. The canvas owns "/", so these live at
// /home and /legal/*. Built output is copied into apps/web/public by `pnpm build`.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://annie3d.nndang2701.workers.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: (page) => page.includes('/home') })],
});
