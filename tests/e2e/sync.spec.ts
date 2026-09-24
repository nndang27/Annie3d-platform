import { expect, test } from '@playwright/test';
import { graph, openCanvas, signUp } from './helpers';

test.describe('signed-in board sync', () => {
  test('guest board is imported on sign-in and edits persist on the server', async ({ page }) => {
    await openCanvas(page);
    await page.getByTestId('prompt').first().click();
    await page.getByTestId('prompt-editor').fill('Imported from guest');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.waitForTimeout(500);
    const guest = await graph(page);

    await signUp(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}/);
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    const imported = await graph(page);
    expect(imported.nodes).toBe(guest.nodes);
    expect(imported.edges).toBe(guest.edges);
    await expect(page.getByTestId('prompt').filter({ hasText: 'Imported from guest' })).toBeVisible();
    await expect(page.getByTestId('credits')).toContainText('60');

    // Edit → batched op → "Saved"; reload proves the server has it.
    await page.getByTestId('add-text').click();
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await page.reload();
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    expect((await graph(page)).nodes).toBe(guest.nodes + 1);
  });

  test('offline edits queue in the outbox and sync when back online', async ({ page, context }) => {
    await signUp(page);
    await openCanvas(page);
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    const n0 = (await graph(page)).nodes;
    await context.setOffline(true);
    await page.getByTestId('add-photo').click();
    await page.getByTestId('add-text').click();
    await expect(page.getByTestId('save-state')).toHaveText(/Offline|Retrying/);
    await context.setOffline(false);
    await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 15_000 });
    await page.reload();
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    expect((await graph(page)).nodes).toBe(n0 + 2);
  });

  test('undo of a synced change is itself synced', async ({ page }) => {
    await signUp(page);
    await openCanvas(page);
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    const n0 = (await graph(page)).nodes;
    await page.getByTestId('add-stage').click();
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await page.reload();
    await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
    expect((await graph(page)).nodes).toBe(n0);
  });
});
