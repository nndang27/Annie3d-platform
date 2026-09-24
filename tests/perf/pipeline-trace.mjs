// Which GPU pipelines does a zoom compile? Traces Chrome for Testing (Skia Graphite on Dawn/Metal)
// while pinch-zooming in bursts and prints every pipeline created, in time order, with its compile
// time. Run with a cold cache (node tests/perf/cold-compare.mjs moves it aside) to see first use.
// Labels read like "[BGRA8+D16] CoverBoundsRenderStep + $1DBlur12[…]": $…Blur = a CSS blur or
// blurred box-shadow, RadialGradient = a CSS gradient, AnalyticClip = drawn under a rounded clip.
// Usage: node tests/perf/pipeline-trace.mjs <url> [out.json]
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? join(tmpdir(), 'annie3d-pipeline-trace.json');
const browser = await chromium.launch({ headless: false, args: ['--window-size=1440,990'] });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.goto(url);
await page.waitForSelector('.react-flow__node');
await page.waitForTimeout(2500);
await browser.startTracing(page, {
  path: out,
  categories: ['disabled-by-default-skia.shaders', 'gpu', 'gpu.dawn', 'disabled-by-default-gpu.dawn'],
});
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
await page.mouse.move(size.w / 2, size.h / 2);
await page.keyboard.down('Control');
for (let k = 0; k < 8; k++) {
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, k % 4 < 2 ? -8 : 8);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(300);
}
await page.keyboard.up('Control');
await browser.stopTracing();
await browser.close();

const trace = JSON.parse(readFileSync(out, 'utf8'));
const events = trace.traceEvents ?? trace;
let t0 = Number.POSITIVE_INFINITY;
for (const e of events) if (e.ts && e.ts < t0) t0 = e.ts;
const created = events
  .filter((e) => e.name === 'CreatePipelineAsyncEvent::InitializeImpl')
  .sort((a, b) => a.ts - b.ts);
for (const e of created)
  console.log(
    `${String(Math.round((e.ts - t0) / 1000)).padStart(6)} ms  ${String(Math.round(e.dur / 1000)).padStart(4)} ms  ${e.args.label}`,
  );
console.log(`${created.length} pipelines; trace: ${out}`);
