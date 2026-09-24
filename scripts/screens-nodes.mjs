// Screenshots of the node UI (ElevenLabs-style nodes, wires, clipboard) from a running app.
// Usage: BASE=http://localhost:5173 node scripts/screens-nodes.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const out = (name) => `docs/screens/p11-${name}.png`;
mkdirSync('docs/screens', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await ctx.newPage();
const settle = (ms = 700) => page.waitForTimeout(ms);
await page.goto(BASE);
await page.waitForSelector('.node-preview img');
await page.getByRole('button', { name: 'Close agent' }).click();
const pane = page.locator('.react-flow__pane');

// 100% around the first 3D model node.
await pane.click({ position: { x: 1300, y: 500 } });
await page.keyboard.press('Shift+0');
await settle();

await page.screenshot({ path: out('01-nodes-100') });

await page
  .locator('.react-flow__node')
  .filter({ has: page.getByTestId('node-stage') })
  .first()
  .locator('.node-head')
  .click();
await settle();
await page.screenshot({ path: out('02-selected-toolbar') });

// Hover a wire: the delete button appears at its midpoint.
await page.keyboard.press('Escape');
const mid = await page.evaluate(() => {
  const p = document.querySelectorAll('.react-flow__edge-path')[3];
  const m = p.getPointAtLength(p.getTotalLength() / 2);
  const q = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM());
  return { x: q.x, y: q.y };
});
await page.mouse.move(mid.x, mid.y);
await settle(400);
await page.screenshot({ path: out('03-wire-hover') });

// Double-click on empty canvas: a Text node ready to type.
await page.keyboard.press('Escape');
await pane.dblclick({ position: { x: 1150, y: 760 } });
await page.keyboard.type('Soft morning light, pastel podium');
await pane.click({ position: { x: 1380, y: 480 } });
await settle();
await page.screenshot({ path: out('04-dblclick-text') });

// Marquee-select a few nodes, copy, paste at the cursor.
await page.mouse.move(40, 120);
await page.mouse.down();
await page.mouse.move(1000, 700, { steps: 10 });
await page.mouse.up();
await settle(300);
await page.keyboard.press('ControlOrMeta+c');
await page.mouse.move(1000, 200);
await page.keyboard.press('ControlOrMeta+v');
await settle();
await page.screenshot({ path: out('05-copy-paste') });

// Paste an image copied from another app: a Photo node appears with it.
await page.keyboard.press('Escape');
const png = readFileSync('fixtures/out/headphones/photo_512.webp');
await page.mouse.move(300, 700);
await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], 'pasted.webp', { type: 'image/webp' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
}, png.toString('base64'));
await settle(1200);
await page.screenshot({ path: out('06-paste-image') });
await browser.close();
console.log('node screens saved');
