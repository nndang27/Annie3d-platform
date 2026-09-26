import { expect, test } from '@playwright/test';
import { firstNode, openCanvas } from './helpers';

test.describe('F13 simulation', () => {
  test('opens the simulator, switches places, and a phone remote steers it two-way', async ({
    page,
    browser,
  }) => {
    const errors = await openCanvas(page);
    const sim = await firstNode(page, 'simulation');
    const node = page.locator(`.react-flow__node[data-id="${sim}"]`);
    await expect(node.getByTestId('sim-thumb')).toBeVisible();
    await node.getByTestId('open-sim').click();
    const overlay = page.getByTestId('simulator');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByTestId('sim-canvas')).toBeVisible();
    for (const env of ['shop', 'sticker', 'showroom', 'tiktok'] as const) {
      await overlay.getByTestId(`sim-env-${env}`).click();
      await expect(overlay.getByTestId(`sim-env-${env}`)).toHaveAttribute('aria-pressed', 'true');
      await expect(overlay.getByTestId('sim-canvas')).toBeVisible();
    }
    // The choice is saved on the node.
    await expect
      .poll(() =>
        page.evaluate(
          (id) => (window as any).__annie3d.useBoard.getState().graph.nodes.get(id).settings.environment,
          sim,
        ),
      )
      .toBe('tiktok');

    await overlay.getByTestId('sim-env-showroom').click();
    const url = await overlay.getByTestId('sim-controller-link').getAttribute('href');
    const phone = await (
      await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    ).newPage();
    await phone.goto(url!);
    await expect(phone.getByText('Connected')).toBeVisible({ timeout: 15_000 });
    await expect(overlay.getByTestId('sim-remote')).toContainText('1 phone connected');
    // Phone → screen: pick a place; screen → phone: the new place is shown as selected.
    await phone.getByRole('button', { name: 'Shop page' }).click();
    await expect(overlay.getByTestId('sim-env-shop')).toHaveAttribute('aria-pressed', 'true');
    await expect(phone.getByRole('button', { name: 'Shop page' })).toHaveAttribute('aria-pressed', 'true');
    // Snapshot request comes back as an image on the phone.
    await phone.getByTestId('sim-snap').click();
    await expect(phone.getByTestId('sim-snapshot')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
