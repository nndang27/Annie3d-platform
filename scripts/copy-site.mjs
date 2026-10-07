// Copies the static Astro pages (/home, /legal/*, and each language's /<code>/home,
// /<code>/legal/*) into the SPA's public folder so the Worker serves them from the same origin
// as the canvas. Generated files are gitignored.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const src = 'apps/site/dist';
const dst = 'apps/web/public';
if (!existsSync(src)) throw new Error('Build the site first: pnpm --filter @annie3d/site build');

// Language folders, read from the one list of languages (plain Node cannot import the .ts file
// on every supported version). English has no folder: its pages stay at /home and /legal.
const codes = [...readFileSync('packages/i18n/src/locales.ts', 'utf8').matchAll(/code: '([a-z]{2})'/g)]
  .map((m) => m[1])
  .filter((c) => c !== 'en');
if (codes.length < 2) throw new Error('No languages found in packages/i18n/src/locales.ts');

// A language removed from the list leaves its old pages behind: drop any language folder (a
// two-letter folder with a home page) that is no longer in the list.
for (const d of readdirSync(dst))
  if (/^[a-z]{2}$/.test(d) && !codes.includes(d) && existsSync(`${dst}/${d}/home`))
    rmSync(`${dst}/${d}`, { recursive: true, force: true });

for (const p of ['home', 'legal', ...codes, '_astro', 'media', 'sitemap-index.xml', 'sitemap-0.xml']) {
  rmSync(`${dst}/${p}`, { recursive: true, force: true });
  if (existsSync(`${src}/${p}`)) cpSync(`${src}/${p}`, `${dst}/${p}`, { recursive: true });
}
console.log(`site copied into apps/web/public (${['en', ...codes].join(', ')})`);
