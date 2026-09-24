import { expect, type Page, test } from '@playwright/test';
import { firstNode, openCanvas, signUp } from './helpers';

async function signedIn(page: Page) {
  await page.goto('/home');
  await signUp(page, 'Mai Tran');
  await openCanvas(page);
  await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
}

test.describe('export and share', () => {
  test('export a model for Google Swirl and download the zip', async ({ page }) => {
    await signedIn(page);
    const model = await firstNode(page, 'model3d');
    await page
      .locator(`.react-flow__node[data-id="${model}"]`)
      .click({ button: 'right', position: { x: 60, y: 12 } });
    await page.getByTestId('ctx-export').click();
    const dialog = page.getByTestId('export-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Google Swirl').click();
    await page.getByTestId('export-run').click();
    const report = page.getByTestId('export-report');
    await expect(report).toHaveAttribute('data-passed', 'true');
    await expect(report.locator('li')).toHaveCount(5);
    const zip = page.getByTestId('download-zip');
    await expect(zip).toHaveAttribute('href', /download=.+-google_swirl\.zip/);
    const res = await page.request.get((await zip.getAttribute('href')) as string);
    expect(res.headers()['content-disposition']).toContain('attachment');
  });

  test('the Export node shows its bundle and checks on the canvas', async ({ page }) => {
    await signedIn(page);
    await expect(page.getByTestId('export-summary').first()).toContainText('checks passed');
  });

  test('share link opens a public page with the ad and images; turning it off hides it', async ({
    page,
    browser,
  }) => {
    await signedIn(page);
    await page.getByTestId('share').click();
    const url = page.getByTestId('share-url');
    await expect(url).toHaveValue(/\/s\/[A-Za-z0-9_-]{22}$/);
    const link = await url.inputValue();
    // A different browser context = not signed in.
    const guest = await browser.newContext();
    const p2 = await guest.newPage();
    await p2.goto(link);
    await expect(p2.getByTestId('share-video')).toBeVisible();
    await expect(p2.getByTestId('share-images').locator('img').first()).toBeVisible();
    await expect(p2.locator('meta[property="og:image"]')).toHaveAttribute('content', /^http/);
    await expect(p2.getByTestId('share-cta')).toHaveAttribute('href', '/');
    await page.getByTestId('share-revoke').click();
    await expect(page.getByText('Link turned off')).toBeVisible();
    expect((await p2.request.get(link)).status()).toBe(404);
    await guest.close();
  });
});
