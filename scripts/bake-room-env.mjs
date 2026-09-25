// Bakes the RoomEnvironment PMREM (the image-based lighting of the 3D editor and simulator) once,
// with the project's own three.js in Chromium, into packages/viewer-3d/assets/room-env.bin, so the
// viewers load a texture instead of rendering and blurring the room on every open. That runtime
// bake compiled several GPU pipelines: ~350 ms frozen on a machine's first editor open, ~30 ms on
// every later open (docs/PERFORMANCE_STANDARDS.md).
//
// Format: "ENV1", width, height (uint32 LE), then gzip of RGB9E5 texels (WebGL2 RGB9_E5, what the
// GPU samples directly). Measured against the exact half-float PMREM on a gold ring with a
// diamond: mean difference 0.002 levels, max 2. Size 256 is kept: 128 visibly softened jewellery
// reflections (max 61 levels on the ring). Re-run after upgrading three.js.
// Usage: node scripts/bake-room-env.mjs
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const three = join(root, 'packages/viewer-3d/node_modules/three');
const dest = join(root, 'packages/viewer-3d/assets/room-env.bin');

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') {
    res.setHeader('content-type', 'text/html');
    return res.end(
      '<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>',
    );
  }
  const file = join(three, path.replace(/^\/three\//, ''));
  if (!path.startsWith('/three/') || !existsSync(file)) return res.writeHead(404).end();
  res.setHeader('content-type', extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/`);
const out = await page.evaluate(async () => {
  const T = await import('three');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const renderer = new T.WebGLRenderer();
  // The same call the viewers made at runtime.
  const rt = new T.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04);
  const { width: w, height: h } = rt;
  const half = new Uint16Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, half);
  // RGB9E5 (EXT_texture_shared_exponent): 9-bit mantissas sharing a 5-bit exponent.
  const MAX = (511 / 512) * 2 ** 16;
  const texels = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = [0, 1, 2].map((k) => Math.min(MAX, Math.max(0, T.DataUtils.fromHalfFloat(half[i * 4 + k]))));
    const m = Math.max(...c);
    if (m <= 0) continue;
    let e = Math.max(-16, Math.floor(Math.log2(m))) + 16;
    let den = 2 ** (e - 24);
    if (Math.floor(m / den + 0.5) === 512) {
      den *= 2;
      e += 1;
    }
    const [r, g, b] = c.map((v) => Math.floor(v / den + 0.5));
    texels[i] = ((e << 27) | (b << 18) | (g << 9) | r) >>> 0;
  }
  const bytes = new Uint8Array(texels.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { w, h, b64: btoa(s) };
});
await browser.close();
server.close();

const head = Buffer.alloc(12);
head.write('ENV1', 0, 'ascii');
head.writeUInt32LE(out.w, 4);
head.writeUInt32LE(out.h, 8);
const body = gzipSync(Buffer.from(out.b64, 'base64'), { level: 9 });
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, Buffer.concat([head, body]));
console.log(`wrote ${dest}: ${out.w}x${out.h} RGB9E5, ${Math.round((head.length + body.length) / 1024)} KB`);
