// Hitches ("one stall, then it continues") during zoom bursts and pointer sweeps, Chrome vs the
// packaged desktop app, same site. Records every frame gap over 25 ms, Long Animation Frame
// entries (what the frame spent its time on) and images loaded during the run.
// Usage: node tests/perf/hitch.mjs [origin] [--only=chrome,app] [--reps=3]
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, _electron as electron } from '@playwright/test';
import { buildIdentity, save } from './lib.mjs';

const ORIGIN = process.argv.find((a) => a.startsWith('http')) ?? 'https://annie3d.nndang2701.workers.dev';
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=chrome,app').slice(7).split(',');
const REPS = Number((process.argv.find((a) => a.startsWith('--reps=')) ?? '--reps=3').slice(7));
const APP =
  process.env.ANNIE3D_APP ??
  fileURLToPath(
    new URL('../../apps/desktop/release/mac-arm64/Annie 3D.app/Contents/MacOS/Annie 3D', import.meta.url),
  );

async function record(page, drive) {
  await page.evaluate(() => {
    const r = { t0: performance.now(), gaps: [], loaf: [], on: true };
    window.__h = r;
    let last = performance.now();
    const loop = (t) => {
      if (t - last > 25) r.gaps.push({ at: Math.round(last - r.t0), ms: +(t - last).toFixed(1) });
      last = t;
      if (r.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    r.obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        r.loaf.push({
          at: Math.round(e.startTime - r.t0),
          ms: Math.round(e.duration),
          blocking: Math.round(e.blockingDuration),
          renderMs: Math.round(e.startTime + e.duration - e.renderStart),
          styleLayoutMs: Math.round(e.startTime + e.duration - e.styleAndLayoutStart),
          scripts: e.scripts.map((s) =>
            `${s.invokerType}:${s.invoker} ${Math.round(s.duration)}ms ${s.sourceFunctionName || ''}`.trim(),
          ),
        });
    });
    r.obs.observe({ type: 'long-animation-frame' });
  });
  await drive();
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const r = window.__h;
    r.on = false;
    r.obs.disconnect();
    const imgs = performance
      .getEntriesByType('resource')
      .filter((e) => e.initiatorType === 'img' && e.startTime > r.t0)
      .map((e) => ({
        at: Math.round(e.startTime - r.t0),
        ms: Math.round(e.duration),
        name: e.name.split('/').slice(-2).join('/'),
      }));
    return { gaps: r.gaps, loaf: r.loaf, imgs };
  });
}

async function scenario(page) {
  await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
  const cx = size.w / 2;
  const cy = size.h / 2;
  await page.mouse.move(cx, cy);
  // Pinch zoom (ctrl+wheel) in bursts with pauses longer than the 150 ms LOD settle.
  const zoom = await record(page, async () => {
    await page.keyboard.down('Control');
    for (let b = 0; b < 8; b++) {
      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, b % 4 < 2 ? -8 : 8);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(300);
    }
    await page.keyboard.up('Control');
  });
  // Pointer sweeps across the board (hover over nodes, stacked images, ports).
  const sweep = await record(page, async () => {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i <= 60; i++) {
        await page.mouse.move(40 + ((size.w - 80) * i) / 60, cy + Math.sin(i / 6) * size.h * 0.3);
        await page.waitForTimeout(16);
      }
      for (let i = 0; i <= 40; i++) {
        await page.mouse.move(cx + Math.cos(i / 5) * size.w * 0.3, 60 + ((size.h - 120) * i) / 40);
        await page.waitForTimeout(16);
      }
    }
  });
  return { size, zoom, sweep };
}

async function runChrome() {
  // CHROME=cft uses Playwright's Chrome for Testing (its own shader cache) instead of Google Chrome.
  const channel = process.env.CHROME === 'cft' ? undefined : 'chrome';
  const browser = await chromium.launch({ channel, headless: false, args: ['--window-size=1440,990'] });
  const page = await (await browser.newContext({ viewport: null })).newPage();
  await page.goto(ORIGIN);
  const r = await scenario(page);
  r.gpu = `browser=${browser.version()}`;
  await browser.close();
  return r;
}

async function runApp() {
  // HITCH_USER_DATA measures a real profile (kept); otherwise a fresh temporary one (deleted).
  const keep = process.env.HITCH_USER_DATA;
  const userData = keep ?? mkdtempSync(join(tmpdir(), 'annie3d-hitch-'));
  const app = await electron.launch({
    executablePath: APP,
    // Extra Chromium switches for experiments, e.g. APP_ARGS=--disable-features=SkiaGraphite
    args: (process.env.APP_ARGS ?? '').split(' ').filter(Boolean),
    env: { ...process.env, ANNIE3D_ORIGIN: ORIGIN, ANNIE3D_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 928));
  let warmMs = 0;
  if (process.env.WARMUP === 'hidden') {
    // Experiment: draw the board in a hidden window (zoom bursts, pointer sweep) before the user does.
    warmMs = await app.evaluate(async ({ BrowserWindow }, origin) => {
      const t0 = Date.now();
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const w = new BrowserWindow({
        show: false,
        width: 1440,
        height: 900,
        paintWhenInitiallyHidden: true,
        webPreferences: { backgroundThrottling: false },
      });
      await w.loadURL(`${origin}/`);
      await w.webContents.executeJavaScript(
        "new Promise((r) => { const t = () => (document.querySelector('.react-flow__node') ? r() : setTimeout(t, 50)); t(); })",
      );
      for (let b = 0; b < 8; b++) {
        for (let i = 0; i < 15; i++) {
          w.webContents.sendInputEvent({
            type: 'mouseWheel',
            x: 720,
            y: 450,
            deltaX: 0,
            deltaY: b % 4 < 2 ? 8 : -8,
            modifiers: ['control'],
            canScroll: true,
          });
          await sleep(16);
        }
        await sleep(300);
      }
      for (let i = 0; i < 120; i++) {
        w.webContents.sendInputEvent({
          type: 'mouseMove',
          x: 40 + i * 11,
          y: Math.round(450 + Math.sin(i / 6) * 250),
        });
        await sleep(16);
      }
      w.destroy();
      return Date.now() - t0;
    }, ORIGIN);
  }
  const r = await scenario(page);
  r.warmMs = warmMs;
  // A switch that silently drops to software compositing also "removes" GPU stalls: record it.
  const g = await app.evaluate(({ app }) => app.getGPUFeatureStatus());
  r.gpu = `compositing=${g.gpu_compositing} graphite=${g.skia_graphite} webgl=${g.webgl} warmup=${r.warmMs}ms`;
  await app.close();
  if (!keep) rmSync(userData, { recursive: true, force: true });
  return r;
}

const line = (k, part) =>
  `${k.padEnd(7)} gaps>25ms ${String(part.gaps.length).padStart(2)} worst ${Math.max(0, ...part.gaps.map((g) => g.ms))} ms | LoAF ${part.loaf.length} | imgs ${part.imgs.length}`;
const results = { build: buildIdentity(), origin: ORIGIN, runs: [] };
for (let rep = 0; rep < REPS; rep++) {
  const run = {};
  if (only.includes('chrome')) run.chrome = await runChrome();
  if (only.includes('app')) run.app = await runApp();
  results.runs.push(run);
  for (const [k, r] of Object.entries(run))
    console.log(
      `rep ${rep} zoom  ${line(k, r.zoom)}\nrep ${rep} sweep ${line(k, r.sweep)}${r.gpu ? `\nrep ${rep} gpu   ${r.gpu}` : ''}`,
    );
}
save(`hitch-${new URL(ORIGIN).hostname.split('.')[0]}`, results);
