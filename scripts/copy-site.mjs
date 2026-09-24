// Copies the static Astro pages (/home, /legal/*) into the SPA's public folder so the Worker
// serves them from the same origin as the canvas. Generated files are gitignored.
import { cpSync, existsSync, rmSync } from 'node:fs';

const src = 'apps/site/dist';
const dst = 'apps/web/public';
if (!existsSync(src)) throw new Error('Build the site first: pnpm --filter @annie3d/site build');
for (const p of ['home', 'legal', '_astro', 'sitemap-index.xml', 'sitemap-0.xml']) {
  rmSync(`${dst}/${p}`, { recursive: true, force: true });
  if (existsSync(`${src}/${p}`)) cpSync(`${src}/${p}`, `${dst}/${p}`, { recursive: true });
}
console.log('site copied into apps/web/public');
