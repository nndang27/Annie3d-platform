import { devices, expect, test } from '@playwright/test';
import { openCanvas } from './helpers';

/** Every control of the top bar, the simulator header and the performance panel fits the screen. */
for (const [name, device] of [
  ['iPhone SE', devices['iPhone SE']],
  ['iPhone 13', devices['iPhone 13']],
  ['iPad Pro 11', devices['iPad Pro 11']],
] as const) {
  test.describe(name, () => {
    // Touch emulation (pointer: coarse) is Chromium's; WebKit and Firefox still check the layout.
    test.use({ viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, hasTouch: true });

    test('chrome fits the screen and touch controls stay reachable', async ({ page }) => {
      await openCanvas(page);
      await page.getByRole('button', { name: 'Close agent' }).click();
      const offscreen = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.topbar button, .topbar a')]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return (
              r.width > 0 &&
              getComputedStyle(b).display !== 'none' &&
              (r.right > innerWidth + 1 || r.left < -1)
            );
          })
          .map((b) => b.getAttribute('aria-label') || b.textContent),
      );
      expect(offscreen).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (test.info().project.name === 'chromium') {
        // Touch screens pan with one finger (no marquee).
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      }

      await page.evaluate(() => {
        const s = (window as any).__annie3d;
        const id = [...s.useBoard.getState().graph.nodes.values()].find(
          (n: any) => n.kind === 'simulation',
        ).id;
        s.useUi.setState({ simulatingNodeId: id });
      });
      const close = page.getByRole('button', { name: 'Close simulator' });
      await expect(close).toBeInViewport();
      await close.click();

      // The board menu (always visible) opens the performance panel on every screen size.
      await page.getByTestId('file-menu').click();
      await page.getByTestId('menu-perf').click();
      const panel = page.getByTestId('perf-panel');
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  });
}
