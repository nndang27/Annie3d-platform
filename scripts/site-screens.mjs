// Screenshots of the canvas for the landing page, one per language, from the live site.
// Headless (no window opens). Output: apps/site/src/assets/screens/canvas-<code>.webp (1600 px wide).
// Usage: node scripts/site-screens.mjs [origin]   (default https://annie3d.app)
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

// sharp comes with Astro (the site's image pipeline); no extra dependency at the root.
const fromSite = createRequire(new URL('../apps/site/package.json', import.meta.url));
const sharp = createRequire(fromSite.resolve('astro/package.json'))('sharp');

const ORIGIN = process.argv[2] ?? 'https://annie3d.app';
const OUT = 'apps/site/src/assets/screens';
// The one list of languages (plain Node cannot import the .ts file).
const codes = [...readFileSync('packages/i18n/src/locales.ts', 'utf8').matchAll(/code: '([a-z]{2})'/g)].map(
  (m) => m[1],
);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const code of codes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/app?lang=${code}`);
    await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
    // Every preview image decoded, then a moment for videos' first frames and fonts.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.node-preview img')].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: 30_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const png = await page.screenshot();
    const info = await sharp(png)
      .resize({ width: 1600 })
      .webp({ quality: 82 })
      .toFile(`${OUT}/canvas-${code}.webp`);
    console.log(`${code}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
