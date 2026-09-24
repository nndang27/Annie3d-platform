import { expect, test } from '@playwright/test';
import { dragWire, firstNode, graph, handleCenter, newestNode, openCanvas } from './helpers';

test.describe('guest canvas', () => {
  test('F1: opens on the example board with rendered outputs and no console errors', async ({ page }) => {
    const errors = await openCanvas(page);
    const g = await graph(page);
    expect(g.mode).toBe('guest');
    expect(g.nodes).toBe(21);
    expect(g.edges).toBe(21);
    await expect(page.getByTestId('node-packshot').first().locator('img')).toHaveCount(4);
    // Every visible preview image actually decoded.
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll('.node-preview img')].every(
            (i) => (i as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
    // Viewport culling: far rows are not in the DOM.
    expect(await page.locator('.react-flow__node').count()).toBeLessThan(21);
    expect(errors).toEqual([]);
  });

  test('add from toolbar, undo and redo', async ({ page }) => {
    await openCanvas(page);
    const before = (await graph(page)).nodes;
    await page.getByTestId('add-stage').click();
    expect((await graph(page)).nodes).toBe(before + 1);
    await page.keyboard.press('ControlOrMeta+z');
    expect((await graph(page)).nodes).toBe(before);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect((await graph(page)).nodes).toBe(before + 1);
  });

  test('typed wires: valid connection is created, invalid one is refused', async ({ page }) => {
    await openCanvas(page);
    await page.getByTestId('add-photo').click();
    const photo = await newestNode(page, 'photo');
    await page.getByTestId('add-stage').click();
    const stage = await newestNode(page, 'stage');
    await page.getByRole('button', { name: /fit to screen/ }).click();
    await page.waitForTimeout(400);
    const edges = (await graph(page)).edges;
    // image → Stage.model (accepts model3d only): refused.
    await dragWire(page, photo, await handleCenter(page, stage, 'model'));
    expect((await graph(page)).edges).toBe(edges);
    // image → Stage.style (accepts image): created.
    await dragWire(page, photo, await handleCenter(page, stage, 'style'));
    expect((await graph(page)).edges).toBe(edges + 1);
  });

  test('wire dropped on empty canvas opens a palette filtered by type', async ({ page }) => {
    await openCanvas(page);
    const model = await firstNode(page, 'model3d');
    const g0 = await graph(page);
    await dragWire(page, model, { x: 700, y: 820 });
    const palette = page.getByTestId('palette');
    await expect(palette).toBeVisible();
    // Only nodes with a model3d input are offered.
    await expect(palette.getByTestId('palette-stage')).toBeVisible();
    await expect(palette.getByTestId('palette-photo')).toHaveCount(0);
    await palette.getByTestId('palette-packshot').click();
    const g1 = await graph(page);
    expect(g1.nodes).toBe(g0.nodes + 1);
    expect(g1.edges).toBe(g0.edges + 1);
  });

  test('keyboard palette search and context menu duplicate/delete', async ({ page }) => {
    await openCanvas(page);
    const n0 = (await graph(page)).nodes;
    await page.locator('.react-flow__pane').click({ position: { x: 900, y: 820 } });
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('searchbox', { name: 'Search nodes' }).fill('ad vid');
    await page.keyboard.press('Enter');
    expect((await graph(page)).kinds.adVideo).toBe(4);
    const id = await newestNode(page, 'adVideo');
    await page
      .locator(`.react-flow__node[data-id="${id}"]`)
      .click({ button: 'right', position: { x: 60, y: 12 } });
    await page.getByTestId('ctx-duplicate').click();
    expect((await graph(page)).nodes).toBe(n0 + 2);
    const dup = await newestNode(page, 'adVideo');
    await page
      .locator(`.react-flow__node[data-id="${dup}"]`)
      .click({ button: 'right', position: { x: 60, y: 12 } });
    await page.getByTestId('ctx-delete').click();
    expect((await graph(page)).nodes).toBe(n0 + 1);
  });

  test('Starters menu drops a pre-wired line of ordinary nodes', async ({ page }) => {
    await openCanvas(page);
    const g0 = await graph(page);
    await page.getByTestId('starters-button').click();
    await page.getByTestId('starter-stone-water').click();
    const g1 = await graph(page);
    expect(g1.nodes - g0.nodes).toBe(7);
    expect(g1.edges - g0.edges).toBe(7);
  });

  test('guest edits survive a reload (IndexedDB)', async ({ page }) => {
    await openCanvas(page);
    await page.getByTestId('prompt').first().click();
    await page.getByTestId('prompt-editor').fill('Chrome bottle on black glass');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.waitForTimeout(500); // guest save is debounced 300 ms
    await page.reload();
    await expect(page.getByText('Chrome bottle on black glass')).toBeVisible();
  });

  test('F11: Run as a guest asks to sign in and names the free run', async ({ page }) => {
    await openCanvas(page);
    await page.getByTestId('run-node').first().click();
    const dialog = page.getByTestId('signin-prompt');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('first full run is free');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('zoom stays between 25% and 200%, steps through presets, never shows a summary view', async ({
    page,
  }) => {
    await openCanvas(page);
    const level = page.getByTestId('zoom-level');
    const out = page.getByRole('button', { name: 'Zoom out' });
    // Each click waits for the 300 ms step to finish, so the next check sees the settled zoom.
    const settle = async () => {
      let prev = '';
      await expect
        .poll(
          async () => {
            const t = (await level.textContent()) ?? '';
            const same = t === prev;
            prev = t;
            return same;
          },
          { intervals: [150] },
        )
        .toBe(true);
    };
    await settle();
    for (let i = 0; i < 10 && (await out.isEnabled()); i++) {
      await out.click();
      await settle();
    }
    await expect(level).toHaveText('25%');
    await expect(out).toBeDisabled();
    await page.waitForTimeout(400);
    // Nodes keep their previews at the smallest zoom (no text-only cards).
    await expect(page.locator('.node-preview').first()).toBeVisible();
    await expect(page.locator('.lod-compact')).toHaveCount(0);
    const cell = Number(await page.getByTestId('canvas-grid').getAttribute('data-cell'));
    // Miro grid: minor cell 80 board units at 25% = 20 px, faint; majors every 4 cells.
    expect(cell).toBe(20);
    const zin = page.getByRole('button', { name: 'Zoom in' });
    await zin.click();
    await expect(level).toHaveText('33%');
    await settle();
    for (let i = 0; i < 12 && (await zin.isEnabled()); i++) {
      await zin.click();
      await settle();
    }
    await expect(level).toHaveText('200%');
    await expect(zin).toBeDisabled();
    // Shift+0 returns to 100%.
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 400 } });
    await page.keyboard.press('Shift+0');
    await expect(level).toHaveText('100%');
  });

  test('a mouse wheel zooms around the cursor within the limits; a trackpad scroll pans', async ({
    page,
  }) => {
    await openCanvas(page);
    const level = page.getByTestId('zoom-level');
    const pane = page.locator('.react-flow__pane');
    const wheel = (deltaY: number, deltaX = 0) =>
      pane.dispatchEvent('wheel', {
        deltaY,
        deltaX,
        deltaMode: 0,
        clientX: 640,
        clientY: 400,
        bubbles: true,
        cancelable: true,
      });
    const before = Number.parseInt((await level.textContent()) ?? '0', 10);
    await wheel(-100);
    await expect
      .poll(async () => Number.parseInt((await level.textContent()) ?? '0', 10))
      .toBeGreaterThan(before);
    for (let i = 0; i < 20; i++) await wheel(-100);
    await expect(level).toHaveText('200%');
    for (let i = 0; i < 40; i++) await wheel(100);
    await expect(level).toHaveText('25%');
    const t = () =>
      page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);
    const t0 = await t();
    await wheel(30.5, 2);
    await expect.poll(t).not.toBe(t0);
    await expect(level).toHaveText('25%');
  });
});

test.describe('node UI, wires and clipboard', () => {
  const store = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const s = (window as any).__annie3d.useBoard.getState();
      return [...s.graph.nodes.values()].map((n: any) => ({
        id: n.id,
        kind: n.kind,
        prompt: n.settings.prompt ?? n.settings.text ?? null,
        outputs: n.currentVersionId ? (s.versions.get(n.currentVersionId)?.outputs.length ?? 0) : 0,
      }));
    });

  test('ports are typed bubbles; the selected node shows its toolbar; a hovered wire can be removed', async ({
    page,
  }) => {
    const errors = await openCanvas(page);
    await page.getByRole('button', { name: 'Close agent' }).click();
    const model = await firstNode(page, 'model3d');
    const node = page.locator(`.react-flow__node[data-id="${model}"]`);
    await expect(node.locator('.react-flow__handle.port.port-image')).toHaveClass(/\bon\b/);
    await expect(node.locator('.react-flow__handle.port.port-text')).not.toHaveClass(/\bon\b/);
    await node.locator('.node-head').click();
    const toolbar = node.getByTestId('node-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('combobox', { name: 'builder' })).toBeVisible();

    const e0 = (await graph(page)).edges;
    const mid = await page.evaluate(() => {
      const p = document.querySelector('.react-flow__edge-path') as SVGPathElement;
      const m = p.getPointAtLength(p.getTotalLength() / 2);
      const q = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM()!);
      return { x: q.x, y: q.y };
    });
    await page.mouse.move(mid.x, mid.y);
    await page.getByTestId('edge-delete').click();
    await expect.poll(async () => (await graph(page)).edges).toBe(e0 - 1);
    await node.locator('.node-head').click();
    await toolbar.getByTestId('node-delete').click();
    await expect(node).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('double-click on the canvas creates a Text node ready to type', async ({ page }) => {
    await openCanvas(page);
    await page.getByRole('button', { name: 'Close agent' }).click();
    const n0 = (await graph(page)).kinds.text ?? 0;
    await page.locator('.react-flow__pane').dblclick({ position: { x: 1100, y: 160 } });
    await expect(page.getByTestId('prompt-editor')).toBeFocused();
    await page.keyboard.type('Soft morning light');
    await page.locator('.react-flow__pane').click({ position: { x: 1200, y: 120 } });
    expect((await graph(page)).kinds.text).toBe(n0 + 1);
    expect((await store(page)).some((n) => n.kind === 'text' && n.prompt === 'Soft morning light')).toBe(
      true,
    );
  });

  test('copy/paste and duplicate carry prompt and outputs; a pasted image becomes a Photo node', async ({
    page,
  }) => {
    await openCanvas(page);
    await page.getByRole('button', { name: 'Close agent' }).click();
    const model = await firstNode(page, 'model3d');
    // Give the model a prompt, then copy it with ⌘C and paste with ⌘V.
    const node = page.locator(`.react-flow__node[data-id="${model}"]`);
    await node.getByTestId('prompt').click();
    await page.keyboard.type('Glossy pink glass');
    await page.keyboard.press('ControlOrMeta+Enter');
    await node.locator('.node-head').click();
    const before = await store(page);
    // Native copy then paste events with a private DataTransfer: parallel browsers in this run share
    // the OS clipboard, so ⌘C/⌘V would race with the other projects.
    await page.mouse.move(1100, 200);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      const fire = (type: string) => {
        const ev = new Event(type, { cancelable: true });
        Object.defineProperty(ev, 'clipboardData', { value: dt });
        window.dispatchEvent(ev);
      };
      fire('copy');
      fire('paste');
    });
    await expect.poll(async () => (await store(page)).length).toBe(before.length + 1);
    const pasted = (await store(page)).find((n) => !before.some((b) => b.id === n.id))!;
    expect(pasted).toMatchObject({ kind: 'model3d', prompt: 'Glossy pink glass', outputs: 1 });
    await expect(
      page
        .locator(
          `.react-flow__node[data-id="${pasted.id}"] .node-preview img, .react-flow__node[data-id="${pasted.id}"] .node-preview video`,
        )
        .first(),
    ).toBeVisible();

    // ⌘D duplicates the (now selected) pasted node.
    await page.keyboard.press('ControlOrMeta+d');
    await expect.poll(async () => (await store(page)).length).toBe(before.length + 2);

    // An image copied from another app pastes as a Photo node holding it.
    const photos = (await graph(page)).kinds.photo ?? 0;
    await page.mouse.move(400, 500);
    await page.evaluate(async () => {
      const png = await (await fetch('/api/public/fixtures/v1/serum/photo_512.webp')).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([png], 'pasted.webp', { type: 'image/webp' }));
      // Firefox ignores clipboardData in the ClipboardEvent constructor; define it on the event.
      const ev = new Event('paste', { cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
      window.dispatchEvent(ev);
    });
    await expect.poll(async () => (await graph(page)).kinds.photo).toBe(photos + 1);
    const photo = await newestNode(page, 'photo');
    await expect(page.locator(`.react-flow__node[data-id="${photo}"] .node-preview img`)).toBeVisible();
  });
});
