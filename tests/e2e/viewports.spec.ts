import { expect, resetDemo, signIn, test } from './fixtures';

/**
 * Cross-browser / cross-viewport layout check: no horizontal overflow, primary controls visible and
 * inside the viewport, on phone portrait+landscape, tablet portrait+landscape, laptop and wide desktop.
 * Runs on chromium, webkit (Safari engine) and firefox projects.
 */
const VIEWPORTS = [
  ['phone-portrait', 390, 844],
  ['phone-landscape', 844, 390],
  ['small-phone', 320, 568],
  ['tablet-portrait', 768, 1024],
  ['tablet-landscape', 1024, 768],
  ['laptop', 1280, 800],
  ['wide', 1600, 1000],
] as const;

const PUBLIC = [
  '/',
  '/product',
  '/templates',
  '/templates/turntable-hero-skincare',
  '/pricing',
  '/help/quickstart',
];

async function overflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 &&
          getComputedStyle(e).position !== 'fixed',
      )
      .slice(0, 5)
      .map((e) => `${e.tagName}.${String(e.className).split(' ')[0]}`),
  }));
}

async function inViewport(page: import('@playwright/test').Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${selector} visible`).not.toBeNull();
  expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${selector} right edge within ${vp.width}`).toBeLessThanOrEqual(vp.width + 1);
}

for (const [name, w, h] of VIEWPORTS) {
  test(`public pages fit ${name} (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    for (const path of PUBLIC) {
      await page.goto(path);
      const o = await overflow(page);
      expect(o.over, `${path} @ ${name}: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(1);
      await inViewport(page, 'header .logo');
      await inViewport(page, 'main h1');
    }
    // pricing toggle and plan CTA reachable
    await page.goto('/pricing');
    await inViewport(page, '[data-testid="choose-studio"]');
  });

  test(`app screens fit ${name} (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await resetDemo(page);
    await signIn(page, 'u_mai');
    await expect(page.getByTestId('project-card').first()).toBeVisible();
    let o = await overflow(page);
    expect(o.over, `dashboard @ ${name}: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(1);
    await inViewport(page, '[data-testid="new-project"]');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await expect(page.getByTestId('workspace')).toBeVisible();
    for (const tab of ['Overview', 'Workflow', 'Studio', 'Outputs'] as const) {
      await page.getByRole('tab', { name: tab }).click();
      await page.locator(`#panel-${tab.toLowerCase()}`).waitFor();
      if (tab === 'Studio') await expect(page.getByTestId('stage')).toBeVisible();
      if (tab === 'Workflow') await page.waitForTimeout(400);
      o = await overflow(page);
      expect(o.over, `${tab} @ ${name}: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(1);
      await inViewport(page, '[data-testid="run-workflow"], [data-testid="bar-cancel-run"]');
    }
    // composer and toolbar inside the viewport on the workflow tab (canvas or list)
    await page.getByRole('tab', { name: 'Workflow' }).click();
    await inViewport(page, '[data-testid="composer"]');
    await page.goto('/app/settings/billing');
    await expect(page.getByTestId('subscription-card')).toBeVisible();
    o = await overflow(page);
    expect(o.over, `billing @ ${name}: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(1);
    await page.goto('/app/projects/new');
    await expect(page.getByTestId('create-project')).toBeVisible();
    o = await overflow(page);
    expect(o.over, `new project @ ${name}: ${o.offenders.join(', ')}`).toBeLessThanOrEqual(1);
  });
}
