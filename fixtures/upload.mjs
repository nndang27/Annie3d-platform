// Uploads the fixture pack to the PUBLIC R2 bucket (remote) with correct content types.
// Usage: node upload.mjs [--dry-run]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BUCKET = 'annie3d-public';
const VERSION = 'v1';
const MIME = {
  png: 'image/png',
  webp: 'image/webp',
  glb: 'model/gltf-binary',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
};
const manifest = JSON.parse(readFileSync(new URL('./out/manifest.json', import.meta.url), 'utf8'));
const dry = process.argv.includes('--dry-run');
const webDir = new URL('../apps/web/', import.meta.url).pathname;
let n = 0;
for (const [product, p] of Object.entries(manifest.products)) {
  for (const name of Object.keys(p.files)) {
    const file = new URL(`./out/${product}/${name}`, import.meta.url).pathname;
    const key = `${BUCKET}/fixtures/${VERSION}/${product}/${name}`;
    const args = [
      'wrangler',
      'r2',
      'object',
      'put',
      key,
      '--file',
      file,
      '--content-type',
      MIME[name.split('.').pop()],
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--remote',
    ];
    if (dry) console.log(args.join(' '));
    else execFileSync('pnpm', ['exec', ...args], { cwd: webDir, stdio: ['ignore', 'ignore', 'inherit'] });
    n++;
  }
}
console.log(`${dry ? 'would upload' : 'uploaded'} ${n} files`);
