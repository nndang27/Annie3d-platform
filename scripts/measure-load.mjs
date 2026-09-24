// Page-load measurement for any Annie 3D URL (local, `pnpm share` tunnel, production).
// Usage: pnpm measure <url> [--runs 3]
// Loads the canvas in headless Chromium, cold (new profile) and warm (cached), and prints
// TTFB, FCP, LCP, "board ready" (first nodes on screen) and "images ready" (all visible previews
// decoded) against the budgets in docs/PERFORMANCE_STANDARDS.md.
import { execSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const url = process.argv[2];
if (!url) {
  console.error('usage: pnpm measure <url> [--runs N]');
  process.exit(1);
}
const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 3;
const BUDGET = {
  ttfb: [800, 1800],
  fcp: [1800, 3000],
  lcp: [2500, 4000],
  board: [2500, 4000],
  images: [3000, 5000],
};

// A fresh *.trycloudflare.com name can be missing from this machine's DNS cache for a while:
// resolve it through 1.1.1.1 and pin it for the browser.
const host = new URL(url).hostname;
const args = [];
if (host.endsWith('.trycloudflare.com')) {
  const ip = execSync(`dig +short @1.1.1.1 ${host}`).toString().trim().split('\n')[0];
  if (ip) args.push(`--host-resolver-rules=MAP ${host} ${ip}`);
}
const browser = await chromium.launch({ args });

async function once(ctx) {
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('.react-flow__node .node-preview', { timeout: 60_000 });
  const board = Date.now() - t0;
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('.node-preview img')];
      return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
    },
    null,
    { timeout: 60_000 },
  );
  const images = Date.now() - t0;
  const m = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const lcp = await new Promise((res) => {
      new PerformanceObserver((l) => res(l.getEntries().at(-1)?.startTime ?? 0)).observe({
        type: 'largest-contentful-paint',
        buffered: true,
      });
      setTimeout(() => res(0), 1000);
    });
    const rs = performance.getEntriesByType('resource');
    return {
      ttfb: Math.round(nav.responseStart),
      fcp: Math.round(fcp),
      lcp: Math.round(lcp),
      requests: rs.length,
      kb: Math.round(rs.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
      slowest: Math.round(Math.max(0, ...rs.map((r) => r.duration))),
    };
  });
  await page.close();
  return { ...m, board, images };
}

const rows = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  rows.push({ run: `cold ${i + 1}`, ...(await once(ctx)) });
  rows.push({ run: `warm ${i + 1}`, ...(await once(ctx)) });
  await ctx.close();
}
await browser.close();

const mark = (k, v) => {
  const b = BUDGET[k];
  if (!b) return String(v);
  return `${v}${v <= b[0] ? ' ✓' : v > b[1] ? ' ✗' : ' ~'}`;
};
console.log(`\n${url}  (✓ good · ~ needs improvement · ✗ poor)\n`);
console.table(
  rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? mark(k, v) : v])),
  ),
);
const median = (k, kind) => {
  const xs = rows
    .filter((r) => r.run.startsWith(kind))
    .map((r) => r[k])
    .sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
};
console.log(
  `median cold: board ${median('board', 'cold')} ms, images ${median('images', 'cold')} ms · warm: board ${median('board', 'warm')} ms`,
);
