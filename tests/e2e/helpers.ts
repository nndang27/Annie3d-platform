import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export interface GraphSummary {
  mode: string;
  nodes: number;
  edges: number;
  saveState: string;
  kinds: Record<string, number>;
}

/** Reads the board store through the dev-only window handle. */
export function graph(page: Page): Promise<GraphSummary> {
  return page.evaluate(() => {
    const s = (window as any).__annie3d.useBoard.getState();
    const kinds: Record<string, number> = {};
    for (const n of s.graph.nodes.values()) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
    return {
      mode: s.mode,
      nodes: s.graph.nodes.size,
      edges: s.graph.edges.size,
      saveState: s.saveState,
      kinds,
    };
  });
}

/** Opens the canvas as a fresh guest and waits for the board to render. */
export async function openCanvas(page: Page, path = '/') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ResizeObserver/.test(m.text())) errors.push(m.text());
  });
  await page.goto(path);
  // First sign-in creates and seeds the example board; allow for a cold dev server.
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as any).__annie3d?.useBoard.getState().mode !== 'loading');
  return errors;
}

/** Signs up with test-only email auth (ANNIE3D_TEST_AUTH=1); cookies land in the page context. */
export async function signUp(page: Page, name = 'E2E Tester') {
  const base = new URL(
    page.url() === 'about:blank' ? (process.env.E2E_BASE ?? 'http://localhost:5191') : page.url(),
  ).origin;
  const r = await page.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: base },
    data: { email: `e2e-${randomUUID()}@example.com`, password: 'correct-horse-battery', name },
  });
  expect(r.status()).toBe(200);
}

/** Drags from a node's output handle to a point or another node's input handle. */
export async function dragWire(page: Page, fromNodeId: string, to: { x: number; y: number }) {
  const h = page.locator(`.react-flow__node[data-id="${fromNodeId}"] .react-flow__handle.source`);
  const b = (await h.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function handleCenter(page: Page, nodeId: string, handleId: string) {
  const b = (await page
    .locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${handleId}"]`)
    .boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Id of the newest node of a kind (UUIDv7 ids sort by creation time). */
export function newestNode(page: Page, kind: string): Promise<string> {
  return page.evaluate((k) => {
    const ids = [...(window as any).__annie3d.useBoard.getState().graph.nodes.values()]
      .filter((n: any) => n.kind === k)
      .map((n: any) => n.id)
      .sort();
    return ids.at(-1);
  }, kind);
}

/** Id of the first node of a kind in z-order (the example board's first, on-screen line). */
export function firstNode(page: Page, kind: string): Promise<string> {
  return page.evaluate((k) => {
    const ns = [...(window as any).__annie3d.useBoard.getState().graph.nodes.values()].filter(
      (n: any) => n.kind === k,
    );
    return ns.sort((a: any, b: any) => (a.zKey < b.zKey ? -1 : 1))[0].id;
  }, kind);
}

/** A point on empty canvas (the pane itself is under it), searched on a grid from the lower middle. */
export function emptyPanePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const w = innerWidth;
    const h = innerHeight;
    for (let y = Math.round(h * 0.75); y > h * 0.2; y -= 40)
      for (let x = Math.round(w * 0.3); x < w * 0.7; x += 40) {
        const el = document.elementFromPoint(x, y);
        if (el?.classList.contains('react-flow__pane')) return { x, y };
      }
    throw new Error('no empty canvas point');
  });
}
