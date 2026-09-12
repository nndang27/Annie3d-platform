import { readFileSync } from 'node:fs';
import { captureDownload, expect, resetDemo, setScenario, signIn, tabTo, test, waitForApp } from './fixtures';

async function waitRunTerminal(page: import('@playwright/test').Page, timeout = 40_000) {
  await expect(page.getByTestId('run-panel')).toBeVisible();
  await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText(
    /Completed|Failed|Cancelled/,
    { timeout },
  );
}

test.describe('journeys', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page);
  });

  test('J1 homepage → template → demo signup → project from that template', async ({ page }) => {
    await page.goto('/templates/feature-callouts-headphones');
    await page.getByTestId('use-template').click();
    await expect(page).toHaveURL(/\/app\/signup\?template=feature-callouts-headphones/);
    await page.getByLabel('Your name').fill('Test Person');
    await page.getByLabel('Email').fill('test@example.demo');
    await page.getByLabel('Workspace name').fill('Test Brand');
    await page.getByRole('button', { name: 'Create demo account' }).click();
    await expect(page).toHaveURL(/\/app\/projects\/new\?template=feature-callouts-headphones/);
    await expect(page.getByTestId('template-feature-callouts-headphones')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('product-name').fill('Aria Pro');
    await page.getByTestId('create-project').click();
    await expect(page).toHaveURL(/\/app\/projects\/proj_\w+\?tab=workflow/);
    await expect(page.getByTestId('workspace')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Aria Pro — Feature callouts');
    // New workspace starts empty apart from this project
    await page.goto('/app');
    await expect(page.getByTestId('project-card')).toHaveCount(1);
  });

  test('J2 upload reference → brief → run → inspect 3D output', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('new-project').click();
    await page.getByRole('radio', { name: 'Upload image' }).click();
    const png = readFileSync('fixtures/test-upload.png');
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'my-product.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByTestId('upload-preview')).toBeVisible();
    await page.getByTestId('product-name').fill('Uploaded serum');
    await page.getByTestId('brief-goal').fill('Launch the serum with a clean turntable.');
    await page.getByTestId('create-project').click();
    await expect(page).toHaveURL(/tab=workflow/);
    // Real uploaded preview is shown in the reference node and the overview
    await expect(page.locator('[data-testid="node-n-ref"] img')).toHaveAttribute('alt', /my-product\.png/);
    await page.getByTestId('run-workflow').click();
    await expect(page.getByTestId('active-run-badge')).toBeVisible();
    await waitRunTerminal(page);
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Completed');
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();
    await expect(page.getByText('Demo fixture, not your image')).toBeVisible();
    await page.waitForFunction(() => window.__3dads.viewers.size > 0);
    const stats = await page.evaluate(() => [...window.__3dads.viewers][0]!.getStats());
    expect(stats.framesRendered as number).toBeGreaterThan(0);
    expect(stats.triangles as number).toBeGreaterThan(1000);
    // Overview shows the real image
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.getByTestId('reference-preview')).toBeVisible();
  });

  test('J3 edit scene/ad → undo/redo → play/scrub → aspect → save/reload', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();
    await page.waitForFunction(() => window.__3dads.viewers.size > 0);
    const headline = page.getByTestId('headline-input');
    await headline.fill('Hello undo');
    await expect(page.getByTestId('ad-overlay')).toContainText('Hello undo');
    await page.getByTestId('background-select').selectOption('charcoal');
    await page.getByTestId('scene-undo').click();
    await expect(page.getByTestId('background-select')).toHaveValue('studio-white');
    await page.getByTestId('scene-redo').click();
    await expect(page.getByTestId('background-select')).toHaveValue('charcoal');
    // playback
    await page.getByTestId('play-toggle').click();
    await expect(page.getByTestId('play-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(600);
    const t1 = await page.getByTestId('time-readout').textContent();
    expect(Number.parseFloat(t1!)).toBeGreaterThan(0);
    await page.getByTestId('play-toggle').click();
    await page.getByTestId('scrubber').fill('3');
    await expect(page.getByTestId('time-readout')).toContainText('3.0');
    // idle: no frames while paused (allow the DPR-restore settle frame first)
    await page.waitForTimeout(1200);
    const f1 = await page.evaluate(() => [...window.__3dads.viewers][0]!.getStats().framesRendered);
    await page.waitForTimeout(1000);
    const f2 = await page.evaluate(() => [...window.__3dads.viewers][0]!.getStats().framesRendered);
    expect(f2).toBe(f1);
    // aspect
    await page.getByRole('radio', { name: '9:16' }).click();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-aspect', '9:16');
    await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 });
    await page.reload();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('headline-input')).toHaveValue('Hello undo');
    await expect(page.getByTestId('background-select')).toHaveValue('charcoal');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-aspect', '9:16');
  });

  test('J4 start run → navigate away → return → status recovered, no duplicate run', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('3dads.latencyScale', '0.6'));
    await page.reload();
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await expect(page).toHaveURL(/\/app\/projects\/proj_/);
    const projectPath = new URL(page.url()).pathname;
    await page.getByTestId('run-workflow').click();
    await expect(page.getByTestId('active-run-badge')).toBeVisible();
    // double click protection: the button is replaced by Stop; a second click cannot start another run
    await page.goto('/app/library');
    await page.goto('/app');
    await expect(page.getByTestId('active-run')).toHaveCount(1);
    await page.reload(); // full reload: the persisted scheduler continues
    await page.goto(`${projectPath}?tab=workflow`);
    await expect(page.getByTestId('run-panel')).toBeVisible();
    await waitRunTerminal(page, 60_000);
    await expect(page.getByTestId('run-history').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Completed');
  });

  test('J5 cancel → retry → prior artifacts kept, late events ignored', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('3dads.latencyScale', '0.6'));
    await page.reload();
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Workflow' }).click();
    const before = await page.evaluate(
      () => (window.__3dads.backend.ws as { artifacts: unknown[] }).artifacts.length,
    );
    await page.getByTestId('run-workflow').click();
    // wait for first step to complete so an artifact exists
    await expect(page.getByTestId('node-n-model').locator('.node-head .badge')).toHaveText('Done', {
      timeout: 30_000,
    });
    await page.getByTestId('cancel-run').click();
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Cancelled', {
      timeout: 15_000,
    });
    const afterCancel = await page.evaluate(
      () => (window.__3dads.backend.ws as { artifacts: unknown[] }).artifacts.length,
    );
    expect(afterCancel).toBeGreaterThan(before);
    // no scheduled work remains for the cancelled run
    await page.waitForTimeout(1500);
    const pending = await page.evaluate(() => window.__3dads.pendingTasks().length);
    expect(pending).toBe(0);
    const afterWait = await page.evaluate(
      () => (window.__3dads.backend.ws as { artifacts: unknown[] }).artifacts.length,
    );
    expect(afterWait).toBe(afterCancel);
    await page.getByTestId('retry-run').click();
    await expect(page.getByText(/Retry of run_/)).toBeVisible();
    await waitRunTerminal(page, 60_000);
    await expect(page.getByTestId('run-history').locator('li')).toHaveCount(2);
  });

  test('J5b failure scenario: failed step, retained outputs, retry only failed step', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Workflow' }).click();
    await setScenario(page, 'partial-result');
    await page.getByTestId('run-workflow').click();
    await waitRunTerminal(page);
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Failed');
    await expect(page.getByTestId('node-n-model').locator('.node-head .badge')).toHaveText('Done');
    await expect(page.getByTestId('node-n-anim').locator('.node-head .badge')).toHaveText('Failed');
    await setScenario(page, 'normal');
    await page.getByTestId('retry-run').click();
    await waitRunTerminal(page);
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Completed');
    await expect(page.getByTestId('node-n-model').locator('.node-head .badge')).toHaveText('Reused');
  });

  test('J6 versions → choose → export → download and validate PNG/JSON/MP4', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Outputs' }).click();
    const cards = page.getByTestId('artifact-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    // choose an older version explicitly
    const v1 = page.locator('[data-testid="artifact-card"]', { hasText: 'v1' }).first();
    await v1.getByTestId('select-artifact').click();
    await expect(v1).toHaveAttribute('data-selected', 'true');
    // compare two
    await page.locator('[data-testid="artifact-card"] input[type="checkbox"]').nth(0).check();
    await page.locator('[data-testid="artifact-card"] input[type="checkbox"]').nth(1).check();
    await expect(page.getByLabel('Compare versions')).toBeVisible();
    // export from studio
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();
    await page.waitForFunction(() => window.__3dads.viewers.size > 0);
    await page.getByTestId('open-export').click();
    await page.getByTestId('preset-png-snapshot').click();
    const dl = await captureDownload(page, () => page.getByTestId('export-run').click());
    expect(dl.filename).toMatch(/\.png$/);
    const png = dl.data;
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(10_000);
    await expect(page.getByTestId('export-result')).toContainText('Browser render');
    // JSON
    await page.getByTestId('preset-scene-json').click();
    const dl2 = await captureDownload(page, () => page.getByTestId('export-run').click());
    expect(dl2.filename).toMatch(/\.json$/);
    const json = JSON.parse(dl2.data.toString('utf8'));
    expect(json.format).toBe('3dads.scene+ad');
    expect(json.scene.fixtureId).toBeTruthy();
    // MP4 via simulated queue
    await page.getByTestId('preset-mp4-render').click();
    await page.getByTestId('export-run').click();
    await expect(page.locator('[data-testid="export-job"][data-status="completed"]').first()).toBeVisible({
      timeout: 30_000,
    });
    const dl3 = await captureDownload(page, () => page.getByTestId('download-export').first().click());
    expect(dl3.filename).toMatch(/\.mp4$/);
    const mp4 = dl3.data;
    expect(mp4.subarray(4, 8).toString()).toBe('ftyp');
    expect(mp4.length).toBeGreaterThan(100_000);
    await expect(page.getByText('Sample media — not your scene').first()).toBeVisible();
  });

  test('J6b WebM browser recording is a real recording', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();
    await page.waitForFunction(() => window.__3dads.viewers.size > 0);
    await page.getByTestId('duration-select').selectOption('3');
    await page.getByTestId('open-export').click();
    await page.getByTestId('preset-webm-preview').click();
    const dl = await captureDownload(page, () => page.getByTestId('export-run').click(), { timeout: 30_000 });
    expect(dl.filename).toMatch(/\.webm$/);
    const webm = dl.data;
    expect(webm.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])); // EBML header
    expect(webm.length).toBeGreaterThan(5_000);
  });

  test('J7 pricing → sign-in → checkout outcomes → entitlement and return destination', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('radio', { name: /Yearly/ }).click();
    await page.getByTestId('choose-team').click();
    await expect(page).toHaveURL(/\/app\/signin\?.*plan=team.*interval=yearly/);
    await expect(page.getByText(/selected plan \(team, yearly\)/)).toBeVisible();
    await page.getByTestId('identity-u_mai').click();
    await expect(page).toHaveURL(/\/app\/billing\/checkout\?plan=team&interval=yearly/);
    await expect(page.getByTestId('checkout')).toContainText('Confirm Team (yearly)');
    await expect(page.getByTestId('checkout')).toContainText('USD 790');
    // cancel first
    await page.getByTestId('pay-cancel').click();
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'cancelled');
    await page.getByRole('link', { name: 'Try checkout again' }).click();
    // decline
    await page.getByTestId('pay-decline').click();
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'failed');
    await page.getByRole('link', { name: 'Usage & billing' }).click();
    await expect(page.getByTestId('subscription-card')).toContainText('Studio');
    // forged success param grants nothing
    await page.goto('/app/billing/checkout?plan=team&interval=monthly&returnTo=%2Fapp%2Flibrary');
    await expect(page.getByTestId('checkout')).toContainText('checkout chk_');
    const id = (await page.getByTestId('checkout').textContent())!.match(/checkout (chk_\w+)/)![1];
    await page.goto(`/app/billing/return?checkout=${id}&success=true`);
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'open');
    await expect(page.getByText('claimed success')).toBeVisible();
    // delayed confirmation: pending → succeeded, once
    await page.goto(`/app/billing/checkout?plan=team&interval=monthly&returnTo=%2Fapp%2Flibrary`);
    await page.getByTestId('pay-delayed').click();
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'pending_confirmation');
    await page.evaluate(() => window.__3dads.clock.advance(5000));
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'succeeded', {
      timeout: 10_000,
    });
    await page.reload(); // repeated callback
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-status', 'succeeded');
    await page.getByTestId('return-continue').click();
    await expect(page).toHaveURL(/\/app\/library/);
    await page.goto('/app/settings/billing');
    await expect(page.getByTestId('subscription-card')).toContainText('Team');
    const invoices = await page
      .getByTestId('invoices')
      .locator('li')
      .filter({ hasText: 'Team · monthly' })
      .count();
    expect(invoices).toBe(1);
  });

  test('J8 sign out → sign in as another user → no leakage', async ({ page }) => {
    await signIn(page, 'u_mai');
    await expect(page.getByTestId('project-card').first()).toBeVisible();
    const lumen = await page
      .getByTestId('project-card')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-project-id')));
    expect(lumen.length).toBeGreaterThan(5);
    await page.getByTestId('account-menu').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/app\/signin/);
    await signIn(page, 'u_alex');
    await expect(page.locator('.app-header')).toContainText('Northwind Audio');
    await expect(page.getByTestId('project-card').first()).toBeVisible();
    const north = await page
      .getByTestId('project-card')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-project-id')));
    expect(north.some((id) => lumen.includes(id))).toBe(false);
    // Deep link to a Lumen project as Alex → missing project, not data
    await page.goto(`/app/projects/${lumen[0]}`);
    await expect(page.getByText('This project is not in your workspace')).toBeVisible();
    await page.goto('/app/library');
    await waitForApp(page);
    const cache = await page.evaluate(() =>
      window.__3dads.queryClient
        .getQueryCache()
        .getAll()
        .map((q: { queryKey: unknown[] }) => JSON.stringify(q.queryKey)),
    );
    expect(cache.some((k) => k.includes('ws_lumen'))).toBe(false);
  });

  test('J9a keyboard-only: sign in, open project, list view, run, inspector', async ({ page }) => {
    await page.goto('/app/signin');
    await expect(page.getByTestId('identity-u_mai')).toBeVisible();
    // Skip link and logo come first in Chromium/Firefox; WebKit skips links on Tab.
    await tabTo(page, page.getByTestId('identity-u_mai'));
    await expect(page.getByTestId('identity-u_mai')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('demo-label')).toBeVisible();
    await page.getByTestId('project-card').first().locator('a').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('workspace')).toBeVisible();
    await page.getByRole('tab', { name: 'Overview' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Workflow' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.getByTestId('workflow-list')).toBeVisible();
    // connect via select instead of dragging
    const sel = page.getByLabel('Model input of Compose scene');
    await sel.selectOption('');
    await expect(page.getByTestId('list-step-n-scene')).toContainText('Not connected');
    await sel.selectOption({ label: 'Build 3D model' });
    await page.getByRole('button', { name: /^Run workflow/ }).focus();
    await page.keyboard.press('Enter');
    await waitRunTerminal(page);
  });

  test('J9b reduced motion, offline recovery, expired session, denied role, missing artifact', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Workflow' }).click();
    // offline while a run is in flight
    await page.evaluate(() => localStorage.setItem('3dads.latencyScale', '0.6'));
    await page.getByTestId('run-workflow').click();
    await expect(page.getByTestId('active-run-badge')).toBeVisible();
    await setScenario(page, 'offline');
    await expect(page.getByText('You are offline')).toBeVisible();
    await page.waitForTimeout(1500);
    await setScenario(page, 'normal');
    await expect(page.getByText('You are offline')).toBeHidden();
    await waitRunTerminal(page, 60_000);
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Completed');
    // expired session → sign in with returnTo, then back
    const here = new URL(page.url()).pathname + new URL(page.url()).search;
    await setScenario(page, 'expired-session');
    await page.reload();
    await expect(page).toHaveURL(/\/app\/signin\?returnTo=/);
    await setScenario(page, 'normal');
    await page.getByTestId('identity-u_mai').click();
    await expect(page).toHaveURL((u) => u.pathname === here.split('?')[0]);
    // denied role
    await setScenario(page, 'denied-role');
    await page.getByTestId('run-workflow').click();
    await expect(page.getByText(/needs the editor role/)).toBeVisible();
    await setScenario(page, 'normal');
    // missing artifact
    await setScenario(page, 'missing-artifact');
    await page.goto('/app/library?artifact=art_missing');
    await expect(page.getByText('Artifact unavailable')).toBeVisible();
    await setScenario(page, 'normal');
  });

  test('J9c unsupported WebGL shows a usable fallback', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return (orig as (this: HTMLCanvasElement, t: string, ...a: unknown[]) => unknown).call(
          this,
          type,
          ...rest,
        );
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    const page = await ctx.newPage();
    await resetDemo(page);
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('webgl-fallback')).toBeVisible();
    await expect(page.getByTestId('headline-input')).toBeEnabled();
    await page.getByTestId('open-export').click();
    await expect(page.getByText(/3D viewer is not available/).first()).toBeVisible();
    await page.getByTestId('preset-scene-json').click();
    const dl = await captureDownload(page, () => page.getByTestId('export-run').click());
    expect(dl.filename).toMatch(/\.json$/);
    await ctx.close();
  });
});
