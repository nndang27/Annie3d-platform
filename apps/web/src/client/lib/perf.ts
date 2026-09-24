import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

/**
 * Performance meter: page-load vitals and per-feature timings, measured in the user's browser
 * (real-user monitoring). Shown in the Performance panel and sent to `/api/rum` when the page is
 * hidden. Budgets: docs/PERFORMANCE_STANDARDS.md (web.dev Core Web Vitals, RAIL, Nielsen limits).
 */
export type Rating = 'good' | 'needs-improvement' | 'poor';

export interface Budget {
  /** ≤ good is "good", > poor is "poor", between is "needs improvement". */
  good: number;
  poor: number;
  unit: 'ms' | '';
  label: string;
}

/** Page load (web.dev thresholds, 75th percentile) plus our own "board ready". */
export const PAGE_BUDGETS: Record<string, Budget> = {
  TTFB: { good: 800, poor: 1800, unit: 'ms', label: 'Server response (TTFB)' },
  FCP: { good: 1800, poor: 3000, unit: 'ms', label: 'First paint (FCP)' },
  LCP: { good: 2500, poor: 4000, unit: 'ms', label: 'Main content (LCP)' },
  CLS: { good: 0.1, poor: 0.25, unit: '', label: 'Layout shift (CLS)' },
  INP: { good: 200, poor: 500, unit: 'ms', label: 'Input response (INP)' },
  'board.ready': { good: 2500, poor: 4000, unit: 'ms', label: 'Board ready to use' },
};

/**
 * Feature budgets. Instant actions follow the 0.1 s limit (Nielsen) / 100 ms RAIL response;
 * opening a view follows the 1 s flow limit; server work gets the 10 s attention limit
 * unless it shows progress (runs and reels show progress and are budgeted by their engines).
 */
export const FEATURE_BUDGETS: Record<string, Budget> = {
  'board.load': { good: 1000, poor: 3000, unit: 'ms', label: 'Load board data' },
  'clipboard.paste': { good: 100, poor: 300, unit: 'ms', label: 'Paste / duplicate nodes' },
  'image.add': { good: 1000, poor: 3000, unit: 'ms', label: 'Paste or drop an image' },
  'upload.file': { good: 3000, poor: 10000, unit: 'ms', label: 'Upload a file' },
  'editor.open': { good: 1000, poor: 3000, unit: 'ms', label: 'Open 3D editor' },
  'simulator.open': { good: 1000, poor: 3000, unit: 'ms', label: 'Open simulator' },
  'run.start': { good: 1000, poor: 3000, unit: 'ms', label: 'Start a run (until first event)' },
  'run.total': { good: 60000, poor: 180000, unit: 'ms', label: 'Run to finish' },
  'agent.first': { good: 1000, poor: 3000, unit: 'ms', label: 'Agent first words' },
  'agent.reply': { good: 5000, poor: 15000, unit: 'ms', label: 'Agent full reply' },
  'export.bundle': { good: 3000, poor: 10000, unit: 'ms', label: 'Export files' },
  'undo.apply': { good: 50, poor: 100, unit: 'ms', label: 'Undo / redo' },
  'file.export': { good: 3000, poor: 10000, unit: 'ms', label: 'Download .annie3d' },
  'file.import': { good: 3000, poor: 10000, unit: 'ms', label: 'Open .annie3d' },
  api: { good: 300, poor: 1000, unit: 'ms', label: 'API call' },
};

export function rate(b: Budget | undefined, v: number): Rating {
  if (!b) return 'good';
  return v <= b.good ? 'good' : v > b.poor ? 'poor' : 'needs-improvement';
}

export interface Sample {
  name: string;
  ms: number;
  at: number;
  detail?: string;
}

const vitals = new Map<string, number>();
const samples: Sample[] = [];
const listeners = new Set<() => void>();
const pending = new Map<string, number>();
let version = 0;
const notify = () => {
  version++;
  for (const l of listeners) l();
};

export function subscribePerf(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const perfVersion = () => version;
export const getVitals = () => vitals;
export const getSamples = () => samples;

export function record(name: string, ms: number, detail?: string) {
  samples.push({ name, ms: Math.round(ms), at: Date.now(), detail });
  if (samples.length > 300) samples.splice(0, samples.length - 300);
  notify();
}

/** Starts a timing that ends somewhere else (e.g. click → editor loaded). */
export function perfStart(name: string) {
  pending.set(name, performance.now());
}
export function perfEnd(name: string, detail?: string) {
  const t = pending.get(name);
  if (t === undefined) return;
  pending.delete(name);
  record(name, performance.now() - t, detail);
}
/** Times a function (sync or async). */
export function timed<T>(name: string, fn: () => T): T {
  const t = performance.now();
  const out = fn();
  if (out instanceof Promise) return out.finally(() => record(name, performance.now() - t)) as T;
  record(name, performance.now() - t);
  return out;
}

/** p50 / p95 over the recorded samples of one name. */
export function stats(name: string) {
  const xs = samples
    .filter((s) => s.name === name)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  if (!xs.length) return null;
  const q = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
  return {
    count: xs.length,
    last: samples.filter((s) => s.name === name).at(-1)!.ms,
    p50: q(0.5),
    p95: q(0.95),
  };
}

let started = false;
/** Page vitals (web-vitals library) and the RUM beacon. Call once at start-up. */
export function initPerf() {
  if (started) return;
  started = true;
  const put = ({ name, value }: { name: string; value: number }) => {
    vitals.set(name, name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value));
    notify();
  };
  onTTFB(put);
  onFCP(put);
  onLCP(put);
  onCLS(put, { reportAllChanges: true });
  onINP(put, { reportAllChanges: true });
  let sent = 0;
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    const fresh = samples.slice(sent);
    sent = samples.length;
    const body = JSON.stringify({
      path: location.pathname,
      vitals: Object.fromEntries(vitals),
      samples: fresh.slice(-100).map(({ name, ms }) => ({ name, ms })),
      connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        ?.effectiveType,
    });
    try {
      navigator.sendBeacon('/api/rum', new Blob([body], { type: 'application/json' }));
    } catch {
      /* best effort */
    }
  });
}

/** Called once the first board is on screen with its previews. */
export function markBoardReady() {
  if (vitals.has('board.ready')) return;
  vitals.set('board.ready', Math.round(performance.now()));
  notify();
}

/** Resources of this page load: count, transfer size and the slowest ones. */
export function resourceSummary() {
  const rs = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const kb = Math.round(rs.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024);
  const slow = [...rs]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 6)
    .map((r) => ({
      name: r.name.replace(location.origin, ''),
      ms: Math.round(r.duration),
      server: Math.round(r.serverTiming?.find((t) => t.name === 'app')?.duration ?? 0),
    }));
  return { count: rs.length, kb, slow };
}
