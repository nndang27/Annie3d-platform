import { expect, type Page, test } from '@playwright/test';
import { firstNode, openCanvas, signUp } from './helpers';

async function openEditor(page: Page) {
  const model = await firstNode(page, 'model3d');
  await page.locator(`.react-flow__node[data-id="${model}"]`).hover();
  await page.locator(`.react-flow__node[data-id="${model}"] [data-testid=open-3d]`).click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.locator('.editor-loading-inline')).toHaveCount(0, { timeout: 20_000 });
  return model;
}

/** Brush stroke across the middle of the viewport. */
async function brushStroke(page: Page) {
  await page.getByTestId('tool-brush').click();
  const box = (await page.getByTestId('editor-canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.42;
  await page.mouse.move(cx - 30, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('selection-chip')).toContainText('faces');
}

test.describe('3D editor', () => {
  test('opens lazily, selects with brush and lasso, clears, and releases its WebGL canvas on close', async ({
    page,
  }) => {
    await openCanvas(page);
    await openEditor(page);
    await expect(page.getByTestId('editor-title')).toHaveText(/v1/);
    await brushStroke(page);
    await page.getByTestId('tool-clear').click();
    await expect(page.getByTestId('selection-chip')).toHaveCount(0);
    // Lasso around the product's upper half.
    await page.getByTestId('tool-lasso').click();
    const b = (await page.getByTestId('editor-canvas').boundingBox())!;
    const pts = [
      [0.35, 0.1],
      [0.65, 0.1],
      [0.65, 0.5],
      [0.35, 0.5],
      [0.35, 0.1],
    ];
    await page.mouse.move(b.x + b.width * pts[0]![0]!, b.y + b.height * pts[0]![1]!);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1))
      await page.mouse.move(b.x + b.width * x!, b.y + b.height * y!, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('selection-chip')).toContainText('faces');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('editor')).toHaveCount(0);
    await expect(page.locator('canvas[data-testid=editor-canvas]')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('edit')).toBeNull();
  });

  test('guest edits ask to sign in', async ({ page }) => {
    await openCanvas(page);
    await openEditor(page);
    await brushStroke(page);
    await page.getByTestId('edit-instruction').fill('Make it gold');
    await page.getByTestId('edit-apply').click();
    await expect(page.getByTestId('signin-prompt')).toBeVisible();
  });

  test('signed in: region edit makes v2, compare shows both, revert makes v1 current again', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.evaluate(() => localStorage.setItem('annie3d.simSpeed', '0.05'));
    await signUp(page);
    await openCanvas(page);
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    const model = await openEditor(page);
    await brushStroke(page);
    await page.getByTestId('edit-instruction').fill('Make the cap matte black');
    await page.getByTestId('edit-apply').click();
    await expect(page.getByTestId('version-2')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('editor-title')).toHaveText(/v2/);
    await page.getByTestId('compare').click();
    await expect(page.locator('.compare-labels')).toContainText('v2');
    await expect(page.locator('.compare-labels')).toContainText('v1');
    await page.getByTestId('compare').click();
    await page.getByTestId('version-1').click();
    await page.getByTestId('make-current').click();
    await expect(page.getByTestId('editor-title')).toHaveText('3D model v1');
    const current = await page.evaluate(
      (id) => (window as any).__annie3d.useBoard.getState().graph.nodes.get(id).currentVersionId,
      model,
    );
    const v1 = await page.evaluate((id) => {
      const s = (window as any).__annie3d.useBoard.getState();
      return [...s.versions.values()].find((v: any) => v.nodeId === id && v.versionNo === 1)?.id;
    }, model);
    expect(current).toBe(v1);
  });

  test('packshot camera sets the downstream packshot to this view', async ({ page }) => {
    await openCanvas(page);
    const model = await openEditor(page);
    await page.getByTestId('tool-camera').click();
    await page.getByTestId('use-view').click();
    const settings = await page.evaluate((id) => {
      const g = (window as any).__annie3d.useBoard.getState().graph;
      const e = [...g.edges.values()].find(
        (x: any) => x.source === id && g.nodes.get(x.target).kind === 'packshot',
      );
      return g.nodes.get(e.target).settings;
    }, model);
    expect(settings.angles).toBe('custom');
    expect(settings.camera.position).toHaveLength(3);
  });
});
