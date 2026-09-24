import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

export const BASE = process.env.BASE_URL ?? 'http://localhost:4173';

export function buildIdentity() {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: new URL('../..', import.meta.url) })
      .toString()
      .trim();
  } catch {}
  return {
    commit,
    node: process.version,
    date: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
  };
}

export async function launch({ cpuThrottle = 1, network = null, gpu = 'swiftshader' } = {}) {
  const args =
    gpu === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({ args, headless: gpu === 'swiftshader' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  if (network) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', network);
  }
  const version = await browser.version();
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  return {
    browser,
    context,
    page,
    cdp,
    env: {
      browser: `Chromium ${version}`,
      renderer,
      cpuThrottle,
      network: network ? `${network.downloadThroughput}B/s ↓ ${network.latency}ms` : 'none',
      viewport: '1440x900 @2x',
    },
  };
}

export const FAST3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

export function save(name, data) {
  mkdirSync('perf-results', { recursive: true });
  writeFileSync(`perf-results/${name}.json`, JSON.stringify(data, null, 2));
  console.log(`saved perf-results/${name}.json`);
}

export function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return {
    n: s.length,
    min: s[0],
    p50: q(0.5),
    p75: q(0.75),
    p95: q(0.95),
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
}

export async function resetDemo(page, scale = 0.05) {
  await page.goto(`${BASE}/app/signin`);
  await page.waitForFunction(() => !!window.__annie3d);
  await page.evaluate(async (scale) => {
    await window.__annie3d.reset();
    localStorage.setItem('annie3d.latencyScale', String(scale));
    localStorage.setItem('annie3d.scenario', 'normal');
  }, scale);
  await page.reload();
  await page.waitForFunction(() => !!window.__annie3d);
}

export async function signIn(page) {
  await page.getByTestId('identity-u_mai').click();
  await page.getByTestId('demo-label').waitFor();
}

/** Web-vitals-style lab metrics via PerformanceObserver injected before navigation. */
export const VITALS_INIT = `
window.__vitals = { lcp: null, cls: 0, fcp: null, ttfb: null, longTasks: [] };
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.lcp = { time: e.startTime, size: e.size, url: e.url || null, element: e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') : null }; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__vitals.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
} catch {}
`;

export async function readVitals(page) {
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.replace(location.origin, ''),
      transfer: r.transferSize,
      type: r.initiatorType,
    }));
    return {
      ...window.__vitals,
      ttfb: nav ? nav.responseStart : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      load: nav ? nav.loadEventEnd : null,
      resources: res,
      totalTransfer: res.reduce((s, r) => s + (r.transfer || 0), 0),
      jsTransfer: res.filter((r) => /\.js/.test(r.name)).reduce((s, r) => s + (r.transfer || 0), 0),
    };
  });
}
