import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { builtManifest, DIST, FakeSite, signed } from './site';

const APP_DIR = join(__dirname, '../../apps/desktop');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

let site: FakeSite;
let userData: string;
let app: ElectronApplication;
let win: Page;

async function launch(env: Record<string, string> = {}, waitForBoard = true, files: string[] = []) {
  app = await electron.launch({
    args: [APP_DIR, ...files],
    // ANNIE3D_RELAUNCH=0: "Restart to update" only quits; each test starts the app again itself.
    env: {
      ...process.env,
      ANNIE3D_ORIGIN: site.origin,
      ANNIE3D_USER_DATA: userData,
      ANNIE3D_RELAUNCH: '0',
      ...env,
    },
  });
  win = await app.firstWindow();
  if (waitForBoard) await win.waitForSelector('.react-flow__node', { timeout: 30_000 });
}

/** Clicks "Restart to update" and waits until the app has quit. */
async function restartToUpdate() {
  const closed = app.waitForEvent('close');
  await win.getByTestId('update-apply').click();
  await closed;
}

/** A next web pack where exactly one file (the performance panel chunk) changed. */
function nextPack(marker: string, builtAtOffset = 1000) {
  const m = builtManifest();
  const f = m.files.find((x) => x.path.startsWith('assets/PerfPanel-'))!;
  const body = Buffer.concat([readFileSync(join(DIST, f.path)), Buffer.from(`\n/*${marker}*/\n`)]);
  site.overrides.set(f.path, body);
  Object.assign(f, { sha256: sha(body), size: body.length });
  m.version = `${m.version}-${marker}`;
  m.builtAt += builtAtOffset;
  return { m, file: f.path };
}

test.beforeEach(async () => {
  site = new FakeSite();
  await site.start();
  userData = mkdtempSync(join(tmpdir(), 'annie3d-desktop-'));
});
test.afterEach(async () => {
  await app?.close().catch(() => {});
  site.stop();
  rmSync(userData, { recursive: true, force: true });
});

test('starts from the bundled web pack on the site origin, even offline', async () => {
  site.stop(); // nothing answers at the origin
  await launch();
  expect(new URL(win.url()).origin).toBe(site.origin);
  const info = await win.evaluate(() => (window as any).annieDesktop.info());
  const { version: shellVersion } = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8'));
  expect(info).toMatchObject({ mode: 'pack', shellVersion, webVersion: builtManifest().version });
  expect(await win.locator('.react-flow__node').count()).toBeGreaterThan(5);
});

test('a deploy shows up while the app is open, and Restart to update starts the new version', async () => {
  await launch({ ANNIE3D_POLL_MS: '1000' });
  // The deploy lands while the app is running; nobody asks the app to check.
  const { m, file } = nextPack('v2');
  site.manifest = signed(m);
  const pill = win.getByTestId('update-pill');
  await expect(pill).toHaveText('Update availableRestart to update', { timeout: 15_000 });
  // Only the changed file came over the network (plus the manifest).
  expect(site.requests.filter((r) => r.startsWith('/assets/'))).toEqual([`/${file}`]);
  await win.screenshot({ path: 'test-results/desktop/update-pill.png' });
  await restartToUpdate();

  await launch();
  expect((await win.evaluate(() => (window as any).annieDesktop.info())).webVersion).toBe(m.version);
  const served = await win.evaluate((p) => fetch(`/${p}`).then((r) => r.text()), file);
  expect(served).toContain('/*v2*/');
  // After the restart the app just runs the new version: no pill, no "what's new".
  await expect(win.getByTestId('update-pill')).toHaveCount(0);

  // The page confirmed, so the next start keeps the new version.
  await app.close();
  await launch();
  expect((await win.evaluate(() => (window as any).annieDesktop.info())).webVersion).toBe(m.version);
  await expect(win.getByTestId('update-pill')).toHaveCount(0);
});

test('a manifest with a bad signature is refused', async () => {
  const { m } = nextPack('evil');
  site.manifest = signed(m, true);
  await launch();
  const state = await win.evaluate(() => (window as any).annieDesktop.updates.check());
  expect(state.web).toMatchObject({ status: 'error', message: 'web pack signature is invalid' });
  expect(site.requests.filter((r) => r.startsWith('/assets/'))).toEqual([]);
  await expect(win.getByTestId('update-pill')).toHaveCount(0);
});

test('an update whose page never starts rolls back to the previous version', async () => {
  const m = builtManifest();
  const broken = Buffer.from('<!doctype html><title>broken</title><p>broken build</p>');
  const index = m.files.find((f) => f.path === 'index.html')!;
  site.overrides.set('index.html', broken);
  Object.assign(index, { sha256: sha(broken), size: broken.length });
  m.version = `${m.version}-broken`;
  m.builtAt += 2000;
  site.manifest = signed(m);
  await launch();
  const before = (await win.evaluate(() => (window as any).annieDesktop.info())).webVersion;
  await win.evaluate(() => (window as any).annieDesktop.updates.check());
  await restartToUpdate();
  // The broken page starts and never confirms; the shell restores the previous version.
  await launch({ ANNIE3D_CONFIRM_MS: '3000' }, false);
  await win.waitForSelector('.react-flow__node', { timeout: 30_000 });
  const after = await win.evaluate(() => (window as any).annieDesktop.updates.get());
  expect(after).toMatchObject({ current: before, rolledBackFrom: m.version });
});

// ---- board files as documents (apps/desktop/src/main/docs.ts, apps/web/src/client/lib/doc.ts) ----

const shaHex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * A board file in the test's data folder: a text node saying `text` and, optionally, a photo
 * node whose image is `photo` (stored, named by content like the app writes it).
 */
function boardFile(text: string, photo?: { bytes: Uint8Array; mime: string; ext: string }, name?: string) {
  const [t, p] = [crypto.randomUUID(), crypto.randomUUID()];
  const asset = photo ? `assets/${shaHex(photo.bytes)}.${photo.ext}` : null;
  const manifest = {
    format: 'annie3d',
    version: 2,
    exportedAt: new Date().toISOString(),
    title: 'From Finder',
    nodes: [
      { id: t, kind: 'text', x: 0, y: 0, label: 'Opened', settings: { text } },
      ...(photo ? [{ id: p, kind: 'photo', x: 0, y: 300, label: 'Photo', settings: {} }] : []),
    ],
    edges: [],
    outputs: photo
      ? [
          {
            nodeId: p,
            files: [
              {
                path: asset,
                kind: photo.mime.startsWith('video') ? 'video' : 'image',
                mime: photo.mime,
                role: 'primary',
                variants: [],
              },
            ],
          },
        ]
      : [],
  };
  const path = join(userData, name ?? `${text.replace(/\W+/g, '-')}.annie3d`);
  writeFileSync(
    path,
    zipSync({
      'annie3d.json': strToU8(JSON.stringify(manifest)),
      ...(photo ? { [asset!]: [photo.bytes, { level: 0 }] } : {}),
    } as Parameters<typeof zipSync>[0]),
  );
  return { path, asset };
}

const docWindow = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      url: w.webContents.getURL(),
      title: w.getTitle(),
      edited: process.platform === 'darwin' ? w.isDocumentEdited() : null,
    })),
  );

/** Replaces a native dialog in the main process with answers given in advance. */
const answer = (fn: 'showMessageBoxSync' | 'showSaveDialog' | 'showErrorBox', values: unknown[]) =>
  app.evaluate(
    ({ dialog }, { fn, values }) => {
      const calls: unknown[] = [];
      (globalThis as Record<string, unknown>)[`__${fn}`] = calls;
      (dialog as unknown as Record<string, unknown>)[fn] = (...args: unknown[]) => {
        calls.push(args.at(-1));
        const v = values.shift();
        return fn === 'showSaveDialog' ? Promise.resolve(v) : v;
      };
    },
    { fn, values },
  );
const calls = (fn: string) =>
  app.evaluate((_e, fn) => (globalThis as Record<string, unknown>)[`__${fn}`], fn);

/** Types into the text node of a document window and leaves the field (an edit). */
async function editText(page: Page, add: string) {
  await page.getByText('From the file').first().click();
  const box = page.getByTestId('prompt-editor').first();
  await box.press('End');
  await box.type(add);
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
}

test('a board file opened from the OS gets its own window; Save writes it back', async () => {
  const photo = {
    bytes: new Uint8Array(readFileSync(join(__dirname, '../../fixtures/out/serum/model_poster_1024.webp'))),
    mime: 'image/webp',
    ext: 'webp',
  };
  const { path, asset } = boardFile('From the file', photo, 'Desk.annie3d');
  await launch({}, true, [path]);
  // Only the document's window: a file double-clicked on a closed app is all that opens.
  const wins = await docWindow();
  expect(wins).toHaveLength(1);
  expect(wins[0]!.url).toMatch(/\?doc=[0-9a-f-]{36}$/);
  expect(wins[0]!.title).toBe('Desk.annie3d');
  await expect(win.getByText('From the file')).toBeVisible();
  await expect(win.getByTestId('doc-state')).toHaveText('Saved');
  // The photo streams from the file on disk.
  const img = win.locator(`img[src*="/__doc/"]`).first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await editText(win, ' and edited');
  await expect(win.getByTestId('doc-state')).toHaveText('Edited');
  if (process.platform === 'darwin') expect((await docWindow())[0]!.edited).toBe(true);
  await win.keyboard.press(`${MOD}+s`);
  await expect(win.getByTestId('doc-state')).toHaveText('Saved');
  if (process.platform === 'darwin') expect((await docWindow())[0]!.edited).toBe(false);

  const saved = unzipSync(new Uint8Array(readFileSync(path)));
  const m = JSON.parse(strFromU8(saved['annie3d.json']!));
  expect(m.version).toBe(2);
  expect(JSON.stringify(m.nodes)).toContain('From the file and edited');
  // The photo was copied from the old file, byte for byte, under the same name.
  expect(shaHex(saved[asset!]!)).toBe(shaHex(photo.bytes));
  // No temporary file left next to it.
  expect(readdirSync(userData).filter((f) => f.endsWith('.tmp'))).toEqual([]);
});

test('closing with unsaved changes asks: Cancel keeps the window, Don’t Save closes it', async () => {
  const { path } = boardFile('From the file');
  const before = readFileSync(path);
  await launch({}, true, [path]);
  await editText(win, '!');
  await expect(win.getByTestId('doc-state')).toHaveText('Edited');
  await answer('showMessageBoxSync', [2, 1]); // Cancel, then Don't Save
  const close = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await close();
  await win.waitForTimeout(300);
  expect(await docWindow()).toHaveLength(1);
  const closed = win.waitForEvent('close');
  await close();
  await closed;
  expect((await calls('showMessageBoxSync')) as unknown[]).toHaveLength(2);
  expect(readFileSync(path).equals(before)).toBe(true);
});

test('a new board file asks where on its first save, then saves there', async () => {
  await launch();
  const target = join(userData, 'New board.annie3d');
  await answer('showSaveDialog', [{ canceled: false, filePath: target }]);
  const next = app.waitForEvent('window');
  await win.evaluate(() => (window as any).annieDesktop.docs.create());
  const doc = await next;
  await doc.waitForSelector('[data-testid="doc-state"]');
  await expect(doc.getByTestId('doc-state')).toHaveText('Not saved');
  await doc.getByTestId('add-text').click();
  await expect(doc.getByTestId('doc-state')).toHaveText('Edited');
  await doc.keyboard.press(`${MOD}+s`);
  await expect(doc.getByTestId('doc-state')).toHaveText('Saved');
  const m = JSON.parse(strFromU8(unzipSync(new Uint8Array(readFileSync(target)))['annie3d.json']!));
  expect(m.nodes.map((n: { kind: string }) => n.kind)).toEqual(['text']);
  expect(await doc.title()).toBeTruthy();
  const titles = (await docWindow()).map((w) => w.title);
  expect(titles).toContain('New board.annie3d');
});

test('a zip bomb is refused with a message and nothing is read', async () => {
  await launch();
  await answer('showErrorBox', [undefined]);
  const manifest = {
    format: 'annie3d',
    version: 2,
    exportedAt: new Date().toISOString(),
    title: 'x',
    nodes: [],
    edges: [],
    outputs: [],
  };
  const bomb = join(userData, 'bomb.annie3d');
  // 300 MB of zeros, deflated to about 300 KB.
  writeFileSync(
    bomb,
    zipSync({
      'annie3d.json': strToU8(JSON.stringify(manifest)),
      'assets/x.bin': [new Uint8Array(300 * 1024 * 1024), { level: 9 }],
    }),
  );
  await app.evaluate(({ app: a }, p) => a.emit('open-file', { preventDefault() {} }, p), bomb);
  await expect
    .poll(async () => ((await calls('showErrorBox')) as unknown[] | undefined)?.length ?? 0)
    .toBe(1);
  expect(await docWindow()).toHaveLength(1); // still just the board that was open
});

test('a 200 MB board file opens at once: assets stream from disk by range', async () => {
  const video = randomBytes(200 * 1024 * 1024);
  const { path, asset } = boardFile(
    'From the file',
    { bytes: video, mime: 'video/mp4', ext: 'mp4' },
    'Big.annie3d',
  );
  const t0 = Date.now();
  await launch({}, true, [path]);
  await expect(win.getByText('From the file')).toBeVisible();
  const openMs = Date.now() - t0;
  const range = await win.evaluate(async (a) => {
    const id = new URLSearchParams(location.search).get('doc');
    const r = await fetch(`/__doc/${id}/${a}`, { headers: { range: 'bytes=1000-1099' } });
    return {
      status: r.status,
      len: (await r.arrayBuffer()).byteLength,
      total: r.headers.get('content-range'),
    };
  }, asset!);
  expect(range).toEqual({ status: 206, len: 100, total: `bytes 1000-1099/${video.length}` });
  // The page never held the file: its memory stays far below the file's size.
  const mb = await app.evaluate(({ app: a, BrowserWindow }) => {
    const pid = BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId();
    return Math.round((a.getAppMetrics().find((m) => m.pid === pid)?.memory.workingSetSize ?? 0) / 1024);
  });
  console.log(`200 MB board file: window ready in ${openMs} ms, page memory ${mb} MB`);
  expect(openMs).toBeLessThan(15_000);
  expect(mb).toBeLessThan(200);
});

test('Save keeps an Export ZIP as its member list, and the ZIP comes back whole', async () => {
  const png = new Uint8Array(
    readFileSync(join(__dirname, '../../fixtures/out/serum/model_poster_1024.webp')),
  );
  const glb = new Uint8Array(readFileSync(join(__dirname, '../../fixtures/out/serum/model.glb')));
  // Like a real Export node: its ZIP holds the photo and its own web GLB, which is its 2nd output.
  const inner = zipSync({ 'serum-image-1.webp': [png, { level: 0 }], 'serum-web.glb': [glb, { level: 0 }] });
  const [p, e] = [crypto.randomUUID(), crypto.randomUUID()];
  const paths = {
    png: `assets/${shaHex(png)}.webp`,
    glb: `assets/${shaHex(glb)}.glb`,
    zip: `assets/${shaHex(inner)}.zip`,
  };
  const file = join(userData, 'Export.annie3d');
  const out = (path: string, kind: string, mime: string) => ({
    path,
    kind,
    mime,
    role: 'primary',
    variants: [],
  });
  writeFileSync(
    file,
    zipSync({
      'annie3d.json': strToU8(
        JSON.stringify({
          format: 'annie3d',
          version: 1,
          exportedAt: new Date().toISOString(),
          title: 'Export',
          nodes: [
            { id: p, kind: 'photo', x: 0, y: 0, label: null, settings: {} },
            { id: e, kind: 'export', x: 400, y: 0, label: null, settings: {} },
          ],
          edges: [],
          outputs: [
            { nodeId: p, files: [out(paths.png, 'image', 'image/webp')] },
            {
              nodeId: e,
              files: [
                out(paths.zip, 'file', 'application/zip'),
                { ...out(paths.glb, 'model3d', 'model/gltf-binary'), role: 'extra' },
              ],
            },
          ],
        }),
      ),
      [paths.png]: [png, { level: 0 }],
      [paths.zip]: [inner, { level: 0 }],
      [paths.glb]: [glb, { level: 0 }],
    } as Parameters<typeof zipSync>[0]),
  );
  const before = readFileSync(file).length;
  await launch({}, true, [file]);
  await win.getByTestId('add-text').click();
  await win.keyboard.press(`${MOD}+s`);
  await expect(win.getByTestId('doc-state')).toHaveText('Saved');
  const saved = unzipSync(new Uint8Array(readFileSync(file)));
  const m = JSON.parse(strFromU8(saved['annie3d.json']!));
  const zipOut = m.outputs
    .flatMap((g: { files: unknown[] }) => g.files)
    .find((f: { mime: string }) => f.mime === 'application/zip');
  expect(zipOut.bundle.map((b: { name: string }) => b.name)).toEqual(['serum-image-1.webp', 'serum-web.glb']);
  expect(saved[paths.zip]).toBeUndefined();
  expect(readFileSync(file).length).toBeLessThan(before - inner.length + 2000);
  // Opened again, the ZIP is served whole, rebuilt from the members on disk.
  const next = app.waitForEvent('window');
  await win.evaluate(() => (window as any).annieDesktop.docs.create());
  await (await next).close();
  await app.close();
  await launch({}, true, [file]);
  const back = await win.evaluate(async (zp) => {
    const id = new URLSearchParams(location.search).get('doc');
    return Array.from(new Uint8Array(await (await fetch(`/__doc/${id}/${zp}`)).arrayBuffer()));
  }, zipOut.path);
  const rebuilt = unzipSync(new Uint8Array(back));
  expect(shaHex(rebuilt['serum-web.glb']!)).toBe(shaHex(glb));
  expect(shaHex(rebuilt['serum-image-1.webp']!)).toBe(shaHex(png));
});

test('Restart to update opens the same board files again (Save first when there are edits)', async () => {
  const { path } = boardFile('From the file', undefined, 'Kept open.annie3d');
  await launch({ ANNIE3D_POLL_MS: '1000' });
  const next = app.waitForEvent('window');
  await app.evaluate(({ app: a }, p) => a.emit('open-file', { preventDefault() {} }, p), path);
  const doc = await next;
  await doc.waitForSelector('.react-flow__node');
  win = doc;
  await editText(doc, ' before the update');
  await expect(doc.getByTestId('doc-state')).toHaveText('Edited');
  // An update lands; the save prompt answers "Save", then the app quits into it.
  await answer('showMessageBoxSync', [0]);
  const { m } = nextPack('v2');
  site.manifest = signed(m);
  const board = (await app.windows()).find((w) => !w.url().includes('?doc='))!;
  await expect(board.getByTestId('update-pill')).toContainText('Restart to update', { timeout: 15_000 });
  const closed = app.waitForEvent('close');
  await board.getByTestId('update-apply').click();
  await closed;
  expect(strFromU8(unzipSync(new Uint8Array(readFileSync(path)))['annie3d.json']!)).toContain(
    'before the update',
  );

  // Started again: the usual board and the file, as before.
  app = await electron.launch({
    args: [APP_DIR],
    env: { ...process.env, ANNIE3D_ORIGIN: site.origin, ANNIE3D_USER_DATA: userData, ANNIE3D_RELAUNCH: '0' },
  });
  await expect
    .poll(async () => (await docWindow()).map((w) => w.title).sort(), { timeout: 20_000 })
    .toEqual(['Annie 3D', 'Kept open.annie3d'].sort());
  let reopened: Page | undefined;
  await expect
    .poll(async () => {
      reopened = app.windows().find((w) => w.url().includes('?doc='));
      return !!reopened;
    })
    .toBe(true);
  if (!reopened) return;
  await expect(reopened.getByText('From the file before the update')).toBeVisible({ timeout: 20_000 });
  expect(
    await reopened.evaluate(() => (window as any).annieDesktop.info().then((i: any) => i.webVersion)),
  ).toBe(m.version);
});
