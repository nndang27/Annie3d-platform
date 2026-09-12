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

test('public site: mobile menu covers the page and its CTA is legible', async ({ page }) => {
  await page.goto('/product');
  const hero = page.locator('main h1');
  await expect(hero).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();
  // The menu must be a full-height opaque sheet under the header, not a collapsed box.
  const box = await menu.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.height).toBeGreaterThan(vp.height * 0.6);
  expect(box!.y).toBeLessThan(80);
  // The hero heading is covered: the element at its centre belongs to the menu.
  const heroBox = await hero.boundingBox();
  const covered = await page.evaluate(
    ([x, y]) => !!document.elementFromPoint(x, y)?.closest('#mobile-menu'),
    [heroBox!.x + heroBox!.width / 2, heroBox!.y + heroBox!.height / 2],
  );
  expect(covered).toBe(true);
  const cta = page.getByTestId('mobile-menu-start');
  await expect(cta).toHaveText('Start a project');
  const color = await cta.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(255, 255, 255)');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});
