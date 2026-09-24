// Light load test against a deployment (default: production). Usage: node tests/perf/load.mjs [base] [requests] [concurrency]
const BASE = process.argv[2] ?? 'https://annie3d.nndang2701.workers.dev';
const N = Number(process.argv[3] ?? 1000);
const C = Number(process.argv[4] ?? 50);
const targets = [
  ['app shell', '/'],
  ['fixture image', '/api/public/fixtures/v1/serum/photo_512.webp'],
  ['session check (guest)', '/api/me?optional=1'],
  ['health (DB round trip)', '/api/health'],
];
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))];
const results = {};
for (const [name, path] of targets) {
  const times = [];
  let errors = 0;
  let next = 0;
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: C }, async () => {
      while (next < N) {
        next++;
        const s = performance.now();
        try {
          const r = await fetch(BASE + path, { headers: { 'accept-encoding': 'br, gzip' } });
          await r.arrayBuffer();
          if (!r.ok) errors++;
        } catch {
          errors++;
        }
        times.push(performance.now() - s);
      }
    }),
  );
  const wall = (performance.now() - t0) / 1000;
  times.sort((a, b) => a - b);
  results[name] = {
    requests: N,
    concurrency: C,
    errors,
    rps: Math.round(N / wall),
    p50: Math.round(q(times, 0.5)),
    p95: Math.round(q(times, 0.95)),
    p99: Math.round(q(times, 0.99)),
  };
  console.log(name.padEnd(24), JSON.stringify(results[name]));
}
const fs = await import('node:fs');
fs.mkdirSync('perf-results', { recursive: true });
fs.writeFileSync(
  'perf-results/load-prod.json',
  JSON.stringify(
    {
      base: BASE,
      at: new Date().toISOString(),
      from: 'developer machine (Australia), one client process',
      results,
    },
    null,
    2,
  ),
);
