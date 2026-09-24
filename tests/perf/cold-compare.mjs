// First-use GPU stalls in Chrome for Testing with a cold shader cache, for any board app.
// Moves Chrome for Testing's macOS Metal cache aside (our test browser only, never Google Chrome),
// opens the site, draws a few shapes on third-party boards, then pinch-zooms in bursts and sweeps
// the pointer, counting frame gaps over 25 ms. Deterministic enough to bisect (same count per run).
// Usage: node tests/perf/cold-compare.mjs <name> <url> [--warm]
//   INJECT_CSS='…'  add a stylesheet before measuring (bisect which effects cause stalls)
//   CHROME_ARGS='…' extra Chromium switches
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [name, url] = process.argv.slice(2);
if (!process.argv.includes('--warm')) {
  const cache = join(
    execSync('getconf DARWIN_USER_CACHE_DIR').toString().trim(),
    'com.google.chrome.for.testing.helper',
  );
  if (existsSync(cache)) {
    const aside = join(tmpdir(), 'annie3d-cold-cache');
    mkdirSync(aside, { recursive: true });
    renameSync(cache, join(aside, `${Date.now()}`));
  }
}

const args = ['--window-size=1440,990', ...(process.env.CHROME_ARGS ?? '').split(' ').filter(Boolean)];
const browser = await chromium.launch({ headless: false, args });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
if (name === 'annie3d') await page.waitForSelector('.react-flow__node');
else {
  // Excalidraw / tldraw: 12 rectangles and ellipses, each with a text label.
  await page.keyboard.press('Escape');
  for (let i = 0; i < 12; i++) {
    const x = 200 + (i % 4) * 280;
    const y = 180 + Math.floor(i / 4) * 220;
    await page.keyboard.press(i % 2 ? 'o' : 'r');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 200, y + 130, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await page.keyboard.press('t');
    await page.mouse.click(x + 20, y + 170);
    await page.keyboard.type(`Label ${i} product photo`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
}
if (process.env.INJECT_CSS) await page.addStyleTag({ content: process.env.INJECT_CSS });
await page.waitForTimeout(1500);

/** Frame gaps over 25 ms while `drive` runs, as "ms@time". */
async function gaps(drive) {
  await page.evaluate(() => {
    const r = { gaps: [], on: true, t0: performance.now() };
    window.__h = r;
    let last = performance.now();
    const loop = (t) => {
      if (t - last > 25) r.gaps.push(`${(t - last).toFixed(1)}@${Math.round(last - r.t0)}`);
      last = t;
      if (r.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await drive();
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    window.__h.on = false;
    return window.__h.gaps;
  });
}

await page.mouse.move(size.w / 2, size.h / 2);
const zoom = await gaps(async () => {
  await page.keyboard.down('Control');
  for (let k = 0; k < 8; k++) {
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, k % 4 < 2 ? -8 : 8);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(300);
  }
  await page.keyboard.up('Control');
});
const sweep = await gaps(async () => {
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i <= 60; i++) {
      await page.mouse.move(40 + ((size.w - 80) * i) / 60, size.h / 2 + Math.sin(i / 6) * size.h * 0.3);
      await page.waitForTimeout(16);
    }
});
const fmt = (g) =>
  `${String(g.length).padStart(2)} stalls, worst ${g.length ? Math.max(...g.map(parseFloat)) : 0} ms [${g.join(' ')}]`;
console.log(`${name.padEnd(10)} zoom ${fmt(zoom)} | sweep ${fmt(sweep)}`);
await browser.close();
