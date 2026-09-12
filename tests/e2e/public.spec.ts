import { expect, test } from './fixtures';

test.describe('public site', () => {
  test('homepage ships useful HTML, working links, no app code', async ({ page, errors }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('3D ads');
    // Hero poster is the LCP candidate: eager, sized, not lazy.
    const poster = page.locator('[data-demo-poster]');
    await expect(poster).toHaveAttribute('loading', 'eager');
    await expect(poster).toHaveAttribute('width');
    // No Three.js / React Flow / app chunks on the public page before intent.
    const scripts = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src));
    expect(scripts.some((s) => /viewer-3d|three|xyflow|\/app\//.test(s))).toBe(false);
    // Every internal link resolves.
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')).map(
        (a) => a.getAttribute('href')!,
      ),
    );
    const unique = [...new Set(hrefs.map((h) => h.split('#')[0]!.split('?')[0]!))];
    for (const h of unique) {
      const r = await page.request.get(h);
      expect(r.status(), `link ${h}`).toBeLessThan(400);
    }
    expect(errors).toEqual([]);
  });

  test('3D demo loads on intent and renders frames', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-demo-start').click();
    await expect(page.locator('[data-demo-canvas]')).toBeVisible();
    await page.waitForFunction(() => !!window.__homeViewer);
    const stats = await page.evaluate(() =>
      (window.__homeViewer as { getStats(): { framesRendered: number; fixtureId: string } }).getStats(),
    );
    expect(stats.framesRendered).toBeGreaterThan(0);
    expect(stats.fixtureId).toBe('headphones');
    await page.getByRole('button', { name: 'Change colour' }).click();
    await page.getByRole('button', { name: 'Reset view' }).click();
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    expect(loaded.some((s) => /viewer-3d/.test(s))).toBe(true);
  });

  test('templates gallery search/filter and detail deep link', async ({ page }) => {
    await page.goto('/templates');
    await page.getByTestId('template-search').fill('vertical');
    await expect(page.locator('[data-template]:visible')).toHaveCount(1);
    await expect(page.locator('[data-template]:visible')).toContainText('Social teaser');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('[data-template]:visible')).toHaveCount(8);
    await page.locator('#tpl-cat').selectOption('Comparison');
    await expect(page.locator('[data-template]:visible')).toHaveCount(1);
    await page.goto('/templates?q=headphones');
    await expect(page.locator('[data-template]:visible')).toHaveCount(1);
    const res = await page.goto('/templates/feature-callouts-headphones');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Feature callouts');
    const use = page.getByTestId('use-template');
    await expect(use).toHaveAttribute('href', /\/app\/signup\?template=feature-callouts-headphones/);
  });

  test('pricing interval toggle updates prices and plan links', async ({ page }) => {
    await page.goto('/pricing');
    const studioPrice = page.locator('[data-plan="studio"] [data-price-monthly]');
    await expect(studioPrice).toHaveText('$29');
    await page.getByRole('radio', { name: /Yearly/ }).click();
    await expect(studioPrice).toHaveText('$24.17');
    await expect(page.locator('[data-plan="studio"] [data-yearly-note]')).toBeVisible();
    await expect(page.getByTestId('choose-studio')).toHaveAttribute('href', /interval=yearly/);
    await expect(page).toHaveURL(/interval=yearly/);
    await page.keyboard.press('ArrowLeft');
    await expect(studioPrice).toHaveText('$29');
  });

  test('help articles, legal drafts and 404 status', async ({ page }) => {
    await page.goto('/help');
    await page.locator('a[href="/help/quickstart"]').first().click();
    await expect(page).toHaveURL(/\/help\/quickstart/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quickstart');
    await page.goto('/legal/privacy');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    const nf = await page.goto('/this-page-does-not-exist');
    expect(nf?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('does not exist');
    const api = await page.request.get('/api/anything');
    expect(api.status()).toBe(404);
    const asset = await page.request.get('/app/assets/missing-chunk.js');
    expect(asset.status()).toBe(404);
  });

  test('mobile menu opens by click and keyboard, closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).toBeHidden();
    await expect(toggle).toBeFocused();
  });
});
