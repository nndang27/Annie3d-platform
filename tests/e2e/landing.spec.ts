import { expect, test } from '@playwright/test';

/**
 * annie3d.app/ is the landing page and the canvas is at /app (routes/landing.ts). Needs the site
 * pages in apps/web/public (`pnpm build` or `node scripts/copy-site.mjs`).
 */
test.describe('landing page at the root', () => {
  test('"/" shows the landing page, in the visitor\'s language, and its button opens the canvas', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('hero-open-canvas')).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
    await page.getByTestId('hero-open-canvas').click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30_000 });
  });

  test('a language cookie picks that language at the root', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'annie3d_lang', value: 'vi', url: baseURL! }]);
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');
  });

  test('old addresses keep working: /home moves to "/", a root query opens the canvas', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/?lang=fr');
    await expect(page).toHaveURL(/\/app\?lang=fr$/);
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30_000 });
  });
});
