// Writes `dist/client/desktop/manifest.json` after `vite build`: every file the site serves,
// with its sha256, size and the features whose code it holds (from the chunk map written by the
// Vite plugin and packages/contracts/src/features.ts), signed with Ed25519.
// The desktop app downloads only files whose sha256 it does not have and verifies the signature
// with the public key built into the shell (apps/desktop/src/main/packKey.ts).
// Signing key: ANNIE3D_PACK_KEY (PKCS#8 PEM, base64) from the environment or .dev.vars; without it
// the manifest is unsigned and only a development shell (ANNIE3D_ALLOW_UNSIGNED=1) accepts it.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FEATURES, featureOf, VENDOR_FEATURE } from '../packages/contracts/src/features.ts';

process.chdir(new URL('..', import.meta.url).pathname);
const DIST = 'apps/web/dist/client';
const MIN_SHELL = '0.1.0';

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(DIST, p).replaceAll('\\', '/'));
  }
};
walk(DIST);

const chunkMapPath = join(DIST, 'desktop/chunks.json');
const chunks = existsSync(chunkMapPath) ? JSON.parse(readFileSync(chunkMapPath, 'utf8')) : {};
const skip = (f) => f.startsWith('desktop/') || f.startsWith('.vite/') || f.endsWith('.map');
const out = [];
for (const path of files.filter((f) => !skip(f)).sort()) {
  const buf = readFileSync(join(DIST, path));
  const features = new Set();
  for (const m of chunks[path] ?? []) {
    const f = featureOf(m);
    if (f) features.add(f.id);
  }
  // Static pages and public files without a module graph belong to the app core.
  if (!features.size) features.add('core');
  out.push({
    path,
    sha256: createHash('sha256').update(buf).digest('hex'),
    size: buf.length,
    features: [...features].sort(),
  });
}

let git = 'local';
try {
  git = (await import('node:child_process')).execSync('git rev-parse --short HEAD').toString().trim();
} catch {}
const builtAt = Date.now();
const d = new Date(builtAt);
const version = `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}-${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}+${git}`;
const manifest = {
  format: 'annie3d-webpack',
  version,
  builtAt,
  minShell: MIN_SHELL,
  features: Object.fromEntries(
    [...FEATURES, VENDOR_FEATURE].map((f) => [f.id, { title: f.title, surface: f.surface }]),
  ),
  files: out,
};
const text = JSON.stringify(manifest);

const devVars = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8') : '';
const keyB64 = process.env.ANNIE3D_PACK_KEY ?? devVars.match(/^ANNIE3D_PACK_KEY=(.+)$/m)?.[1];
let signature = null;
let keyId = null;
if (keyB64) {
  const key = createPrivateKey(Buffer.from(keyB64.trim(), 'base64').toString('utf8'));
  signature = sign(null, Buffer.from(text), key).toString('base64');
  keyId = process.env.ANNIE3D_PACK_KEY_ID ?? devVars.match(/^ANNIE3D_PACK_KEY_ID=(.+)$/m)?.[1] ?? 'k1';
}
writeFileSync(join(DIST, 'desktop/manifest.json'), JSON.stringify({ manifest: text, signature, keyId }));
const kb = Math.round(out.reduce((a, f) => a + f.size, 0) / 1024);
console.log(
  `desktop manifest ${version}: ${out.length} files, ${kb} KB, ${signature ? 'signed' : 'UNSIGNED'}`,
);
