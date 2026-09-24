// Captures signed-in screenshots (runs, editor, share, billing) on a live stack.
// Usage: node scripts/test-stack.mjs 5191 node scripts/screens-signed-in.mjs p5
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const phase = process.argv[2] ?? 'p5';
const BASE = process.env.E2E_BASE ?? 'http://localhost:5191';
const out = (n) => `docs/screens/${phase}-${n}.png`;
mkdirSync('docs/screens', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/home`);
await page.evaluate(() => localStorage.setItem('annie3d.simSpeed', '0.3'));
await page.request.post(`${BASE}/api/auth/sign-up/email`, {
  headers: { origin: BASE },
  data: { email: `shots-${Date.now()}@example.com`, password: 'correct-horse-battery', name: 'Mai Tran' },
});
await page.goto(`${BASE}/`);
await page.waitForSelector('.node-preview img', { timeout: 60_000 });
const zoomIn = async (n) => {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(600);
};
await page.waitForTimeout(800); // the first line is framed on first open
await zoomIn(1);
await page.screenshot({ path: out('01-signed-in-example') });

if (phase === 'p5') {
  const stage = page.getByTestId('node-stage').first();
  await stage.getByTestId('prompt').click();
  await page.getByTestId('prompt-editor').fill('Warmer light, marble podium');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out('02-stale-after-edit') });
  await page.getByTestId('run-all').click();
  await page.getByTestId('run-total').waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('03-run-cost-dialog') });
  await page.getByTestId('run-confirm').click();
  await page.locator('.stage-label').first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out('04-run-progress') });
  await page.getByText(/Run finished/).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out('05-run-finished') });
  const model = page.getByTestId('node-model3d').first();
  await model.getByTestId('prompt').click();
  await page.getByTestId('prompt-editor').fill('bottle #fail');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(1200);
  await model.getByTestId('run-node').click();
  await page.getByTestId('run-confirm').click();
  await page.getByTestId('node-error').first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out('06-gate-failed') });
}
if (phase === 'p6') {
  const model = page.getByTestId('node-model3d').first();
  await model.hover();
  await model.getByTestId('open-3d').click();
  await page.getByTestId('editor').waitFor();
  await page.waitForFunction(() => !document.querySelector('.editor-loading-inline'), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out('02-editor-open') });
  await page.getByTestId('tool-lasso').click();
  const b = await page.getByTestId('editor-canvas').boundingBox();
  const pts = [
    [0.42, 0.12],
    [0.58, 0.12],
    [0.58, 0.36],
    [0.42, 0.36],
    [0.42, 0.12],
  ];
  await page.mouse.move(b.x + b.width * pts[0][0], b.y + b.height * pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1))
    await page.mouse.move(b.x + b.width * x, b.y + b.height * y, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId('edit-instruction').fill('Make the cap matte gold');
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('03-region-selected') });
  await page.getByTestId('edit-apply').click();
  await page.getByTestId('version-2').waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => !document.querySelector('.editor-loading-inline'), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out('04-edited-v2') });
  await page.getByTestId('compare').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out('05-compare-v2-v1') });
}
if (phase === 'p7') {
  const model = page.getByTestId('node-model3d').first();
  await model.click({ button: 'right', position: { x: 60, y: 12 } });
  await page.getByTestId('ctx-export').click();
  await page.getByTestId('export-dialog').getByText('Google Swirl').click();
  await page.getByTestId('export-run').click();
  await page.getByTestId('export-report').waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('02-export-report') });
  await page.keyboard.press('Escape');
  await page.getByTestId('share').click();
  await page.waitForFunction(() =>
    /\/s\//.test(document.querySelector('[data-testid=share-url]')?.value ?? ''),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('03-share-dialog') });
  const link = await page.getByTestId('share-url').inputValue();
  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await guest.goto(link);
  await guest.waitForTimeout(1500);
  await guest.screenshot({ path: out('04-public-share-page') });
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.waitForTimeout(500);
  await guest.screenshot({ path: out('05-public-share-mobile') });
}
if (phase === 'p8') {
  await page.getByTestId('credits').click();
  await page.getByTestId('plan-creator').waitFor();
  await page.getByTestId('billing-history').locator('li').first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('02-billing') });
  await page.getByTestId('buy-creator').click();
  await page.getByTestId('checkout-page').waitFor();
  await page.screenshot({ path: out('03-checkout') });
  await page.getByTestId('checkout-pay').click();
  await page.getByText('Payment complete').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out('04-back-with-credits') });
  await page.getByTestId('account').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('05-account-menu') });
}
if (phase === 'p9') {
  const say = async (text) => {
    await page.getByTestId('agent-input').fill(text);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('[data-testid=agent-dock]')?.getAttribute('data-busy') === 'false',
      null,
      { timeout: 30_000 },
    );
  };
  await say('make the stage darker');
  await page.getByTestId('node-stage').first().locator('.node-head').click();
  await say('use the velvet look, warmer, and run it');
  await page
    .locator('.stage-label')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: out('02-agent-edit-and-run') });
  await page.getByText(/Run finished/).waitFor({ timeout: 90_000 });
  await page.getByTestId('make-reel').click();
  await page.getByTestId('reel-record').click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: out('03-reel-recording') });
  await page.getByTestId('reel-video').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out('04-reel-ready') });
}
await browser.close();
console.log('screens saved');
