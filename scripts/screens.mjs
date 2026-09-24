// Captures the phase screenshots in docs/screens/ from a running build (BASE, default :4173).
// Usage: node scripts/screens.mjs p4
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const phase = process.argv[2] ?? 'p4';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const out = (name) => `docs/screens/${phase}-${name}.png`;
mkdirSync('docs/screens', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const settle = () => page.waitForTimeout(700);
await page.goto(BASE);
await page.waitForSelector('.node-preview img');
await settle();
await page.screenshot({ path: out('01-example-board') });

const zoomTo = async (clicks, label) => {
  for (let i = 0; i < clicks; i++) await page.getByRole('button', { name: label }).click();
  await settle();
};
await zoomTo(2, 'Zoom in');
await page.screenshot({ path: out('02-full-detail') });
await page.getByTestId('node-model3d').first().hover();
await page.waitForTimeout(1200);
await page.screenshot({ path: out('03-hover-turntable') });

await page.locator('.react-flow__pane').click({ position: { x: 900, y: 780 } });
await page.keyboard.press('Control+k');
await page.getByRole('searchbox', { name: 'Search nodes' }).fill('s');
await settle();
await page.screenshot({ path: out('04-palette') });
await page.keyboard.press('Escape');

const h = await page
  .locator('.react-flow__node')
  .filter({ has: page.getByTestId('node-model3d') })
  .first()
  .locator('.react-flow__handle.source')
  .boundingBox();
await page.mouse.move(h.x + 5, h.y + 5);
await page.mouse.down();
await page.mouse.move(h.x + 200, h.y + 380, { steps: 12 });
await page.mouse.up();
await settle();
await page.screenshot({ path: out('05-wire-drop-palette') });
await page.keyboard.press('Escape');

await page
  .getByTestId('node-stage')
  .first()
  .click({ button: 'right', position: { x: 60, y: 12 } });
await settle();
await page.screenshot({ path: out('06-context-menu') });
await page.keyboard.press('Escape');

await page.getByTestId('starters-button').click();
await settle();
await page.screenshot({ path: out('07-starters') });
await page.keyboard.press('Escape');

await page.getByTestId('run-node').first().click();
await settle();
await page.screenshot({ path: out('08-signin-on-run') });
await page.keyboard.press('Escape');

await zoomTo(7, 'Zoom out');
await page.screenshot({ path: out('09-compact-lod') });
await browser.close();
console.log('screens saved');
