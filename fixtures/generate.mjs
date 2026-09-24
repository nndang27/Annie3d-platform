// Generates the simulator fixture pack: real images, GLBs, MP4s and audio rendered with the
// app's own viewer (fixtures/gen) in headless Chromium, encoded with ffmpeg.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

export const PRODUCTS = [
  {
    id: 'serum',
    fixture: 'serum-bottle',
    color: '#e7a9bb',
    finish: 'gloss',
    vertical: 'beauty',
    look: { background: 'brand', brand: '#f2b8c6', light: 'studio-soft' },
    anim: 'orbit-sweep',
    headline: 'Meet the new formula',
    cta: 'Shop now',
    music: [261.63, 329.63, 392.0],
  },
  {
    id: 'headphones',
    fixture: 'headphones',
    color: '#2b2f36',
    finish: 'satin',
    vertical: 'electronics',
    look: { background: 'charcoal', brand: '#363a42', light: 'dramatic' },
    anim: 'dolly-in',
    headline: 'Engineered to the last screw',
    cta: 'Pre-order',
    music: [220.0, 277.18, 329.63],
  },
  {
    id: 'ring',
    fixture: 'ring',
    color: '#d4af37',
    finish: 'gloss',
    vertical: 'jewelry',
    look: { background: 'brand', brand: '#b9b1a4', light: 'dramatic' },
    anim: 'dolly-in',
    headline: 'Made to be noticed',
    cta: 'Discover',
    music: [293.66, 369.99, 440.0],
  },
];
const STUDIO = { background: 'studio-white', brand: '#ffffff', light: 'daylight' };
const FPS = 24;
const OUT = new URL('./out/', import.meta.url).pathname;
// `node generate.mjs [product] [--stills]`: --stills re-renders images only (no video/audio).
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const stillsOnly = process.argv.includes('--stills');
const PACKSHOTS = [
  // Distinct cameras, not Y rotations: the procedural products are rotationally symmetric,
  // so 0/90/180 degree turns rendered identical frames (manifest hashes, 2026-09-24).
  ['front', 'front', 0],
  ['top', 'top', 0],
  ['detail', 'detail', 0],
  ['three_quarter', 'three-quarter', 35],
];

const server = await createServer({
  root: new URL('./gen', import.meta.url).pathname,
  logLevel: 'error',
  server: { port: 5199, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
await page.goto('http://localhost:5199/');
await page.waitForFunction(() => window.genReady === true, null, { timeout: 60000 });

const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const manifest = {};

for (const p of PRODUCTS.filter((x) => !only || x.id === only)) {
  const dir = `${OUT}${p.id}`;
  if (!stillsOnly) rmSync(dir, { recursive: true, force: true });
  mkdirSync(`${dir}/frames`, { recursive: true });
  console.time(p.id);
  await page.evaluate(([f, c, fin]) => window.gen.init(f, c, fin), [p.fixture, p.color, p.finish]);
  // Inputs and 3D model
  // The 'customer photo' uses a different turn than the packshots so the two are not identical.
  save(
    `${dir}/photo.png`,
    await page.evaluate(([l]) => window.gen.still(l, 'three-quarter', -20, 1024, 1024), [STUDIO]),
  );
  const glb = await page.evaluate(() => window.gen.glb());
  writeFileSync(`${dir}/model.glb`, Buffer.from(glb.base64, 'base64'));
  // Packshots (four standard angles)
  for (const [name, cam, rot] of PACKSHOTS)
    save(
      `${dir}/packshot_${name}.png`,
      await page.evaluate(([l, c, r]) => window.gen.still(l, c, r, 1024, 1024), [STUDIO, cam, rot]),
    );
  save(
    `${dir}/stage.png`,
    await page.evaluate(([l]) => window.gen.still(l, 'three-quarter', 0, 1024, 1024), [p.look]),
  );
  if (!stillsOnly) {
    // Turntable clip (model node hover preview), 6 s square
    for (let i = 0; i < 6 * FPS; i++)
      save(
        `${dir}/frames/t_${String(i).padStart(4, '0')}.jpg`,
        await page.evaluate(([l, t]) => window.gen.frame(l, 'turntable', 6, t, 512, 512), [STUDIO, i / FPS]),
      );
    ff(
      '-framerate',
      String(FPS),
      '-i',
      `${dir}/frames/t_%04d.jpg`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '24',
      '-movflags',
      '+faststart',
      `${dir}/turntable.mp4`,
    );
    // Music bed: three-note pad with fade in/out
    const [a, b, c] = p.music;
    ff(
      '-f',
      'lavfi',
      '-i',
      `aevalsrc=0.18*sin(2*PI*${a}*t)+0.14*sin(2*PI*${b}*t)+0.12*sin(2*PI*${c}*t)+0.05*sin(2*PI*${a / 2}*t)*sin(2*PI*0.5*t):s=44100:d=10`,
      '-af',
      'afade=t=in:d=1,afade=t=out:st=8.5:d=1.5',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      `${dir}/music.m4a`,
    );
    // Ad video 9:16, 10 s, headline + end card, music muxed
    for (let i = 0; i < 10 * FPS; i++)
      save(
        `${dir}/frames/a_${String(i).padStart(4, '0')}.jpg`,
        await page.evaluate(
          ([l, an, t, ad]) => window.gen.frame(l, an, 10, t, 540, 960, ad),
          [p.look, p.anim, i / FPS, { headline: p.headline, cta: p.cta }],
        ),
      );
    ff(
      '-framerate',
      String(FPS),
      '-i',
      `${dir}/frames/a_%04d.jpg`,
      '-i',
      `${dir}/music.m4a`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '23',
      '-c:a',
      'copy',
      '-shortest',
      '-movflags',
      '+faststart',
      `${dir}/ad_9x16.mp4`,
    );
  }
  // Web variants: posters and thumbnails
  const toWebp = async (srcFile, dst, w) => {
    const src = `data:image/${srcFile.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${readFileSync(srcFile).toString('base64')}`;
    save(`${dir}/${dst}`, await page.evaluate(([d, width]) => window.gen.webp(d, width), [src, w]));
  };
  for (const [src, dst, w] of [
    ['photo.png', 'photo_thumb_256.webp', 256],
    ['packshot_three_quarter.png', 'model_poster_1024.webp', 1024],
    ['packshot_three_quarter.png', 'model_thumb_256.webp', 256],
    ['stage.png', 'stage_poster_1024.webp', 1024],
    ['stage.png', 'stage_thumb_256.webp', 256],
    ...PACKSHOTS.flatMap(([n]) => [
      [`packshot_${n}.png`, `packshot_${n}_thumb_256.webp`, 256],
      [`packshot_${n}.png`, `packshot_${n}_512.webp`, 512],
    ]),
    ['photo.png', 'photo_512.webp', 512],
  ])
    await toWebp(`${dir}/${src}`, dst, w);
  if (!stillsOnly)
    await toWebp(`${dir}/frames/a_${String(10 * FPS - 6).padStart(4, '0')}.jpg`, 'ad_poster_540.webp', 540);
  rmSync(`${dir}/frames`, { recursive: true, force: true });
  const files = {};
  for (const f of [
    'photo.png',
    'photo_thumb_256.webp',
    'model.glb',
    'model_poster_1024.webp',
    'model_thumb_256.webp',
    ...PACKSHOTS.flatMap(([n]) => [
      `packshot_${n}.png`,
      `packshot_${n}_thumb_256.webp`,
      `packshot_${n}_512.webp`,
    ]),
    'photo_512.webp',
    'stage.png',
    'stage_poster_1024.webp',
    'stage_thumb_256.webp',
    'turntable.mp4',
    'music.m4a',
    'ad_9x16.mp4',
    'ad_poster_540.webp',
  ]) {
    const buf = readFileSync(`${dir}/${f}`);
    files[f] = {
      bytes: statSync(`${dir}/${f}`).size,
      sha256: createHash('sha256').update(buf).digest('hex'),
    };
  }
  manifest[p.id] = {
    vertical: p.vertical,
    fixture: p.fixture,
    triangles: glb.triangles,
    headline: p.headline,
    files,
  };
  console.timeEnd(p.id);
}
await browser.close();
await server.close();
const path = `${OUT}manifest.json`;
let prev = {};
try {
  prev = JSON.parse(readFileSync(path, 'utf8'));
} catch {}
writeFileSync(
  path,
  JSON.stringify(
    { version: 1, generatedAt: new Date().toISOString(), products: { ...prev.products, ...manifest } },
    null,
    2,
  ),
);
console.log('manifest written');
