// Renders the app icons from the website logo (apps/web/public/favicon.svg), so both stay one mark.
// macOS: 824 px tile inside a 1024 canvas (Apple's icon grid); Windows/Linux: full-bleed tile.
// Usage: node apps/desktop/build/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const here = new URL('.', import.meta.url);
const svg = readFileSync(new URL('../../web/public/favicon.svg', here), 'utf8');
const inner = svg
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>.*?<\/title>/, '');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const [file, size] of [
  ['icon.png', 824],
  ['icon-square.png', 1024],
]) {
  const pad = (1024 - size) / 2;
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(${pad} ${pad}) scale(${size / 32})">${inner}</g></svg></body></html>`,
  );
  await page.screenshot({ path: new URL(file, here).pathname, omitBackground: true });
  console.log(`wrote ${file}`);
}
await browser.close();
