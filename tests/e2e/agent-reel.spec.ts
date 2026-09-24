import { expect, type Page, test } from '@playwright/test';
import { firstNode, openCanvas, signUp } from './helpers';

async function signedIn(page: Page) {
  await page.goto('/home');
  await page.evaluate(() => localStorage.setItem('annie3d.simSpeed', '0.05'));
  await signUp(page, 'Agent Tester');
  await openCanvas(page);
  await page.waitForFunction(() => (window as any).__annie3d.useBoard.getState().mode === 'remote');
}

async function select(page: Page, id: string) {
  await page.locator(`.react-flow__node[data-id="${id}"] .node-head`).click();
  await expect(page.locator('.agent .chip').first()).toBeVisible();
}

test.describe('agent (F7)', () => {
  test('edits the selected line, runs it, and the edit is undoable', async ({ page }) => {
    await signedIn(page);
    const video = await firstNode(page, 'adVideo');
    await select(page, video);
    await page.getByTestId('agent-input').fill('make it square');
    await page.keyboard.press('Enter');
    await expect(page.locator('.op-chip').last()).toContainText('aspect → 1:1');
    const aspect = () =>
      page.evaluate(
        (id) => (window as any).__annie3d.useBoard.getState().graph.nodes.get(id).settings.aspect,
        video,
      );
    expect(await aspect()).toBe('1:1');
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 400 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(aspect).toBe('9:16');
    await expect(page.getByTestId('save-state')).toHaveText('Saved');

    const stage = await firstNode(page, 'stage');
    await select(page, stage);
    await page.getByTestId('agent-input').fill('use the velvet look and run it');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('msg-agent').last()).toContainText('Velvet');
    await expect(page.getByText(/Run finished · \d+ credits/)).toBeVisible({ timeout: 45_000 });
    // History survives a reload.
    await page.reload();
    await expect(page.getByTestId('msg-user').first()).toContainText('make it square');
  });
});

test.describe('process reel (F12)', () => {
  test('records the last run as a 9:16 reel, saves and offers the download', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'MediaRecorder codecs differ; recorded in Chromium');
    test.setTimeout(120_000);
    await signedIn(page);
    const stage = await firstNode(page, 'stage');
    await select(page, stage);
    await page.getByTestId('agent-input').fill('use the velvet look and run it');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Run finished/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('make-reel').click();
    await page.getByTestId('reel-record').click();
    await expect(page.getByTestId('reel-progress')).toBeVisible();
    await expect(page.getByTestId('reel-video').or(page.getByTestId('reel-error'))).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId('reel-error')).toHaveCount(0);
    await expect(page.getByTestId('reel-video')).toBeVisible();
    const href = await page.getByTestId('reel-download').getAttribute('href');
    expect(href).toMatch(/\/api\/assets\/.+\/content\?download=.+-reel\.(webm|mp4)$/);
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect((await res.body()).byteLength).toBeGreaterThan(10_000);
  });
});
