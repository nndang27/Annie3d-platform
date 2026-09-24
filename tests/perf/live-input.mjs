// Real-input comparison: a person uses the board for 40 s in the packaged desktop app, then for
// 40 s in Chrome, on the same site. Records what synthetic (CDP) input cannot: OS input from the
// trackpad/mouse/keyboard, which in Electron passes through the main process first.
// Usage: node tests/perf/live-input.mjs [origin] [--seconds=40] [--only=app,chrome]
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, _electron as electron } from '@playwright/test';
import { buildIdentity, save, stats } from './lib.mjs';

const ORIGIN = process.argv.find((a) => a.startsWith('http')) ?? 'https://annie3d.nndang2701.workers.dev';
const SECONDS = Number((process.argv.find((a) => a.startsWith('--seconds=')) ?? '--seconds=40').slice(10));
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=app,chrome').slice(7).split(',');
const APP =
  process.env.ANNIE3D_APP ??
  fileURLToPath(
    new URL('../../apps/desktop/release/mac-arm64/Annie 3D.app/Contents/MacOS/Annie 3D', import.meta.url),
  );

/** Starts on the first real input, stops SECONDS later; a small badge shows the countdown. */
const INIT = `(() => {
  const S = ${SECONDS};
  const rec = (window.__live = { started: 0, done: false, ev: [], input: [], frames: [], lt: [] });
  try { new PerformanceObserver((l) => { if (!rec.started || rec.done) return; for (const e of l.getEntries()) rec.ev.push({ name: e.name, id: e.interactionId, dur: e.duration, delay: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart, present: e.startTime + e.duration - e.processingEnd }); }).observe({ type: 'event', durationThreshold: 16 }); } catch {}
  try { new PerformanceObserver((l) => { if (rec.started && !rec.done) for (const e of l.getEntries()) rec.lt.push(e.duration); }).observe({ type: 'longtask' }); } catch {}
  let badge;
  const tick = () => {
    const left = Math.max(0, S - (performance.now() - rec.started) / 1000);
    if (badge) badge.textContent = left > 0 ? 'Recording: use the board normally, ' + Math.ceil(left) + ' s' : 'Done. You can close this window.';
    if (left > 0) setTimeout(tick, 250); else rec.done = true;
  };
  const start = () => {
    if (rec.started) return;
    rec.started = performance.now();
    badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#111;color:#fff;font:600 13px system-ui;padding:6px 12px;border-radius:8px;pointer-events:none';
    document.body.appendChild(badge);
    tick();
    let last = performance.now();
    const loop = (t) => { if (rec.done) return; rec.frames.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  };
  for (const t of ['pointerdown', 'pointermove', 'keydown', 'wheel'])
    addEventListener(t, (e) => {
      if (t === 'pointerdown' || t === 'keydown') start();
      if (!rec.started || rec.done) return;
      const queue = performance.now() - e.timeStamp;
      requestAnimationFrame(() => requestAnimationFrame(() => rec.input.push({ t, queue, toFrame: performance.now() - e.timeStamp })));
    }, { capture: true, passive: true });
})();`;

const pick = (arr, k) => {
  const s = stats(arr.map((x) => (k ? x[k] : x)));
  return s.n ? { n: s.n, p50: +s.p50.toFixed(1), p95: +s.p95.toFixed(1), max: +s.max.toFixed(1) } : { n: 0 };
};

const SELFTEST = process.argv.includes('--selftest');

async function collect(page) {
  if (SELFTEST) {
    await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
    await page.mouse.click(700, 450);
    for (let i = 0; i < 40; i++) await page.mouse.move(600 + i * 5, 400 + i * 2);
    await page.mouse.click(400, 300);
  }
  await page.waitForFunction(() => window.__live?.done, null, { timeout: 15 * 60_000, polling: 500 });
  const r = await page.evaluate(() => window.__live);
  const inter = r.ev.filter((e) => e.id);
  const byId = new Map();
  for (const e of inter) byId.set(e.id, Math.max(byId.get(e.id) ?? 0, e.dur));
  return {
    interactions: {
      count: byId.size,
      worstPerInteraction: pick([...byId.values()]),
      inputDelay: pick(inter, 'delay'),
      processing: pick(inter, 'proc'),
      presentation: pick(inter, 'present'),
    },
    inputQueueMs: Object.fromEntries(
      ['pointerdown', 'pointermove', 'keydown', 'wheel'].map((t) => [
        t,
        pick(
          r.input.filter((x) => x.t === t),
          'queue',
        ),
      ]),
    ),
    inputToSecondFrameMs: Object.fromEntries(
      ['pointerdown', 'pointermove', 'keydown', 'wheel'].map((t) => [
        t,
        pick(
          r.input.filter((x) => x.t === t),
          'toFrame',
        ),
      ]),
    ),
    frames: { ...pick(r.frames), over25ms: r.frames.filter((f) => f > 25).length },
    longTasks: pick(r.lt),
  };
}

async function runApp() {
  const userData = mkdtempSync(join(tmpdir(), 'annie3d-live-'));
  const app = await electron.launch({
    executablePath: APP,
    env: { ...process.env, ANNIE3D_ORIGIN: ORIGIN, ANNIE3D_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await page.addInitScript(INIT);
  await page.reload();
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setTitle('Annie 3D app: recording');
    w.show();
    w.focus();
    globalThis.__lag = [];
    let last = performance.now();
    globalThis.__lagTimer = setInterval(() => {
      const now = performance.now();
      globalThis.__lag.push(now - last - 5);
      last = now;
    }, 5);
  });
  console.log('APP window is open: click anywhere on the board to start the recording.');
  const r = await collect(page);
  const lag = await app.evaluate(() => {
    clearInterval(globalThis.__lagTimer);
    return globalThis.__lag;
  });
  r.mainProcessTimerLateMs = { ...pick(lag), over16ms: lag.filter((x) => x > 16).length };
  await app.close();
  rmSync(userData, { recursive: true, force: true });
  return r;
}

async function runChrome() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1440,990'],
  });
  const page = await (await browser.newContext({ viewport: null })).newPage();
  await page.addInitScript(INIT);
  await page.goto(ORIGIN);
  await page.bringToFront();
  console.log('CHROME window is open: click anywhere on the board to start the recording.');
  const r = await collect(page);
  await browser.close();
  return r;
}

const results = { build: buildIdentity(), origin: ORIGIN, seconds: SECONDS, runs: {} };
if (only.includes('app')) results.runs.app = await runApp();
if (only.includes('chrome')) results.runs.chrome = await runChrome();
console.log(JSON.stringify(results.runs, null, 1));
save('live-input', results);
