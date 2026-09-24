// Feature timings as the app itself reports them (Performance panel, lib/perf.ts budgets), plus
// the slowest interactions (Event Timing) and frame gaps, for a first-time visitor: open the 3D
// editor and the simulator twice each, duplicate and undo, open the context menu.
// Usage: node tests/perf/features.mjs <url> [--cold] [--net]
//   --cold empties the GPU shader cache; --net emulates a 10 Mbps / 40 ms broadband link
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
if (process.argv.includes('--cold')) {
  const cache = join(
    execSync('getconf DARWIN_USER_CACHE_DIR').toString().trim(),
    'com.google.chrome.for.testing.helper',
  );
  if (existsSync(cache)) {
    mkdirSync(join(tmpdir(), 'annie3d-cold-cache'), { recursive: true });
    renameSync(cache, join(tmpdir(), 'annie3d-cold-cache', `${Date.now()}`));
  }
}
const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,990'] });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.addInitScript(() => {
  const r = { ev: [], gaps: [], t0: 0 };
  window.__f = r;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      if (e.interactionId) r.ev.push({ name: e.name, dur: e.duration, at: Math.round(e.startTime) });
  }).observe({ type: 'event', durationThreshold: 40 });
  r.loaf = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      r.loaf.push({
        at: Math.round(e.startTime),
        ms: Math.round(e.duration),
        blocking: Math.round(e.blockingDuration),
        layoutMs: Math.round(e.startTime + e.duration - e.styleAndLayoutStart),
        scripts: e.scripts
          .filter((x) => x.duration > 10)
          .map(
            (x) =>
              `${Math.round(x.duration)}ms ${x.invokerType} ${x.sourceFunctionName || '?'} @${(x.sourceURL || '').split('/').pop()}`,
          ),
      });
  }).observe({ type: 'long-animation-frame', buffered: true });
  let last = 0;
  const loop = (t) => {
    if (last && t - last > 50) r.gaps.push([Math.round(last), Math.round(t - last)]);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
if (process.argv.includes('--net')) {
  // A typical broadband link (10 Mbps down, 40 ms round trip), so downloads cost what they do online.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: (10 * 1024 * 1024) / 8,
    uploadThroughput: (5 * 1024 * 1024) / 8,
  });
}
await page.goto(url);
await page.waitForSelector('.react-flow__node');
await page.waitForTimeout(2500);
const mark = async (label) =>
  page.evaluate((l) => {
    window.__f.marks = window.__f.marks ?? [];
    window.__f.marks.push([l, Math.round(performance.now())]);
  }, label);

for (let i = 0; i < 2; i++) {
  await mark(`editor ${i + 1}`);
  const model = page
    .locator('.react-flow__node')
    .filter({ has: page.getByTestId('open-3d') })
    .first();
  await model.hover();
  await page.waitForTimeout(300); // a person's pointer rests on the node before clicking
  await model.getByTestId('open-3d').click();
  await page.getByTestId('editor').waitFor();
  await page
    .locator('.editor-loading-inline')
    .waitFor({ state: 'detached', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}
for (let i = 0; i < 2; i++) {
  await mark(`simulator ${i + 1}`);
  await page.getByTestId('open-sim').first().hover();
  await page.waitForTimeout(300);
  await page.getByTestId('open-sim').first().click();
  await page.getByRole('button', { name: 'Close simulator' }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}
await mark('duplicate+undo');
const any = page.locator('.react-flow__node').filter({ hasText: 'Headline' }).first();
await any.click({ position: { x: 20, y: 6 } });
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('ControlOrMeta+d');
  await page.waitForTimeout(250);
}
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(250);
}
await mark('context menu');
for (let i = 0; i < 3; i++) {
  await page.mouse.click(700, 120, { button: 'right' });
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}
await page.keyboard.press('Alt+KeyP');
await page.getByTestId('perf-panel').waitFor();
const panel = await page
  .getByTestId('perf-panel')
  .evaluate((el) =>
    [...el.querySelectorAll('tr[data-testid]')]
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()).join(' | '))
      .filter((row) => !/—/.test(row)),
  );
const f = await page.evaluate(() => window.__f);
f.res = await page.evaluate(() =>
  performance.getEntriesByType('resource').map((r) => ({
    at: Math.round(r.startTime),
    ms: Math.round(r.duration),
    kb: Math.round((r.encodedBodySize || 0) / 1024),
    name: r.name.split('/').pop().split('?')[0],
  })),
);
await browser.close();

const phase = (t) => [...(f.marks ?? [])].reverse().find(([, at]) => at <= t)?.[0] ?? 'load';
console.log('Performance panel (measured by the app):');
for (const row of panel) console.log(`  ${row}`);
console.log('Interactions over 40 ms (Event Timing):');
for (const e of f.ev.sort((a, b) => b.dur - a.dur).slice(0, 12))
  console.log(`  ${String(Math.round(e.dur)).padStart(5)} ms  ${e.name.padEnd(12)} ${phase(e.at)}`);
console.log(
  'Long animation frames over 50 ms before the first action (page load and idle preloads):',
  f.loaf
    .filter((x) => x.ms > 50 && x.at < (f.marks?.[0]?.[1] ?? 0))
    .map((x) => `${x.ms} ms @${x.at}`)
    .join(', ') || 'none',
);
console.log('Long animation frames over 100 ms (what the main thread did):');
for (const l of f.loaf.filter((x) => x.ms > 100 && x.at > (f.marks?.[0]?.[1] ?? 0)))
  console.log(
    `  ${String(l.ms).padStart(5)} ms (blocking ${l.blocking}, style+layout ${l.layoutMs})  ${phase(l.at)}\n      ${l.scripts.join('\n      ') || '(no script over 10 ms)'}`,
  );
console.log('Downloads during each action:');
for (const r of f.res.filter((x) => x.at > (f.marks?.[0]?.[1] ?? 0)))
  console.log(
    `  ${phase(r.at).padEnd(16)} ${String(r.ms).padStart(5)} ms ${String(r.kb).padStart(6)} KB  ${r.name}`,
  );
console.log('Frame gaps over 50 ms:');
for (const [at, ms] of f.gaps.filter(([at]) => at > (f.marks?.[0]?.[1] ?? 0)).slice(0, 20))
  console.log(`  ${String(ms).padStart(5)} ms  ${phase(at)}`);
