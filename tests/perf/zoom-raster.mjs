// Raster work caused by zooming (warm cache): traces Chrome for Testing during pinch-zoom bursts and
// sums GPU-process raster time (tile raster for page content) and counts long frames, split into
// "while zooming" and "after the gesture stops". Also saves a screenshot 1 s after the last burst,
// to check that text is sharp again once zooming stops.
// Usage: node tests/perf/zoom-raster.mjs <url> <label>   (INJECT_CSS='…' to try a stylesheet)
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [url, label = 'run'] = process.argv.slice(2);
const out = join(tmpdir(), `annie3d-zoom-raster-${label}.json`);
const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,990'] });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.goto(url);
await page.waitForSelector('.react-flow__node');
if (process.env.INJECT_CSS) await page.addStyleTag({ content: process.env.INJECT_CSS });
await page.waitForTimeout(2500);
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
await page.mouse.move(size.w / 2, size.h / 2);

await browser.startTracing(page, { path: out, categories: ['gpu', 'cc', 'viz', 'benchmark'] });
await page.evaluate(() => {
  const r = { frames: [], on: true };
  window.__z = r;
  let last = performance.now();
  const loop = (t) => {
    r.frames.push([Math.round(last), +(t - last).toFixed(1)]);
    last = t;
    if (r.on) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const bursts = [];
await page.keyboard.down('Control');
for (let k = 0; k < 8; k++) {
  const start = await page.evaluate(() => performance.now());
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, k % 4 < 2 ? -8 : 8);
    await page.waitForTimeout(16);
  }
  bursts.push([start, await page.evaluate(() => performance.now())]);
  await page.waitForTimeout(500);
}
await page.keyboard.up('Control');
await page.waitForTimeout(1000);
const frames = await page.evaluate(() => {
  window.__z.on = false;
  return window.__z.frames;
});
await browser.stopTracing();
await page.screenshot({ path: join(tmpdir(), `annie3d-zoom-raster-${label}.png`) });
await browser.close();

const inBurst = (t) => bursts.some(([a, b]) => t >= a && t <= b + 50);
const long = (f) => f.filter(([, d]) => d > 12).length;
const events = JSON.parse(readFileSync(out, 'utf8')).traceEvents;
const procs = new Map(events.filter((e) => e.name === 'process_name').map((e) => [e.pid, e.args.name]));
const raster = events.filter(
  (e) => e.ph === 'X' && /GPU/.test(procs.get(e.pid) ?? '') && e.name === 'RendererRasterWorker',
);
const rasterMs = raster.reduce((s, e) => s + e.dur, 0) / 1000;
console.log(
  `${label.padEnd(12)} GPU raster ${rasterMs.toFixed(0)} ms in ${raster.length} tasks | frames>12ms: zooming ${long(frames.filter(([t]) => inBurst(t)))}, after ${long(frames.filter(([t]) => !inBurst(t)))} | frames ${frames.length}`,
);
