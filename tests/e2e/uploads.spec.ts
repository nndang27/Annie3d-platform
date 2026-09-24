import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { graph, newestNode, openCanvas, signUp } from './helpers';

test('signed-in photo upload goes to R2 (presigned) and becomes the node version', async ({ page }) => {
  await page.goto('/home');
  await signUp(page, 'Uploader');
  await openCanvas(page);
  await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
  await page.getByTestId('add-photo').click();
  const id = await newestNode(page, 'photo');
  const node = page.locator(`.react-flow__node[data-id="${id}"]`);
  await node
    .locator('input[type=file]')
    .setInputFiles({
      name: 'product.png',
      mimeType: 'image/png',
      buffer: readFileSync('fixtures/test-upload.png'),
    });
  await expect(node.locator('.node-preview img')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.reload();
  await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
  const v = await page.evaluate((nid) => {
    const s = (window as any).__annie3d.useBoard.getState();
    const n = s.graph.nodes.get(nid);
    return n.currentVersionId ? s.versions.get(n.currentVersionId)?.source : null;
  }, id);
  expect(v).toBe('upload');
  expect((await graph(page)).mode).toBe('remote');
});
