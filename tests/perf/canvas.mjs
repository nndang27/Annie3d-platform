// Canvas interaction performance on the production build (BASE_URL, default :4173).
// Seeds a ~200-node guest board into IndexedDB, then measures frame times during
// wheel-pan and pinch-zoom (web-vitals INP does not cover continuous drags; CLAUDE.md).
// Usage: node tests/perf/canvas.mjs [nodes=200]
import { execSync } from 'node:child_process';
import { BASE, buildIdentity, launch, readVitals, save, stats, VITALS_INIT } from './lib.mjs';

const N = Number(process.argv[2] ?? 200);
// --gpu uses the machine's GPU (headed); default is SwiftShader (software raster, CI-like).
const gpu = process.argv.includes('--gpu') ? 'hardware' : 'swiftshader';
const ZOOM = Number((process.argv.find((a) => a.startsWith('--zoom=')) ?? '--zoom=0').slice(7));
const board = execSync(`npx -y tsx tests/perf/seed-board.ts ${N}`, {
  maxBuffer: 64 << 20,
  stdio: ['ignore', 'pipe', 'ignore'],
}).toString();

async function seed(page) {
  await page.goto(BASE);
  await page.waitForSelector('.react-flow__node');
  await page.evaluate(async (json) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('annie3d', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('guest', 'readwrite');
        tx.objectStore('guest').put(JSON.parse(json), 'board');
        tx.oncomplete = resolve;
        tx.onerror = reject;
      };
      req.onerror = reject;
    });
  }, board);
}

/** Records rAF frame deltas while `drive` runs. */
async function measure(page, drive) {
  await page.evaluate(() => {
    window.__frames = [];
    window.__lt = [];
    let last = performance.now();
    window.__rec = true;
    const loop = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__rec) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  const t0 = Date.now();
  await drive();
  const ms = Date.now() - t0;
  const { frames, lt } = await page.evaluate(() => {
    window.__rec = false;
    return { frames: window.__frames.slice(2), lt: window.__lt };
  });
  const s = stats(frames);
  return {
    durationMs: ms,
    fps: Math.round((frames.length / frames.reduce((a, b) => a + b, 0)) * 1000),
    frameMs: { p50: +s.p50.toFixed(1), p95: +s.p95.toFixed(1), max: +s.max.toFixed(1) },
    jankFrames: frames.filter((f) => f > 50).length,
    frames: frames.length,
    longTasks: lt.length,
    longTaskMaxMs: lt.length ? Math.round(Math.max(...lt)) : 0,
  };
}

const results = { build: buildIdentity(), nodes: N, runs: [] };
for (const cpuThrottle of [1, 4]) {
  const { browser, page, env } = await launch({ cpuThrottle: 1, gpu });
  await page.addInitScript(VITALS_INIT);
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  await page.reload();
  await page.waitForSelector('.react-flow__node');
  const load = await readVitals(page);
  // Optional fixed zoom (e.g. --zoom=1) to test culling at working zoom instead of fit-all.
  if (ZOOM) {
    await page.getByTestId('zoom-level').click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 12; i++) {
      const cur = Number((await page.getByTestId('zoom-level').innerText()).replace('%', '')) / 100;
      if (cur >= ZOOM * 0.95) break;
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.waitForTimeout(250);
    }
  }
  const domNodes = await page.locator('.react-flow__node').count();
  await page.mouse.move(700, 450);
  const pan = await measure(page, async () => {
    for (let i = 0; i < 90; i++) {
      await page.mouse.wheel(i < 45 ? 40 : -40, i % 30 < 15 ? 25 : -25);
      await page.waitForTimeout(16);
    }
  });
  const zoom = await measure(page, async () => {
    await page.keyboard.down('Control');
    for (let i = 0; i < 80; i++) {
      await page.mouse.wheel(0, i < 40 ? 12 : -12);
      await page.waitForTimeout(16);
    }
    await page.keyboard.up('Control');
  });
  await page.waitForTimeout(400);
  const domAfterZoom = await page.locator('.react-flow__node').count();
  const heapMB = Math.round((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1048576);
  results.runs.push({
    env: { ...env, cpuThrottle, gpu, zoom: ZOOM || 'fit-all' },
    load: { lcp: load.lcp, fcp: load.fcp, cls: load.cls, longTasks: load.longTasks?.length },
    domNodesRendered: domNodes,
    domNodesAfterZoom: domAfterZoom,
    heapMB,
    pan,
    zoom,
  });
  console.log(
    `cpu x${cpuThrottle}: pan ${pan.fps} fps p95 ${pan.frameMs.p95} ms, zoom ${zoom.fps} fps p95 ${zoom.frameMs.p95} ms, rendered ${domNodes}/${N} nodes, heap ${heapMB} MB`,
  );
  await browser.close();
}
save(`canvas-${N}-${gpu}${ZOOM ? `-z${ZOOM}` : ''}`, results);
