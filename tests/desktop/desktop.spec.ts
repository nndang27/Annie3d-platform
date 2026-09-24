import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { builtManifest, DIST, FakeSite, signed } from './site';

const APP_DIR = join(__dirname, '../../apps/desktop');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

let site: FakeSite;
let userData: string;
let app: ElectronApplication;
let win: Page;

async function launch(env: Record<string, string> = {}) {
  app = await electron.launch({
    args: [APP_DIR],
    env: { ...process.env, ANNIE3D_ORIGIN: site.origin, ANNIE3D_USER_DATA: userData, ...env },
  });
  win = await app.firstWindow();
  await win.waitForSelector('.react-flow__node', { timeout: 30_000 });
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
  expect(info).toMatchObject({ mode: 'pack', shellVersion: '0.1.0', webVersion: builtManifest().version });
  expect(await win.locator('.react-flow__node').count()).toBeGreaterThan(5);
});

test('a deploy that changes one file downloads only that file and shows the update pill', async () => {
  const { m, file } = nextPack('v2');
  site.manifest = signed(m);
  await launch();
  const state = await win.evaluate(() => (window as any).annieDesktop.updates.check());
  expect(state.web).toMatchObject({ status: 'ready', version: m.version, files: 1 });
  expect(state.web.changes.map((c: { id: string }) => c.id)).toEqual(['performance']);
  // Only the changed file came over the network (plus the manifest).
  expect(site.requests.filter((r) => r.startsWith('/assets/'))).toEqual([`/${file}`]);
  const pill = win.getByTestId('update-pill');
  await expect(pill).toContainText('Update ready');
  await expect(pill).toContainText('Performance meter');
  await win.screenshot({ path: 'test-results/desktop/update-pill.png' });
  await pill.getByTestId('update-apply').click();
  await win.waitForSelector('.react-flow__node', { timeout: 30_000 });
  await expect
    .poll(() => win.evaluate(async () => (await (window as any).annieDesktop.info()).webVersion))
    .toBe(m.version);
  const served = await win.evaluate((p) => fetch(`/${p}`).then((r) => r.text()), file);
  expect(served).toContain('/*v2*/');
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
  await launch({ ANNIE3D_CONFIRM_MS: '3000' });
  const before = (await win.evaluate(() => (window as any).annieDesktop.info())).webVersion;
  await win.evaluate(() => (window as any).annieDesktop.updates.check());
  await win.evaluate(() => (window as any).annieDesktop.updates.apply('web'));
  // The broken page shows briefly, then the shell restores the previous version.
  await win.waitForSelector('.react-flow__node', { timeout: 30_000 });
  const after = await win.evaluate(() => (window as any).annieDesktop.updates.get());
  expect(after).toMatchObject({ current: before, rolledBackFrom: m.version });
});

test('a .annie3d file opened by the OS lands on the canvas', async () => {
  await launch();
  const n0 = await win.evaluate(() => (window as any).__annie3d?.useBoard.getState().graph.nodes.size ?? 0);
  const id = crypto.randomUUID();
  const manifest = {
    format: 'annie3d',
    version: 1,
    exportedAt: new Date().toISOString(),
    title: 'From Finder',
    nodes: [{ id, kind: 'text', x: 0, y: 0, label: 'Opened', settings: { text: 'Opened from the OS' } }],
    edges: [],
    outputs: [],
  };
  const path = join(userData, 'opened.annie3d');
  writeFileSync(path, zipSync({ 'annie3d.json': strToU8(JSON.stringify(manifest)) }));
  await app.evaluate(({ app: a }, p) => a.emit('open-file', { preventDefault() {} }, p), path);
  await expect(win.getByText('Opened from the OS')).toBeVisible();
  if (n0) {
    const n1 = await win.evaluate(() => (window as any).__annie3d.useBoard.getState().graph.nodes.size);
    expect(n1).toBe(n0 + 1);
  }
});
