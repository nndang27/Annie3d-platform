import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { openCanvas } from './helpers';

/**
 * Board files on the website (Chrome and Edge): Open puts the file in its own tab, Save writes
 * the same file back. The files are real browser file handles (the origin private file system);
 * only the pickers are replaced, as a test cannot click through the system's file dialogs.
 */
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const photo = new Uint8Array(readFileSync('fixtures/out/serum/model_poster_1024.webp'));
const photoPath = `assets/${sha(photo)}.webp`;

function boardFile() {
  const [t, p] = [crypto.randomUUID(), crypto.randomUUID()];
  return zipSync({
    'annie3d.json': strToU8(
      JSON.stringify({
        format: 'annie3d',
        version: 2,
        exportedAt: new Date().toISOString(),
        title: 'Web board',
        nodes: [
          { id: t, kind: 'text', x: 0, y: 0, label: 'Note', settings: { text: 'From the web file' } },
          { id: p, kind: 'photo', x: 0, y: 300, label: 'Photo', settings: {} },
        ],
        edges: [],
        outputs: [
          {
            nodeId: p,
            files: [{ path: photoPath, kind: 'image', mime: 'image/webp', role: 'primary', variants: [] }],
          },
        ],
      }),
    ),
    [photoPath]: [photo, { level: 0 }],
  });
}

/** Writes bytes to a file of the origin private file system. */
const putFile = (page: Page, name: string, bytes: Uint8Array) =>
  page.evaluate(
    async ({ name, bytes }) => {
      const dir = await navigator.storage.getDirectory();
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(new Uint8Array(bytes));
      await w.close();
    },
    { name, bytes: Array.from(bytes) },
  );
const getFile = async (page: Page, name: string) =>
  new Uint8Array(
    await page.evaluate(async (name) => {
      const dir = await navigator.storage.getDirectory();
      return Array.from(
        new Uint8Array(await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer()),
      );
    }, name),
  );

test('Chrome/Edge: a board file opens in the tab, Save writes the same file back, Back returns', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The File System Access API is Chrome and Edge only');
  // The pickers answer with files of the origin private file system.
  await context.addInitScript(() => {
    const dir = () => navigator.storage.getDirectory();
    Object.assign(window, {
      showOpenFilePicker: async () => [await (await dir()).getFileHandle('Web board.annie3d')],
      showSaveFilePicker: async () => (await dir()).getFileHandle('Copy.annie3d', { create: true }),
    });
  });
  await openCanvas(page);
  await putFile(page, 'Web board.annie3d', boardFile());

  const board = await page.evaluate(() => (window as any).__annie3d.useBoard.getState().title);
  await page.getByTestId('file-menu').click();
  await page.getByTestId('file-open').click();
  const doc = page;
  await expect(doc).toHaveURL(/\?file=[0-9a-f-]{36}$/);
  await expect(doc.getByText('From the web file')).toBeVisible({ timeout: 30_000 });
  await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
  expect(await doc.evaluate(() => (window as any).__annie3d.useBoard.getState().mode)).toBe('file');
  const img = doc.locator('img[src^="blob:"]').first();
  await expect(img).toBeVisible();

  await doc.getByTestId('add-text').click();
  await expect(doc.getByTestId('doc-state')).toHaveText('Edited');
  expect(await doc.title()).toMatch(/^• Web board\.annie3d/);
  await doc.keyboard.press('ControlOrMeta+s');
  await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
  expect(await doc.title()).toMatch(/^Web board\.annie3d/);

  const saved = unzipSync(await getFile(doc, 'Web board.annie3d'));
  const m = JSON.parse(strFromU8(saved['annie3d.json']!));
  expect(m.nodes).toHaveLength(3);
  expect(sha(saved[photoPath]!)).toBe(sha(photo));
  // After the file was replaced, the photo still shows (it moved to a slice of the new file).
  await expect
    .poll(() =>
      doc
        .locator('img[src^="blob:"]')
        .first()
        .evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth),
    )
    .toBeGreaterThan(0);

  // Save As writes a new file and the tab follows it.
  await doc.keyboard.press('ControlOrMeta+Shift+s');
  await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
  await expect.poll(() => doc.title()).toMatch(/^Copy\.annie3d/);
  expect(Object.keys(unzipSync(await getFile(doc, 'Copy.annie3d')))).toContain(photoPath);
  // The board the tab showed before is still there.
  await doc.goBack();
  await expect
    .poll(() => page.evaluate(() => (window as any).__annie3d?.useBoard.getState().title).catch(() => null))
    .toBe(board);
});
