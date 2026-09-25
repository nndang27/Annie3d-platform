// Update planner: what does this build change for desktop users?
// Compares the freshly built web pack (apps/web/dist/client/desktop/manifest.json) with the one a
// site is serving now, and the desktop shell sources with the last shell release tag.
//   pnpm desktop:plan [origin]      (default: production)
// Prints: files to download, features changed (shared vs app-only), and whether a shell release
// (new app build) is needed. Deploying the website publishes the web pack automatically.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FEATURES, featureOf } from '../packages/contracts/src/features.ts';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const origin = process.argv[2] ?? 'https://annie3d.nndang2701.workers.dev';
const local = JSON.parse(
  JSON.parse(readFileSync('apps/web/dist/client/desktop/manifest.json', 'utf8')).manifest,
);
let live = null;
try {
  const r = await fetch(`${origin}/desktop/manifest.json`, { cache: 'no-store' });
  if (r.ok) live = JSON.parse((await r.json()).manifest);
} catch {}

const have = new Set(live?.files.map((f) => f.sha256) ?? []);
const changed = local.files.filter((f) => !have.has(f.sha256));
const kb = (n) => `${Math.round(n / 1024)} KB`;
const title = (id) => local.features[id]?.title ?? id;
const byFeature = new Map();
for (const f of changed) for (const id of f.features) byFeature.set(id, (byFeature.get(id) ?? 0) + f.size);

console.log(`\nWeb pack  ${live?.version ?? '(none published)'}  →  ${local.version}`);
if (!changed.length) console.log('  No web changes: desktop users get no web update.');
else {
  console.log(
    `  Download for desktop users: ${changed.length} files, ${kb(changed.reduce((a, f) => a + f.size, 0))}`,
  );
  for (const [id, bytes] of [...byFeature].sort((a, b) => b[1] - a[1])) {
    const surface = local.features[id]?.surface === 'desktop' ? 'app only' : 'website + app';
    console.log(`   - ${title(id)} (${surface}) ~${kb(bytes)}`);
  }
}

// Shell: any change under the shell's feature paths since the last `desktop-v*` tag.
let tag = '';
try {
  tag = execSync('git describe --tags --match "desktop-v*" --abbrev=0', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
} catch {}
const since = tag || execSync('git rev-list --max-parents=0 HEAD').toString().trim().split('\n')[0];
const shellFiles = execSync(`git diff --name-only ${since} -- apps/desktop`)
  .toString()
  .split('\n')
  .filter((f) => f && featureOf(f)?.layer === 'shell');
console.log(`\nShell (app build) since ${tag || 'the first commit'}:`);
if (!shellFiles.length) console.log('  No shell changes: no new app build needed.');
else {
  const ids = new Set(shellFiles.map((f) => featureOf(f).id));
  console.log(`  ${shellFiles.length} files changed → new app build needed (Restart to update):`);
  for (const id of ids) console.log(`   - ${FEATURES.find((f) => f.id === id)?.title ?? id}`);
}
console.log('');
