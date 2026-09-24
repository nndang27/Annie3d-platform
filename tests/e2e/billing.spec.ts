import { expect, test } from '@playwright/test';
import { openCanvas, signUp } from './helpers';

test.describe('credits and billing (F11)', () => {
  test('buy a plan through checkout, come back with credits, see it in history, sign out', async ({
    page,
  }) => {
    await page.goto('/home');
    await signUp(page, 'Buyer');
    await openCanvas(page);
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    const boardUrl = page.url();
    await page.getByTestId('credits').click();
    const dialog = page.getByTestId('billing-dialog');
    await expect(page.getByTestId('billing-balance')).toContainText('60');
    await expect(dialog).toContainText('first run is free');
    await page.getByTestId('buy-creator').click();
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await expect(page.getByTestId('checkout-page')).toContainText('Creator plan');
    await page.getByTestId('checkout-pay').click();
    await expect(page.getByText('Payment complete · credits added')).toBeVisible({ timeout: 20_000 });
    expect(page.url()).toBe(boardUrl);
    await expect(page.getByTestId('credits')).toHaveText('360 cr');
    await page.getByTestId('credits').click();
    await expect(page.getByTestId('billing-history')).toContainText('Plan purchase');
    await expect(page.getByTestId('plan-creator')).toContainText('Add credits');
    await page.keyboard.press('Escape');
    await page.getByTestId('account').click();
    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in')).toBeVisible({ timeout: 20_000 });
  });
});
