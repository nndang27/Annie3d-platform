// Renders fixture and template posters with the real viewer in headless Chromium, then writes
// WebP (and the hero as WebP+AVIF) into apps/web/public/fixtures/posters and apps/marketing/src/assets/posters.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(join(root, 'apps/marketing/package.json'));
const sharp = require('sharp');
const outDir = join(root, 'perf-results/poster-app');
await build({
  root: join(root, 'scripts/poster-app'),
  base: './',
  logLevel: 'error',
  resolve: {
    alias: {
      '@annie3d/viewer-3d': join(root, 'packages/viewer-3d/src/index.ts'),
      '@annie3d/contracts': join(root, 'packages/contracts/src/index.ts'),
    },
  },
  build: { outDir, emptyOutDir: true },
});

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = join(outDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!existsSync(p)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4199, r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
await page.goto('http://localhost:4199/');
await page.waitForFunction(() => window.posterReady);

const webDir = join(root, 'apps/web/public/fixtures/posters');
const siteDir = join(root, 'apps/marketing/src/assets/posters');
mkdirSync(webDir, { recursive: true });
mkdirSync(siteDir, { recursive: true });

const jobs = await page.evaluate(() => window.posterJobs());
const manifest = {};
for (const job of jobs) {
  const dataUrl = await page.evaluate(
    ([i, w, h]) => window.renderPoster(i, w, h),
    [job.input, job.width, job.height],
  );
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  if (job.key.startsWith('fixture:')) {
    const id = job.key.slice('fixture:'.length);
    const webp = await sharp(png).resize(640, 480).webp({ quality: 82 }).toBuffer();
    writeFileSync(join(webDir, `${id}.webp`), webp);
    manifest[job.key] = webp.length;
  } else if (job.key.startsWith('template:')) {
    const slug = job.key.slice('template:'.length);
    const webp = await sharp(png).resize(960, 720).webp({ quality: 80 }).toBuffer();
    writeFileSync(join(siteDir, `${slug}.webp`), webp);
    manifest[job.key] = webp.length;
  } else if (job.key === 'hero') {
    const webp = await sharp(png).resize(1400, 1050).webp({ quality: 80 }).toBuffer();
    writeFileSync(join(siteDir, 'hero.webp'), webp);
    writeFileSync(join(siteDir, 'hero.png'), png);
    manifest[job.key] = webp.length;
  }
}
writeFileSync(
  join(root, 'fixtures/poster-manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), bytes: manifest }, null, 2),
);
console.log(manifest);
await browser.close();
server.close();
