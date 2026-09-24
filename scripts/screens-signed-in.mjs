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
await page.evaluate(() => localStorage.setItem('annie3d.simSpeed', '0.6'));
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
await browser.close();
console.log('screens saved');
