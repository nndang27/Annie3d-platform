import { expect, resetDemo, signIn, test } from './fixtures';

test('mobile: step/list workflow, studio stacked, no horizontal scroll', async ({ page }) => {
  await resetDemo(page);
  await signIn(page, 'u_mai');
  await expect(page.locator('.mobile-tabs')).toBeVisible();
  await page.getByTestId('project-card').first().locator('a').first().click();
  await page.getByRole('tab', { name: 'Workflow' }).click();
  // list view is the default on narrow screens
  await expect(page.getByTestId('workflow-list')).toBeVisible();
  await page.getByRole('tab', { name: 'Studio' }).click();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto('/');
  const ov2 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(ov2).toBeLessThanOrEqual(1);
});
