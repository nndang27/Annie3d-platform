// Runs a command against the real stack: disposable Neon branch (from `dev`) → migrate →
// Worker + SPA via Vite dev on PORT → command → stop → delete branch.
// Usage: node scripts/test-stack.mjs <port> <command> [args...]
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const [port, cmd, ...args] = process.argv.slice(2);
if (!port || !cmd) throw new Error('usage: test-stack.mjs <port> <command> [args...]');
const neon = (...a) => execFileSync('neon', a, { encoding: 'utf8' }).trim();
const created = JSON.parse(
  neon('branches', 'create', '--name', `test-${port}-${Date.now()}`, '--parent', 'dev', '-o', 'json'),
);
const branchId = (created.branch ?? created).id;
let server;
let code = 1;
const base = `http://localhost:${port}`;
try {
  const url = neon('connection-string', branchId, '--database-name', 'neondb').split('\n').pop();
  const mig = spawnSync('node', ['--experimental-strip-types', 'packages/db/src/scripts/migrate.ts'], {
    env: { ...process.env, MIGRATE_URL: url },
    stdio: 'inherit',
  });
  if (mig.status) throw new Error('migrate failed');
  server = spawn('node', ['scripts/dev.mjs'], {
    env: { ...process.env, DEV_DATABASE_URL: url, PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    try {
      up = (await fetch(`${base}/api/health`)).ok;
    } catch {}
    if (!up) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) throw new Error(`server did not start:\n${log.slice(-2000)}`);
  // Async spawn: spawnSync would block this event loop, leave the server's stdout pipe undrained
  // (it can fill and stall the server) and capture no log at all.
  code = await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, API_BASE: base, E2E_BASE: base },
      stdio: 'inherit',
    });
    child.on('exit', (c) => resolve(c ?? 1));
  });
  if (code !== 0) {
    const lines = log.split('\n').filter((l) => !/ResizeObserver/.test(l));
    const tail = Number(process.env.STACK_LOG ?? 0);
    console.log((tail ? lines.slice(-tail) : lines.filter((l) => /error/i.test(l)).slice(-20)).join('\n'));
  }
} finally {
  server?.kill('SIGTERM');
  spawnSync('pkill', ['-f', `--port ${port}`]);
  neon('branches', 'delete', branchId);
  console.log(`deleted test branch ${branchId}`);
}
process.exit(code);
