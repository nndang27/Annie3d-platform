import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, type Page, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Local-first board files against the real stack (Worker + Neon test branch + R2), with the
 * desktop app pointed at the dev server: a file opens without the server, and Run first uploads
 * it as a hidden working copy, then the results come back into the file on Save.
 * Run with: node scripts/test-stack.mjs 5191 npx playwright test -c playwright.desktop-cloud.config.ts
 */
const BASE = process.env.E2E_BASE ?? 'http://localhost:5191';
const APP_DIR = join(__dirname, '../../apps/desktop');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('a board file runs through a hidden working copy; Save brings the result into the file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'annie3d-lf-'));
  const photo = new Uint8Array(readFileSync(join(__dirname, '../../fixtures/out/serum/photo_512.webp')));
  const photoPath = `assets/${sha(photo)}.webp`;
  // A second photo feeding a second 3D model: running the first model does not read it, so it
  // must stay in the file; Run all reads it, so then it goes up.
  const other = new Uint8Array(readFileSync(join(__dirname, '../../fixtures/out/serum/packshot_detail.png')));
  const otherPath = `assets/${sha(other)}.png`;
  const [p, m3d, o, m2] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const file = join(dir, 'Serum.annie3d');
  writeFileSync(
    file,
    zipSync({
      'annie3d.json': strToU8(
        JSON.stringify({
          format: 'annie3d',
          version: 2,
          exportedAt: new Date().toISOString(),
          title: 'Serum',
          nodes: [
            { id: p, kind: 'photo', x: 0, y: 0, label: 'Photo', settings: {} },
            { id: o, kind: 'photo', x: 0, y: 500, label: 'Other photo', settings: {} },
            { id: m2, kind: 'model3d', x: 420, y: 500, label: 'Other model', settings: { detail: 'draft' } },
            {
              id: m3d,
              kind: 'model3d',
              x: 420,
              y: 0,
              label: null,
              settings: { prompt: 'glass bottle', detail: 'draft' },
            },
          ],
          edges: [
            { id: crypto.randomUUID(), source: p, target: m3d, targetPort: 'images' },
            { id: crypto.randomUUID(), source: o, target: m2, targetPort: 'images' },
          ],
          outputs: [
            {
              nodeId: p,
              files: [{ path: photoPath, kind: 'image', mime: 'image/webp', role: 'primary', variants: [] }],
            },
            {
              nodeId: o,
              files: [{ path: otherPath, kind: 'image', mime: 'image/png', role: 'primary', variants: [] }],
            },
          ],
        }),
      ),
      [photoPath]: [photo, { level: 0 }],
      [otherPath]: [other, { level: 0 }],
    }),
  );
  const app = await electron.launch({
    args: [APP_DIR],
    env: {
      ...process.env,
      ANNIE3D_DEV_URL: BASE,
      ANNIE3D_ORIGIN: BASE,
      ANNIE3D_USER_DATA: dir,
      ANNIE3D_RELAUNCH: '0',
    },
  });
  try {
    const main = await app.firstWindow();
    await main.waitForSelector('.react-flow__node', { timeout: 60_000 });
    // Sign in (test auth), and speed the simulated engines up.
    const signup = await main.evaluate(async () => {
      localStorage.setItem('annie3d.simSpeed', '0.03');
      const r = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `lf-${crypto.randomUUID()}@example.com`,
          password: 'correct-horse-battery',
          name: 'LF',
        }),
      });
      return r.status === 200 ? 200 : `${r.status} ${await r.text()}`;
    });
    expect(signup).toBe(200);
    const before = await main.evaluate(async () => (await (await fetch('/api/boards')).json()).boards.length);

    const next = app.waitForEvent('window');
    await app.evaluate(({ app: a }, f) => a.emit('open-file', { preventDefault() {} }, f), file);
    const doc: Page = await next;
    await doc.waitForSelector('.react-flow__node', { timeout: 60_000 });
    await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
    // Opening sent nothing to the server.
    expect(await doc.evaluate(() => (window as any).__annie3d.useBoard.getState().mode)).toBe('file');

    // Run the 3D model node: the file becomes a working copy first, then the run dialog opens.
    const node = doc
      .locator('.react-flow__node')
      .filter({ has: doc.getByTestId('run-node') })
      .filter({ hasNotText: 'Other model' })
      .first();
    await node.getByTestId('run-node').click();
    await expect(doc.getByTestId('run-dialog')).toBeVisible({ timeout: 60_000 });
    expect(await doc.evaluate(() => (window as any).__annie3d.useBoard.getState().mode)).toBe('remote');
    // Only what the run reads went up: the other photo is on the canvas but not on the server.
    const onServer = () =>
      doc.evaluate(async () => {
        const s = (window as any).__annie3d.useBoard.getState();
        const snap = await (await fetch(`/api/boards/${s.boardId}`)).json();
        const other = (n: { label: string | null }) => n.label === 'Other photo';
        return {
          server: !!snap.nodes.find(other)?.currentVersionId,
          canvas: !![...s.graph.nodes.values()].find(other)?.currentVersionId,
        };
      });
    expect(await onServer()).toEqual({ server: false, canvas: true });
    await doc.getByTestId('run-confirm').click();
    await expect(doc.getByText(/Run finished/)).toBeVisible({ timeout: 90_000 });
    // The working copy is not one of the user's boards.
    expect(await doc.evaluate(async () => (await (await fetch('/api/boards')).json()).boards.length)).toBe(
      before,
    );
    await expect(doc.getByTestId('doc-state')).toHaveText('Edited');

    await doc.keyboard.press(`${MOD}+s`);
    await expect(doc.getByTestId('doc-state')).toHaveText('Saved', { timeout: 60_000 });
    const saved = unzipSync(new Uint8Array(readFileSync(file)));
    const man = JSON.parse(strFromU8(saved['annie3d.json']!));
    const model = man.outputs.find((o: { files: { kind: string }[] }) => o.files[0]!.kind === 'model3d');
    expect(model).toBeTruthy();
    const glb = saved[model.files[0].path]!;
    expect(strFromU8(glb.subarray(0, 4))).toBe('glTF');
    // The photos are still the same bytes (copied from the old file, not downloaded again).
    expect(sha(saved[photoPath]!)).toBe(sha(photo));
    expect(sha(saved[otherPath]!)).toBe(sha(other));

    // Run all reads every node: now the other photo goes up, just before the run dialog opens.
    await doc.getByTestId('run-all').click();
    await expect(doc.getByTestId('run-dialog')).toBeVisible({ timeout: 60_000 });
    expect(await onServer()).toEqual({ server: true, canvas: true });
    // Sending results the file already has is not an edit.
    await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
  } finally {
    await app.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});
