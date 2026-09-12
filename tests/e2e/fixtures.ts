import { test as base, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __3dads: {
      reset(dataset?: 'small' | 'typical' | 'stress'): Promise<void>;
      setScenario(id: string): void;
      setLatencyScale(n: number): void;
      getConfig(): { scenario: string; latencyScale: number };
      clock: { now(): number; advance(ms: number): void };
      backend: { ws: unknown; scheduler: { pending(): unknown[] } };
      viewers: Set<{
        getStats(): Record<string, unknown>;
        frameTimeDistribution(): { p50: number; p95: number; max: number; samples: number };
      }>;
      marks(): { name: string; duration: number }[];
      pendingTasks(): unknown[];
      downloads(): { filename: string; blob: Blob; at: number }[];
    };
    __homeViewer?: unknown;
  }
}

export const SCENARIO_KEY = '3dads.scenario';

/** Each test starts with a clean demo database, fast latency, normal scenario. */
export async function resetDemo(
  page: Page,
  opts: { dataset?: 'small' | 'typical' | 'stress'; latencyScale?: number } = {},
) {
  await page.goto('/app/signin');
  await page.waitForFunction(() => !!window.__3dads);
  await page.evaluate(
    async ({ dataset, scale }) => {
      await window.__3dads.reset(dataset);
      localStorage.clear();
      localStorage.setItem('3dads.latencyScale', String(scale));
      localStorage.setItem('3dads.scenario', 'normal');
    },
    { dataset: opts.dataset, scale: opts.latencyScale ?? 0.05 },
  );
  await page.reload();
  await page.waitForFunction(() => !!window.__3dads);
}

export async function signIn(page: Page, who: 'u_mai' | 'u_alex' | 'u_sam' = 'u_mai') {
  // After a sign-out the app navigates to /app/signin itself; wait for it instead of reloading mid-flight.
  await page.waitForURL(/\/app\/signin/, { timeout: 5000 }).catch(() => {});
  if (!page.url().includes('/app/signin')) await page.goto('/app/signin');
  await page.getByTestId(`identity-${who}`).click();
  await expect(page.getByTestId('demo-label')).toBeVisible();
}

/** Wait until the app has booted on the current page (devtools surface present). */
export async function waitForApp(page: Page) {
  await page.waitForFunction(() => !!window.__3dads);
}

/** Press Tab until the locator is focused (WebKit skips links on Tab, so counts differ per browser). */
export async function tabTo(page: Page, locator: import('@playwright/test').Locator, max = 12) {
  // Playwright's WebKit mirrors Safari's default "Tab moves to text fields only"; Option+Tab cycles all controls.
  const key = page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    if (await locator.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('tabTo: element never received focus');
}

/**
 * Trigger an action that starts a download and return the file bytes + name.
 * Chromium/Firefox: the real download event. WebKit: Playwright's WebKit build does not emit
 * downloads for blob: anchors (microsoft/playwright#21892), so the bytes are read from the app's
 * download log instead; the click still goes through the same downloadBlob path.
 */
export async function captureDownload(
  page: Page,
  action: () => Promise<void>,
  opts: { timeout?: number } = {},
): Promise<{ filename: string; data: Buffer }> {
  const timeout = opts.timeout ?? 30_000;
  const isWebKit = page.context().browser()?.browserType().name() === 'webkit';
  if (!isWebKit) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), action()]);
    const path = await dl.path();
    const { readFileSync } = await import('node:fs');
    return { filename: dl.suggestedFilename(), data: readFileSync(path!) };
  }
  const before = await page.evaluate(() => window.__3dads.downloads().length);
  await action();
  await page.waitForFunction((n) => window.__3dads.downloads().length > n, before, { timeout });
  const rec = await page.evaluate(async () => {
    const d = window.__3dads.downloads().at(-1)!;
    const bytes = new Uint8Array(await d.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { filename: d.filename, base64: btoa(bin) };
  });
  return { filename: rec.filename, data: Buffer.from(rec.base64, 'base64') };
}

export async function setScenario(page: Page, id: string) {
  await page.evaluate((s) => window.__3dads.setScenario(s), id);
}

export const consoleErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|swiftshader|GPU stall/i.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (!/sample-render|fonts\.gstatic/.test(r.url()))
      errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  return errors;
};

export const test = base.extend<{ errors: string[] }>({
  page: async ({ page }, use) => {
    // Firefox occasionally aborts the first navigation issued right after a reload with
    // NS_ERROR_FAILURE / <unknown error>; retry once and report it so the count stays visible.
    const orig = page.goto.bind(page);
    page.goto = (async (url: string, opts?: Parameters<Page['goto']>[1]) => {
      try {
        return await orig(url, opts);
      } catch (e) {
        if (!/NS_ERROR_FAILURE|NS_BINDING_ABORTED|unknown error/.test(String(e))) throw e;
        console.warn(`[fixtures] page.goto retried once after: ${String(e).split('\n')[0]} (${url})`);
        await page.waitForTimeout(250);
        return await orig(url, opts);
      }
    }) as Page['goto'];
    const origReload = page.reload.bind(page);
    page.reload = (async (opts?: Parameters<Page['reload']>[0]) => {
      try {
        return await origReload(opts);
      } catch (e) {
        if (!/NS_ERROR_FAILURE|NS_BINDING_ABORTED|unknown error/.test(String(e))) throw e;
        console.warn(`[fixtures] page.reload retried once after: ${String(e).split('\n')[0]}`);
        await page.waitForTimeout(250);
        return await origReload(opts);
      }
    }) as Page['reload'];
    await use(page);
  },
  errors: async ({ page }, use) => {
    const errors = consoleErrors(page);
    await use(errors);
    expect(errors, 'unexpected console/page/resource errors').toEqual([]);
  },
});

export { expect };
