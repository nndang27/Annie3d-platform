// Runs database integration tests on a disposable Neon branch (neon-postgres-branches skill:
// "test migrations on a branch before applying them"). Creates branch → migrates → tests → deletes.
import { execFileSync, spawnSync } from 'node:child_process';

const name = `test-${Date.now()}`;
const neon = (...args) => execFileSync('neon', args, { encoding: 'utf8' }).trim();
const created = JSON.parse(neon('branches', 'create', '--name', name, '--parent', 'dev', '-o', 'json'));
const branchId = (created.branch ?? created).id;
let code = 1;
try {
  const url = neon('connection-string', branchId, '--database-name', 'neondb').split('\n').pop();
  const env = { ...process.env, MIGRATE_URL: url, DATABASE_TEST_URL: url };
  const mig = spawnSync('node', ['--experimental-strip-types', 'packages/db/src/scripts/migrate.ts'], { env, stdio: 'inherit' });
  if (mig.status !== 0) throw new Error('migration failed');
  code = spawnSync('npx', ['vitest', 'run', 'packages/db', ...process.argv.slice(2)], { env, stdio: 'inherit' }).status ?? 1;
} finally {
  neon('branches', 'delete', branchId);
  console.log(`deleted test branch ${name}`);
}
process.exit(code);
