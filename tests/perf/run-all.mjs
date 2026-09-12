import { spawnSync } from 'node:child_process';

for (const s of ['public-vitals.mjs', 'editor.mjs']) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync('node', [`tests/perf/${s}`], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
