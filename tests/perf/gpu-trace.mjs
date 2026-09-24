// Which GPU work stalls a cold first zoom / pointer sweep? Records a Chromium trace (GPU process
// included) with Electron's contentTracing while running the hitch scenario, then lists the
// longest GPU-side events. Use a copy of the app in a new folder to get a cold shader cache
// without touching the user's cache: node tests/perf/gpu-trace.mjs "<path to copy>/Annie 3D.app/Contents/MacOS/Annie 3D"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from '@playwright/test';

const APP = process.argv[2];
const ORIGIN = process.env.ORIGIN ?? 'https://annie3d.nndang2701.workers.dev';
const userData = mkdtempSync(join(tmpdir(), 'annie3d-trace-'));
const app = await electron.launch({
  executablePath: APP,
  env: { ...process.env, ANNIE3D_ORIGIN: ORIGIN, ANNIE3D_USER_DATA: userData },
});
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 928));
await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
await page.waitForTimeout(2000);
await app.evaluate(({ contentTracing }) =>
  contentTracing.startRecording({
    included_categories: [
      'disabled-by-default-skia.shaders',
      'gpu.dawn',
      'gpu',
      'skia',
      'viz',
      'cc',
      'disabled-by-default-skia',
      'disabled-by-default-skia.gpu',
      'disabled-by-default-gpu.dawn',
      'gpu.graphite.dawn',
      'benchmark',
    ],
  }),
);
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
const cx = size.w / 2;
const cy = size.h / 2;
await page.mouse.move(cx, cy);
await page.keyboard.down('Control');
for (let b = 0; b < 8; b++) {
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, b % 4 < 2 ? -8 : 8);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(300);
}
await page.keyboard.up('Control');
for (let pass = 0; pass < 3; pass++)
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(40 + ((size.w - 80) * i) / 60, cy + Math.sin(i / 6) * size.h * 0.3);
    await page.waitForTimeout(16);
  }
const file = await app.evaluate(({ contentTracing }) => contentTracing.stopRecording());
await app.close();
rmSync(userData, { recursive: true, force: true });

const trace = JSON.parse(readFileSync(file, 'utf8'));
const events = trace.traceEvents ?? trace;
const procs = new Map(events.filter((e) => e.name === 'process_name').map((e) => [e.pid, e.args.name]));
const threads = new Map(
  events.filter((e) => e.name === 'thread_name').map((e) => [`${e.pid}:${e.tid}`, e.args.name]),
);
const long = events
  .filter((e) => e.ph === 'X' && e.dur > 8000 && /GPU/i.test(procs.get(e.pid) ?? ''))
  .map((e) => ({
    ms: +(e.dur / 1000).toFixed(1),
    name: e.name,
    cat: e.cat,
    thread: threads.get(`${e.pid}:${e.tid}`),
    args: JSON.stringify(e.args ?? {}).slice(0, 300),
  }))
  .sort((a, b) => b.ms - a.ms);
const byName = new Map();
for (const e of long)
  byName.set(e.name, {
    n: (byName.get(e.name)?.n ?? 0) + 1,
    ms: +((byName.get(e.name)?.ms ?? 0) + e.ms).toFixed(1),
  });
console.log('GPU-process events over 8 ms, grouped:');
for (const [n, v] of [...byName].sort((a, b) => b[1].ms - a[1].ms).slice(0, 25))
  console.log(`  ${String(v.n).padStart(3)}x ${String(v.ms).padStart(7)} ms  ${n}`);
let t0 = Number.POSITIVE_INFINITY;
for (const e of events) if (e.ts && e.ts < t0) t0 = e.ts;
console.log('GPU pipelines created (start, compile time, label):');
for (const e of events
  .filter((x) => x.name === 'CreatePipelineAsyncEvent::InitializeImpl')
  .sort((a, b) => a.ts - b.ts))
  console.log(
    `  ${String(Math.round((e.ts - t0) / 1000)).padStart(6)} ms ${String(Math.round(e.dur / 1000)).padStart(4)} ms  ${e.args.label}`,
  );
const out = join(tmpdir(), 'annie3d-gpu-trace.json');
writeFileSync(out, JSON.stringify({ long: long.slice(0, 200) }, null, 1));
console.log(`trace: ${file}\nlong events: ${out}`);
