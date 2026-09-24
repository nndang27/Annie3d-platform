// Canvas E2E (Playwright) on a disposable Neon branch (see scripts/test-stack.mjs).
import { spawnSync } from 'node:child_process';

const r = spawnSync(
  'node',
  ['scripts/test-stack.mjs', '5191', 'npx', 'playwright', 'test', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
