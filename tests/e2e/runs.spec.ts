import { expect, type Page, test } from '@playwright/test';
import { firstNode, graph, openCanvas, signUp } from './helpers';

/** Signed-in board on the seeded example, simulator sped up (dev-only header). */
async function signedInExample(page: Page, speed = '0.05') {
  await page.goto('/home');
  await page.evaluate((s) => localStorage.setItem('annie3d.simSpeed', s), speed);
  await signUp(page);
  await openCanvas(page);
  await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
}

async function editPrompt(page: Page, nodeId: string, text: string) {
  await page.locator(`.react-flow__node[data-id="${nodeId}"] [data-testid=prompt]`).click();
  await page.getByTestId('prompt-editor').fill(text);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
}

test.describe('runs', () => {
  test('new accounts open on the example board, already run and up to date', async ({ page }) => {
    await signedInExample(page);
    const g = await graph(page);
    expect(g.nodes).toBe(21);
    await expect(page.getByTestId('run-all')).toHaveText('Up to date');
    await expect(page.getByTestId('node-packshot').first().locator('img')).toHaveCount(4);
    await expect(page.getByTestId('credits')).toContainText('60');
  });

  test('cost is shown before Run; progress streams live; result replaces the old version', async ({
    page,
  }) => {
    await signedInExample(page);
    const stage = await firstNode(page, 'stage');
    await editPrompt(page, stage, 'Warmer light, marble podium');
    await expect(page.getByTestId('run-all')).toHaveText(/Run all · 22 cr/);
    await page.getByTestId('run-all').click();
    const dialog = page.getByTestId('run-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('run-cached')).toContainText('12 unchanged nodes');
    await expect(page.getByTestId('run-total')).toHaveText('22 credits');
    const before = await page.evaluate(
      (id) => (window as any).__annie3d.useBoard.getState().graph.nodes.get(id).currentVersionId,
      stage,
    );
    await page.getByTestId('run-confirm').click();
    await expect(page.getByTestId('cancel-run')).toBeVisible();
    await expect(page.locator(`.react-flow__node[data-id="${stage}"] .progress`)).toBeVisible();
    await expect(page.getByText(/Run finished · 22 credits/)).toBeVisible({ timeout: 45_000 });
    const after = await page.evaluate(
      (id) => (window as any).__annie3d.useBoard.getState().graph.nodes.get(id).currentVersionId,
      stage,
    );
    expect(after).not.toBe(before);
    await expect(page.locator(`.react-flow__node[data-id="${stage}"] .ver`)).toHaveText('v2');
    await expect(page.getByTestId('credits')).toContainText('38');
    await expect(page.getByTestId('run-all')).toHaveText('Up to date');
  });

  test('a failed quality gate is shown on the node and refunded', async ({ page }) => {
    await signedInExample(page);
    const model = await firstNode(page, 'model3d');
    await editPrompt(page, model, 'bottle #fail');
    await page.locator(`.react-flow__node[data-id="${model}"] [data-testid=run-node]`).click();
    await page.getByTestId('run-confirm').click();
    await expect(page.locator(`.react-flow__node[data-id="${model}"] [data-testid=node-error]`)).toHaveText(
      'Check failed: silhouette_iou',
      { timeout: 45_000 },
    );
    await expect(page.getByText('Run failed · credits refunded')).toBeVisible();
    await expect(page.getByTestId('credits')).toContainText('60');
  });

  test('a reload mid-run resumes the live stream, and Cancel stops it', async ({ page }) => {
    await signedInExample(page, '0.4');
    const model = await firstNode(page, 'model3d');
    await editPrompt(page, model, 'bottle #slow');
    await page.locator(`.react-flow__node[data-id="${model}"] [data-testid=run-node]`).click();
    await page.getByTestId('run-confirm').click();
    await expect(page.locator(`.react-flow__node[data-id="${model}"] .stage-label`)).toBeVisible();
    await page.reload();
    await expect(page.locator(`.react-flow__node[data-id="${model}"] .stage-label`)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('cancel-run').click();
    await expect(page.getByText(/Run cancelled/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('credits')).toContainText('60');
  });
});
