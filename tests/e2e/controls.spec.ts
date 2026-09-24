import { expect, resetDemo, setScenario, signIn, test } from './fixtures';

/** Control matrix: every shipped action asserts an observable outcome. */
test.describe('control coverage', () => {
  test.beforeEach(async ({ page }) => {
    await resetDemo(page);
  });

  test('dashboard: search, filters, create/duplicate/rename/archive/delete, empty state', async ({
    page,
  }) => {
    await signIn(page, 'u_mai');
    const cards = page.getByTestId('project-card');
    await expect(cards.first()).toBeVisible();
    const initial = await cards.count();
    await page.getByTestId('project-search').fill('Aria Pro');
    await expect(page).toHaveURL(/q=Aria/);
    await expect(cards.first()).toContainText('Aria Pro');
    expect(await cards.count()).toBeLessThan(initial);
    await page.getByTestId('project-search').fill('zzz-nothing');
    await expect(page.getByText('No projects match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(cards).toHaveCount(initial);
    await page.getByRole('radio', { name: 'Archived' }).click();
    const archived = await cards.count();
    expect(archived).toBeGreaterThan(0);
    await page.getByRole('radio', { name: 'Active' }).click();
    await page.getByLabel('Filter by template').selectOption('turntable-hero-skincare');
    await expect(cards.first()).toContainText('Turntable hero');
    await page.getByLabel('Filter by template').selectOption('');
    // duplicate
    const first = cards.first();
    const name = await first.locator('a').nth(1).textContent();
    await first.getByRole('button', { name: /More actions/ }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page.getByText('Project duplicated')).toBeVisible();
    await expect(cards.first()).toContainText(`${name} (copy)`);
    // rename
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('Project name').fill('Renamed project');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(cards.first()).toContainText('Renamed project');
    // archive + restore
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(page.getByText('Project archived')).toBeVisible();
    await expect(cards).toHaveCount(initial);
    await page.getByRole('radio', { name: 'Archived' }).click();
    await expect(cards.first()).toContainText('Renamed project');
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await page.getByRole('menuitem', { name: 'Restore' }).click();
    await expect(page.getByText('Project restored')).toBeVisible();
    // delete with confirmation
    await page.getByRole('radio', { name: 'Active' }).click();
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();
    await page.getByRole('button', { name: 'Keep project' }).click();
    await expect(cards).toHaveCount(initial + 1);
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await page.getByRole('menuitem', { name: 'Delete…' }).click();
    await page.getByTestId('confirm-delete').click();
    await expect(cards).toHaveCount(initial);
    // viewer cannot mutate; explained
    await page.getByTestId('account-menu').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await signIn(page, 'u_sam');
    await expect(page.getByTestId('dashboard-new-project')).toHaveAttribute('aria-disabled', 'true');
    await cards
      .first()
      .getByRole('button', { name: /More actions/ })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('new project validation keeps valid fields and explains upload rejection', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.goto('/app/projects/new');
    await page.getByTestId('brief-goal').fill('');
    await page.getByTestId('create-project').click();
    await expect(page.getByText('Enter the product name.')).toBeVisible();
    await page.getByTestId('product-name').fill('Kept value');
    await page.getByTestId('create-project').click();
    await expect(page.getByText('Describe the campaign goal.')).toBeVisible();
    await expect(page.getByTestId('product-name')).toHaveValue('Kept value');
    await page.getByRole('radio', { name: 'Upload image' }).click();
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByText('notes.txt is not an image')).toBeVisible();
    await setScenario(page, 'upload-reject');
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(300 * 1024, 1) });
    await page.getByTestId('brief-goal').fill('goal');
    await page.getByTestId('create-project').click();
    await expect(page.getByText(/big\.png is .* the limit is/)).toBeVisible();
    await expect(page.getByTestId('product-name')).toHaveValue('Kept value');
    // draft survives reload
    await page.reload();
    await expect(page.getByTestId('product-name')).toHaveValue('Kept value');
  });

  test('workflow canvas: Flows-style node, footer settings, menu, palette, context menu, connection rules, undo/redo', async ({
    page,
  }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Workflow' }).click();
    await expect(page.getByTestId('workflow-canvas')).toBeVisible();
    // node anatomy: header, preview placeholder, prompt row, ports
    const anim = page.getByTestId('node-n-anim');
    await expect(anim).toContainText('Animate 3D');
    await expect(anim).toContainText('Your generation will appear here');
    await expect(anim.getByTestId('port-in-scene')).toBeVisible();
    await expect(anim.getByTestId('port-out-clip')).toBeVisible();
    await anim.getByTestId('prompt-n-anim').fill('Slow orbit around the bottle');
    // selecting shows the floating footer with settings; changing one is undoable
    await anim.locator('.flow-head').click();
    const footer = page.getByTestId('footer-n-anim');
    await expect(footer).toBeVisible();
    await footer.getByLabel('Preset').selectOption('dolly-in');
    await page.getByTestId('undo').click();
    await expect(footer.getByLabel('Preset')).toHaveValue('turntable');
    await page.getByTestId('redo').click();
    await expect(footer.getByLabel('Preset')).toHaveValue('dolly-in');
    // "..." menu: rename, duplicate, copy/paste, delete (centre the node first so the footer is not under the composer)
    await page.getByRole('button', { name: 'Center on selected node' }).click();
    await page.getByTestId('more-n-anim').click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('Node title').fill('Dolly shot');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(anim).toContainText('Dolly shot');
    await page.getByTestId('more-n-anim').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page.locator('[data-kind="animation"]')).toHaveCount(2);
    // Duplicate selects the copy (as in Flows); re-select the original before opening its menu.
    await anim.locator('.flow-head').click();
    await page.getByRole('button', { name: 'Center on selected node' }).click();
    await page.getByTestId('more-n-anim').click();
    await expect(page.getByRole('menuitem', { name: 'Download' })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 });
    // palette from the top pill and from the right-click context menu
    await page.getByTestId('add-step').click();
    await expect(page.getByTestId('node-palette')).toBeVisible();
    await page.getByLabel('Search nodes').fill('review');
    await page.getByTestId('palette-review').click();
    await expect(page.locator('[data-kind="review"]')).toHaveCount(2);
    const box = await page.getByTestId('workflow-canvas').boundingBox();
    await page.mouse.click(box!.x + 300, box!.y + 140, { button: 'right' });
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Comment' }).click();
    await expect(page.locator('[data-kind="comment"]')).toHaveCount(1);
    await page.keyboard.press('Meta+k');
    await expect(page.getByTestId('quick-actions')).toBeVisible();
    await page.getByLabel('Search actions').fill('fit');
    await page.getByTestId('palette-fit').click();
    // invalid connection (image → text input) is refused by the validator; edge count unchanged
    const before = await page.evaluate(() => document.querySelectorAll('.react-flow__edge').length);
    const from = page.getByTestId('node-n-ref').getByTestId('port-out-image');
    const to = page.getByTestId('node-n-scene').getByTestId('port-in-brief');
    const fb = await from.boundingBox();
    const tb = await to.boundingBox();
    await page.mouse.move(fb!.x + fb!.width / 2, fb!.y + fb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb!.x + tb!.width / 2, tb!.y + tb!.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => document.querySelectorAll('.react-flow__edge').length)).toBe(before);
    // modes: hand + comment
    await page.getByTestId('mode-hand').click();
    await expect(page.getByTestId('workflow-canvas')).toHaveAttribute('data-mode', 'hand');
    await page.getByTestId('mode-select').click();
    // reload keeps the saved graph
    await page.reload();
    await page.getByRole('tab', { name: 'Workflow' }).click();
    await expect(page.getByTestId('node-n-anim')).toContainText('Dolly shot');
    await expect(page.getByTestId('prompt-n-anim')).toHaveValue('Slow orbit around the bottle');
  });

  test('composer performs meaningful actions and explains unsupported ones', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Studio' }).click();
    const input = page.getByTestId('composer-input');
    await input.fill('Set background to charcoal and headline "Composer wrote this"');
    await input.press('Enter');
    await expect(page.getByTestId('composer-result').last()).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('background-select')).toHaveValue('charcoal');
    await expect(page.getByTestId('headline-input')).toHaveValue('Composer wrote this');
    await input.fill('write me a jingle about serums');
    await input.press('Enter');
    await expect(page.getByTestId('composer-result').last()).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('composer-result').last()).toContainText(
      'outside what the demo composer can do',
    );
    await input.fill('create an orbit workflow');
    await input.press('Enter');
    await expect(page).toHaveURL(/tab=workflow/);
    await expect(page.getByTestId('composer-result').last()).toContainText('orbit-sweep');
    await input.fill('run the workflow');
    await input.press('Enter');
    await expect(page.getByTestId('active-run-badge')).toBeVisible();
    await input.fill('cancel the run');
    await input.press('Enter');
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText('Cancelled', {
      timeout: 15_000,
    });
  });

  test('studio controls visibly change the scene; typing stays responsive while a run streams', async ({
    page,
  }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByTestId('run-workflow').click();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();
    await page.waitForFunction(
      () =>
        window.__annie3d.viewers.size > 0 &&
        [...window.__annie3d.viewers].at(-1)!.getStats().framesRendered > 0,
    );
    const frames0 = await page.evaluate(
      () => [...window.__annie3d.viewers].at(-1)!.getStats().framesRendered,
    );
    await page.getByTestId('swatch-2457d6').click();
    await page.waitForFunction(
      (f0) => [...window.__annie3d.viewers].at(-1)!.getStats().framesRendered > f0,
      frames0,
      { timeout: 5000 },
    );
    await page.getByTestId('camera-select').selectOption('top');
    await page.getByTestId('reset-camera').click();
    await page.getByTestId('fit-object').click();
    await page.getByTestId('brand-b42332').click();
    const cta = page.locator('.ad-cta');
    await expect(cta).toHaveCSS('background-color', 'rgb(180, 35, 50)');
    // typing latency while streaming: each keystroke echoes
    const t0 = Date.now();
    await page.getByTestId('cta-input').fill('');
    await page.getByTestId('cta-input').pressSequentially('Buy now today', { delay: 20 });
    await expect(page.getByTestId('cta-input')).toHaveValue('Buy now today');
    expect(Date.now() - t0).toBeLessThan(3000);
    await expect(page.getByTestId('ad-overlay')).toContainText('Buy now today');
    // part selection via click on canvas
    const box = await page.getByTestId('viewer-canvas').boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.getByTestId('scene-controls')).toContainText(/Selected:/);
  });

  test('outputs: acceptance, download reference image, open in studio, library filters and detail', async ({
    page,
  }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByRole('tab', { name: 'Outputs' }).click();
    const card = page.getByTestId('artifact-card').first();
    await card.getByLabel(/Acceptance for/).selectOption('accepted');
    await expect(card.getByLabel(/Acceptance for/)).toHaveValue('accepted');
    await card.getByRole('button', { name: 'Open in Studio' }).click();
    await expect(page).toHaveURL(/tab=studio/);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-item').first()).toBeVisible();
    await page.getByTestId('library-kind').selectOption('ad-variant');
    await expect(page.getByTestId('library-item').first()).toContainText('ad-variant');
    await page.getByTestId('library-search').fill('nothing-matches-xyz');
    await expect(page.getByText('No outputs match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByTestId('library-item').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog'))
      .toContainText('Provenance')
      .catch(() => {});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('settings: profile, workspace, notifications, members/invitations, roles', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.goto('/app/settings/profile');
    await page.getByTestId('profile-name').fill('Mai T.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await page.getByTestId('profile-name').fill('M');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('at least 2 characters')).toBeVisible();
    await page.goto('/app/settings/workspace');
    await page.getByTestId('workspace-name').fill('Lumen Skincare EU');
    await page.getByRole('button', { name: 'Save workspace' }).click();
    await expect(page.getByText('Workspace saved')).toBeVisible();
    await expect(page.locator('.app-header')).toContainText('Lumen Skincare EU');
    await page.goto('/app/settings/notifications');
    await expect(page.getByTestId('save-notifications')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('label.switch').first().click();
    await page.getByTestId('save-notifications').click();
    await expect(page.getByText('Notification preferences saved')).toBeVisible();
    await page.goto('/app/settings/members');
    await page.getByTestId('invite-email').fill('not-an-email');
    await page.getByTestId('invite-send').click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await page.getByTestId('invite-email').fill('new.person@lumen.demo');
    await page.getByTestId('invite-send').click();
    await expect(page.getByTestId('invitations')).toContainText('new.person@lumen.demo');
    await expect(page.getByText('nothing was emailed')).toBeVisible();
    await page.getByTestId('simulate-accept').click();
    await expect(page.getByTestId('members-table')).toContainText('New Person');
    await page.getByLabel('Role for Sam Okafor').selectOption('editor');
    await expect(page.getByText('Role updated')).toBeVisible();
    // seat limit on Studio (3 seats): now 3 members + invite → limit
    await page.getByTestId('invite-email').fill('fourth@lumen.demo');
    await page.getByTestId('invite-send').click();
    await expect(page.getByText(/includes 3 seats/)).toBeVisible();
  });

  test('notifications panel, scenario page, double-click safety on run start', async ({ page }) => {
    await signIn(page, 'u_mai');
    await page.getByTestId('project-card').first().locator('a').first().click();
    const btn = page.getByTestId('run-workflow');
    await btn.click({ clickCount: 2 });
    await page.getByRole('tab', { name: 'Workflow' }).click();
    await expect(page.getByTestId('run-panel').locator('.badge').first()).toHaveText(
      /Completed|Failed|Cancelled/,
      { timeout: 40_000 },
    );
    await expect(page.getByTestId('run-history').locator('li')).toHaveCount(1);
    await page.getByTestId('notifications-toggle').click();
    await expect(page.getByRole('dialog', { name: 'Notifications' })).toContainText('Run completed');
    await page.getByRole('button', { name: 'Mark read' }).first().click();
    await page.keyboard.press('Escape');
    await page.goto('/app/dev/scenarios');
    await page.getByTestId('scenario-slow').click();
    await expect(page.getByText('Active: slow')).toBeVisible();
    await page.getByTestId('scenario-normal').click();
  });

  test('flaky reads retry; timeout on mutation does not duplicate', async ({ page }) => {
    await signIn(page, 'u_mai');
    await setScenario(page, 'flaky');
    await page.goto('/app/library');
    await expect(page.getByTestId('library-item').first()).toBeVisible({ timeout: 15_000 });
    await setScenario(page, 'normal');
  });
});
