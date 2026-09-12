import AxeBuilder from '@axe-core/playwright';
import { expect, resetDemo, signIn, test } from './fixtures';

const PUBLIC = [
  '/',
  '/product',
  '/templates',
  '/templates/turntable-hero-skincare',
  '/pricing',
  '/help',
  '/help/quickstart',
  '/legal/privacy',
  '/nope',
];

for (const path of PUBLIC) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}

test('axe: app screens', async ({ page }) => {
  await resetDemo(page);
  const check = async (label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .exclude('.react-flow')
      .analyze();
    expect(
      results.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  };
  await check('signin');
  await signIn(page, 'u_mai');
  await check('dashboard');
  await page.goto('/app/projects/new');
  await check('new project');
  await page.goto('/app');
  await page.getByTestId('project-card').first().locator('a').first().click();
  await check('overview');
  await page.getByRole('tab', { name: 'Workflow' }).click();
  await page.getByRole('radio', { name: 'List' }).click();
  await check('workflow list');
  await page.getByRole('tab', { name: 'Studio' }).click();
  await expect(page.getByTestId('viewer-canvas')).toBeVisible();
  await check('studio');
  await page.getByRole('tab', { name: 'Outputs' }).click();
  await check('outputs');
  await page.goto('/app/library');
  await check('library');
  await page.goto('/app/settings/billing');
  await check('billing');
  await page.goto('/app/billing/checkout?plan=team&interval=monthly');
  await check('checkout');
});

test('focus is visible and dialogs trap/restore focus', async ({ page }) => {
  await resetDemo(page);
  await signIn(page, 'u_mai');
  const more = page
    .getByTestId('project-card')
    .first()
    .getByRole('button', { name: /More actions/ });
  // Reach the control by keyboard so :focus-visible applies, then check the ring is painted.
  await page.getByTestId('project-card').first().locator('a').nth(1).focus();
  await page.keyboard.press('Tab');
  await expect(more).toBeFocused();
  const outline = await more.evaluate((el) => ({
    style: getComputedStyle(el).outlineStyle,
    visible: el.matches(':focus-visible'),
  }));
  expect(outline.visible).toBe(true);
  expect(outline.style).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await expect(page.getByLabel('Project name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
