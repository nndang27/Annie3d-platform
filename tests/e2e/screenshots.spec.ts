import { mkdirSync } from 'node:fs';
import { expect, resetDemo, setScenario, signIn, test } from './fixtures';

const DIR = 'test-results/screenshots';
const WIDTHS = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1280, 800],
  ['wide', 1440, 900],
] as const;

test('screenshots across widths and states', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(DIR, { recursive: true });
  await resetDemo(page);
  for (const [name, w, h] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.screenshot({ path: `${DIR}/home-${name}.png`, fullPage: name !== 'mobile' });
    await page.goto('/pricing');
    await page.screenshot({ path: `${DIR}/pricing-${name}.png`, fullPage: true });
    await page.goto('/templates');
    await page.screenshot({ path: `${DIR}/templates-${name}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'u_mai');
  await page.screenshot({ path: `${DIR}/dashboard-populated.png` });
  await page.getByTestId('project-card').first().locator('a').first().click();
  await page.getByRole('tab', { name: 'Workflow' }).click();
  await expect(page.getByTestId('workflow-canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/workflow-canvas.png` });
  await page.getByTestId('run-workflow').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/workflow-running.png` });
  await page.getByRole('tab', { name: 'Studio' }).click();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/studio.png` });
  await page.getByRole('tab', { name: 'Outputs' }).click();
  await page.screenshot({ path: `${DIR}/outputs.png` });
  await page.goto('/app/settings/billing');
  await expect(page.getByTestId('subscription-card')).toBeVisible();
  await page.screenshot({ path: `${DIR}/billing.png` });
  await page.goto('/app/billing/checkout?plan=team&interval=monthly');
  await expect(page.getByTestId('checkout')).toContainText('checkout chk_');
  await page.screenshot({ path: `${DIR}/checkout.png` });
  // failure and offline states
  await setScenario(page, 'offline');
  await page.goto('/app');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/offline.png` });
  await setScenario(page, 'normal');
  // empty state: new account
  await page.goto('/app/signin');
  await page.goto('/app/signup');
  await page.getByLabel('Your name').fill('Empty State');
  await page.getByLabel('Email').fill('empty@example.demo');
  await page.getByLabel('Workspace name').fill('Empty Co');
  await page.getByRole('button', { name: 'Create demo account' }).click();
  await expect(page.getByText('No projects yet')).toBeVisible();
  await page.screenshot({ path: `${DIR}/dashboard-empty.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.getByText('No projects yet')).toBeVisible();
  await page.screenshot({ path: `${DIR}/dashboard-mobile.png` });
});
