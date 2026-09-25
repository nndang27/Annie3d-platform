// Moves client source maps out of the deployed assets (best-practices: no public source maps).
// They stay in dist/sourcemaps for symbolicating error reports.

import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../apps/web/dist/client/assets/', import.meta.url));
const to = fileURLToPath(new URL('../apps/web/dist/sourcemaps/', import.meta.url));
mkdirSync(to, { recursive: true });
let n = 0;
for (const f of readdirSync(from)) {
  if (!f.endsWith('.map')) continue;
  renameSync(`${from}${f}`, `${to}${f}`);
  n++;
}
console.log(`moved ${n} source maps out of dist/client`);
