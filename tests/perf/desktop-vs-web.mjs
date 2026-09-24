// Same build, same interactions: Chrome vs the packaged desktop app (web pack served from disk)
// vs the desktop app loading the site directly (no protocol interception).
// Needs `vite preview` on :4173 and a packaged app (pnpm --filter @annie3d/desktop run pack).
// Usage: node tests/perf/desktop-vs-web.mjs [--only=chrome,app,app-direct]
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, _electron as electron } from '@playwright/test';
import { buildIdentity, save, stats } from './lib.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const APP =
  process.env.ANNIE3D_APP ??
  fileURLToPath(
    new URL('../../apps/desktop/release/mac-arm64/Annie 3D.app/Contents/MacOS/Annie 3D', import.meta.url),
  );
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=chrome,app,app-direct')
  .slice(7)
  .split(',');

/** Event Timing entries + our own pointer queueing delay, recorded before the page runs. */
const INIT = `
window.__ev = []; window.__q = [];
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ name: e.name, id: e.interactionId, start: e.startTime, dur: e.duration, delay: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart, present: e.startTime + e.duration - e.processingEnd }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch {}
for (const t of ['pointerdown', 'pointermove', 'keydown', 'wheel'])
  addEventListener(t, (e) => { const d = performance.now() - e.timeStamp; requestAnimationFrame(() => requestAnimationFrame(() => window.__q.push({ t, queue: d, toFrame: performance.now() - e.timeStamp }))); }, { capture: true, passive: true });
`;

async function rafRate(page, ms = 1500) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const f = [];
        let last = performance.now();
        const t0 = last;
        const loop = (t) => {
          f.push(t - last);
          last = t;
          if (t - t0 < ms) requestAnimationFrame(loop);
          else resolve(f.slice(2));
        };
        requestAnimationFrame(loop);
      }),
    ms,
  );
}

async function measureFrames(page, drive) {
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    window.__rec = true;
    const loop = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__rec) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await drive();
  const frames = await page.evaluate(() => {
    window.__rec = false;
    return window.__frames.slice(2);
  });
  const s = stats(frames);
  return {
    fps: Math.round((frames.length / frames.reduce((a, b) => a + b, 0)) * 1000),
    p50: +s.p50.toFixed(1),
    p95: +s.p95.toFixed(1),
    max: +s.max.toFixed(1),
  };
}

async function scenario(page) {
  await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const env = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      ua: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
      dpr: devicePixelRatio,
      size: `${innerWidth}x${innerHeight}`,
    };
  });
  const idle = stats(await rafRate(page));
  const box = await page.locator('.react-flow__node').first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + 12;
  // Clicks on empty canvas and on a node (selection).
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(150);
    await page.mouse.click(40, 300);
    await page.waitForTimeout(150);
  }
  // Drag a node.
  const drag = await measureFrames(page, async () => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 60; i++) {
      await page.mouse.move(cx + (i < 30 ? i : 60 - i) * 4, cy + (i < 30 ? i : 60 - i) * 2);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  });
  // Pan with the wheel.
  await page.mouse.move(700, 450);
  const pan = await measureFrames(page, async () => {
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(i < 30 ? 40 : -40, 0);
      await page.waitForTimeout(16);
    }
  });
  // Context menu open/close.
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(600, 500, { button: 'right' });
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(800);
  const { ev, q } = await page.evaluate(() => ({ ev: window.__ev, q: window.__q }));
  const inter = ev.filter((e) => e.id);
  const summarize = (arr, k) => {
    const s = stats(arr.map((x) => x[k]));
    return s.n
      ? { n: s.n, p50: +s.p50.toFixed(1), p95: +s.p95.toFixed(1), max: +s.max.toFixed(1) }
      : { n: 0 };
  };
  return {
    env,
    idleFrameMs: { p50: +idle.p50.toFixed(2), hz: Math.round(1000 / idle.p50) },
    interactions: {
      duration: summarize(inter, 'dur'),
      inputDelay: summarize(inter, 'delay'),
      processing: summarize(inter, 'proc'),
      presentation: summarize(inter, 'present'),
    },
    pointerQueueMs: summarize(
      q.filter((x) => x.t !== 'wheel'),
      'queue',
    ),
    pointerToSecondFrameMs: summarize(
      q.filter((x) => x.t === 'pointerdown'),
      'toFrame',
    ),
    drag,
    pan,
  };
}

async function runChrome() {
  // No viewport emulation: the real window at the display's own pixel ratio, like the app.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1440,990'],
  });
  const ctx = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.goto(BASE);
  const r = await scenario(page);
  r.requests = await page.evaluate(() => performance.getEntriesByType('resource').length);
  await browser.close();
  return r;
}

async function runApp(direct) {
  const userData = mkdtempSync(join(tmpdir(), 'annie3d-perf-'));
  const app = await electron.launch({
    executablePath: APP,
    env: {
      ...process.env,
      ANNIE3D_ORIGIN: BASE,
      ANNIE3D_USER_DATA: userData,
      ANNIE3D_ALLOW_UNSIGNED: '1',
      ...(direct ? { ANNIE3D_DEV_URL: BASE } : {}),
    },
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900 + 28));
  await page.addInitScript(INIT);
  await page.reload();
  const gpu = await app.evaluate(({ app }) => app.getGPUFeatureStatus());
  // Main process = the browser UI thread that receives real OS input: record how late a 5 ms
  // timer fires (event-loop blocking) and every request the window makes.
  await app.evaluate(({ session }) => {
    globalThis.__lag = [];
    globalThis.__req = [];
    let last = performance.now();
    globalThis.__lagTimer = setInterval(() => {
      const now = performance.now();
      globalThis.__lag.push(now - last - 5);
      last = now;
    }, 5);
    session.defaultSession.webRequest.onCompleted((d) =>
      globalThis.__req.push({ host: new URL(d.url).host, type: d.resourceType, cached: d.fromCache }),
    );
  });
  const r = await scenario(page);
  const main = await app.evaluate(() => {
    clearInterval(globalThis.__lagTimer);
    return { lag: globalThis.__lag, req: globalThis.__req };
  });
  const lag = stats(main.lag);
  r.mainProcess = {
    timerLateMs: { p50: +lag.p50.toFixed(1), p95: +lag.p95.toFixed(1), max: +lag.max.toFixed(1) },
    blockedOver16ms: main.lag.filter((x) => x > 16).length,
    requests: main.req.length,
    byHost: Object.fromEntries(Map.groupBy(main.req, (x) => x.host).entries().map(([h, l]) => [h, l.length])),
  };
  await app.close();
  rmSync(userData, { recursive: true, force: true });
  return { ...r, gpuFeatureStatus: gpu };
}

const results = { build: buildIdentity(), base: BASE, app: APP, runs: {} };
if (only.includes('chrome')) results.runs.chrome = await runChrome();
if (only.includes('app')) results.runs.app = await runApp(false);
if (only.includes('app-direct')) results.runs['app-direct'] = await runApp(true);
for (const [k, r] of Object.entries(results.runs))
  console.log(
    `${k.padEnd(10)} ${r.env.ua} idle ${r.idleFrameMs.hz} Hz | interaction p50 ${r.interactions.duration.p50} ms (delay ${r.interactions.inputDelay.p50}, present ${r.interactions.presentation.p50}) n=${r.interactions.duration.n} | queue p50 ${r.pointerQueueMs.p50} | down→2nd frame p50 ${r.pointerToSecondFrameMs.p50} | drag ${r.drag.fps} fps p95 ${r.drag.p95} | pan ${r.pan.fps} fps p95 ${r.pan.p95}`,
  );
for (const [k, r] of Object.entries(results.runs))
  if (r.mainProcess) console.log(k, 'main', JSON.stringify(r.mainProcess));
save(`desktop-vs-web-${new URL(BASE).hostname.split('.')[0]}`, results);
