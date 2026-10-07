// Screenshots of the product for the landing page, one set per language, from the live site.
// Headless (no window opens). Output: apps/site/src/assets/screens/<scene>-<code>.webp (1600 px):
// canvas (the example board), editor (the 3D editor), shop and tiktok (the simulator).
// Usage: node scripts/site-screens.mjs [origin] [--only=canvas,editor,shop,tiktok]
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

// sharp comes with Astro (the site's image pipeline); no extra dependency at the root.
const fromSite = createRequire(new URL('../apps/site/package.json', import.meta.url));
const sharp = createRequire(fromSite.resolve('astro/package.json'))('sharp');

const ORIGIN = process.argv.find((a) => a.startsWith('http')) ?? 'https://annie3d.app';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=canvas,editor,shop,tiktok')
  .slice(7)
  .split(',');
const OUT = 'apps/site/src/assets/screens';
// The one list of languages (plain Node cannot import the .ts file).
const codes = [...readFileSync('packages/i18n/src/locales.ts', 'utf8').matchAll(/code: '([a-z]{2})'/g)].map(
  (m) => m[1],
);

async function shot(page, name, code) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const info = await sharp(await page.screenshot())
    .resize({ width: 1600 })
    .webp({ quality: 82 })
    .toFile(`${OUT}/${name}-${code}.webp`);
  console.log(`${name}-${code}: ${Math.round(info.size / 1024)} KB`);
}

mkdirSync(OUT, { recursive: true });
// WebGL in headless Chromium (the editor and the simulator draw 3D).
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const code of codes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/app?lang=${code}`);
    await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.node-preview img')].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: 30_000 },
    );
    if (ONLY.includes('canvas')) await shot(page, 'canvas', code);

    if (ONLY.includes('editor')) {
      const model = page
        .locator('.react-flow__node')
        .filter({ has: page.locator('[data-testid=open-3d]') })
        .first();
      await model.hover();
      await model.locator('[data-testid=open-3d]').click();
      await page.getByTestId('editor').waitFor();
      await page
        .locator('.editor-loading-inline')
        .waitFor({ state: 'detached', timeout: 30_000 })
        .catch(() => {});
      await page.waitForTimeout(2500);
      await shot(page, 'editor', code);
      await page.getByTestId('editor-back').click();
      await page.getByTestId('editor').waitFor({ state: 'detached' });
    }

    for (const env of ['shop', 'tiktok']) {
      if (!ONLY.includes(env)) continue;
      const sim = page
        .locator('.react-flow__node')
        .filter({ has: page.locator('[data-testid=open-sim]') })
        .first();
      await sim.locator('[data-testid=open-sim]').click();
      const overlay = page.getByTestId('simulator');
      await overlay.waitFor();
      await overlay.getByTestId(`sim-env-${env}`).click();
      await overlay.getByTestId('sim-canvas').waitFor();
      await page.waitForTimeout(3000);
      await shot(page, env, code);
      await page.keyboard.press('Escape');
      await overlay.waitFor({ state: 'detached' });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
