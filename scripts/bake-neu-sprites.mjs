// Bakes the neumorphic (Soft UI) shadows once into PNG sprites for the board
// (apps/web/src/client/canvas/neu/). Board content is re-rastered at every zoom level, and a CSS
// box-shadow blur compiles a GPU pipeline for each blur size it reaches (measured: most of the cold
// zoom stalls; boardPaint.test.ts forbids it). A baked sprite drawn with border-image is an
// ordinary image draw at any zoom: the same soft light/dark pair, no blur work at run time.
//
// Each sprite holds only the shadow (the shape itself is transparent), so an element keeps its own
// background colour and radius. Scale 2 is enough: a shadow is a smooth gradient, and the sharp edge is the element's own.
// Shadows follow the Soft UI recipe (namethatui.com/styles/neumorphism): light from the top-left
// (white), dark toward the bottom-right (rgba(163,177,198)), on the base #e3e7ee.
// Usage: node scripts/bake-neu-sprites.mjs, then convert to lossless WebP (38 KB for all three):
//   python3 -c "from PIL import Image; import os
//   [Image.open(f'{n}.png').save(f'{n}.webp', lossless=True, method=6) or os.remove(f'{n}.png') for n in ('raised','circle','inset')]"
//   (run inside apps/web/src/client/canvas/neu)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = new URL('../apps/web/src/client/canvas/neu/', import.meta.url).pathname;
const K = 2;
const LIGHT = 'rgba(255,255,255,0.92)';
const DARK = 'rgba(163,177,198,0.68)';

/** Raised rounded rect: radius r, shadow offset o and blur b, margin m around the shape. */
const raised = { name: 'raised', r: 22, o: 9, b: 20, m: 40 };
/** Raised circle (ports, round buttons). */
const circle = { name: 'circle', r: 16, o: 4, b: 10, m: 20 };
/** Inset (pressed) rounded rect: shadows fall inside the shape. */
const inset = { name: 'inset', r: 16, o: 5, b: 10, m: 0 };

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(
  ({ K, LIGHT, DARK, raised, circle, inset }) => {
    const rr = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };
    const png = (c) => c.toDataURL('image/png');
    const result = {};
    // Raised: a rounded rect (or circle) with both shadows, then the shape itself cut out.
    for (const s of [raised, circle]) {
      const side = s.name === 'circle' ? 2 * (s.r + s.m) : 2 * (s.r + s.m) + 2;
      const c = Object.assign(document.createElement('canvas'), { width: side * K, height: side * K });
      const ctx = c.getContext('2d');
      ctx.scale(K, K);
      const size = side - 2 * s.m;
      for (const [color, dx] of [
        [LIGHT, -s.o],
        [DARK, s.o],
      ]) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = s.b * K; // shadowBlur is in device pixels
        ctx.shadowOffsetX = dx * K;
        ctx.shadowOffsetY = dx * K;
        ctx.fillStyle = '#e3e7ee';
        rr(ctx, s.m, s.m, size, size, s.name === 'circle' ? size / 2 : s.r);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'destination-out';
      rr(ctx, s.m, s.m, size, size, s.name === 'circle' ? size / 2 : s.r);
      ctx.fill();
      result[s.name] = { side, url: png(c) };
    }
    // Inset: inside a rounded rect, a frame around it casts both shadows inward.
    {
      const s = inset;
      const side = 2 * (s.r + 14) + 2;
      const c = Object.assign(document.createElement('canvas'), { width: side * K, height: side * K });
      const ctx = c.getContext('2d');
      ctx.scale(K, K);
      for (const [color, d] of [
        [DARK, s.o],
        [LIGHT, -s.o],
      ]) {
        ctx.save();
        rr(ctx, 0, 0, side, side, s.r);
        ctx.clip();
        ctx.shadowColor = color;
        ctx.shadowBlur = s.b * K;
        ctx.shadowOffsetX = d * K;
        ctx.shadowOffsetY = d * K;
        ctx.fillStyle = '#e3e7ee';
        ctx.beginPath();
        ctx.rect(-100, -100, side + 200, side + 200);
        ctx.roundRect(0, 0, side, side, s.r);
        ctx.fill('evenodd');
        ctx.restore();
      }
      result.inset = { side, url: png(c) };
    }
    return result;
  },
  { K, LIGHT, DARK, raised, circle, inset },
);
await browser.close();

mkdirSync(OUT, { recursive: true });
for (const [name, { side, url }] of Object.entries(out)) {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(`${OUT}${name}.png`, buf);
  console.log(`${name}.png: ${side}x${side} CSS px at ${K}x, ${Math.round(buf.length / 1024)} KB`);
}
console.log('slices (CSS px):', {
  raised: raised.r + raised.m,
  raisedOutset: raised.m,
  circleOutset: circle.m,
  inset: inset.r + 14,
});
