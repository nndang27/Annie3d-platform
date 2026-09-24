// API integration tests against the real stack: disposable Neon branch + Worker (Vite dev) +
// real R2 (dev/ prefix). Branch → migrate → start server → vitest → stop → delete branch.
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const PORT = '5190';
const neon = (...a) => execFileSync('neon', a, { encoding: 'utf8' }).trim();
const created = JSON.parse(
  neon('branches', 'create', '--name', `api-${Date.now()}`, '--parent', 'dev', '-o', 'json'),
);
const branchId = (created.branch ?? created).id;
let server;
let code = 1;
try {
  const url = neon('connection-string', branchId, '--database-name', 'neondb').split('\n').pop();
  if (
    spawnSync('node', ['--experimental-strip-types', 'packages/db/src/scripts/migrate.ts'], {
      env: { ...process.env, MIGRATE_URL: url },
      stdio: 'inherit',
    }).status
  )
    throw new Error('migrate failed');
  server = spawn('node', ['scripts/dev.mjs'], {
    env: { ...process.env, DEV_DATABASE_URL: url, PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  code =
    spawnSync('npx', ['vitest', 'run', '-c', 'vitest.api.config.ts', ...process.argv.slice(2)], {
      env: { ...process.env, API_BASE: `http://localhost:${PORT}` },
      stdio: 'inherit',
    }).status ?? 1;
  if (code !== 0)
    console.log(
      log
        .split('\n')
        .filter((l) => /error/i.test(l))
        .slice(-20)
        .join('\n'),
    );
} finally {
  server?.kill('SIGTERM');
  spawnSync('pkill', ['-f', `--port ${PORT}`]);
  neon('branches', 'delete', branchId);
  console.log('deleted API test branch');
}
process.exit(code);
