// Lab LCP/CLS/FCP for public pages and the app shell, cold and warm, with and without throttling.
import { BASE, buildIdentity, FAST3G, launch, readVitals, save, stats, VITALS_INIT } from './lib.mjs';

const PAGES = ['/', '/pricing', '/templates', '/templates/turntable-hero-skincare', '/help/quickstart'];
const out = { identity: buildIdentity(), runs: [] };

for (const profile of [
  { name: 'reference', cpuThrottle: 1, network: null },
  { name: 'throttled-4x-fast3g', cpuThrottle: 4, network: FAST3G },
]) {
  for (const path of PAGES) {
    const samples = { cold: [], warm: [] };
    for (let i = 0; i < 3; i++) {
      const { browser, context, page, env } = await launch(profile);
      await context.addInitScript(VITALS_INIT);
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
      samples.cold.push(await readVitals(page));
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
      samples.warm.push(await readVitals(page));
      out.env = env;
      await browser.close();
    }
    const summarise = (arr) => ({
      lcp: stats(arr.map((s) => s.lcp?.time ?? 0)),
      cls: stats(arr.map((s) => s.cls)),
      fcp: stats(arr.map((s) => s.fcp ?? 0)),
      jsTransfer: stats(arr.map((s) => s.jsTransfer)),
      totalTransfer: stats(arr.map((s) => s.totalTransfer)),
      lcpElement: arr[0]?.lcp?.element,
      lcpUrl: arr[0]?.lcp?.url,
      longTasks: arr.map((s) => s.longTasks.length),
    });
    out.runs.push({
      profile: profile.name,
      path,
      cold: summarise(samples.cold),
      warm: summarise(samples.warm),
      resources: samples.cold[0]?.resources.filter((r) => /\.(js|css|webp|avif|woff2)/.test(r.name)),
    });
    console.log(
      profile.name,
      path,
      'cold LCP p50',
      Math.round(out.runs.at(-1).cold.lcp.p50),
      'ms · CLS',
      out.runs.at(-1).cold.cls.max.toFixed(3),
      '· JS',
      Math.round(out.runs.at(-1).cold.jsTransfer.p50 / 1024),
      'KB',
    );
  }
}

// App shell: signin page cold/warm, and dashboard after sign-in (authenticated shell)
for (const profile of [
  { name: 'reference', cpuThrottle: 1, network: null },
  { name: 'throttled-4x-fast3g', cpuThrottle: 4, network: FAST3G },
]) {
  const cold = [];
  const warm = [];
  const dash = [];
  for (let i = 0; i < 3; i++) {
    const { browser, context, page } = await launch(profile);
    await context.addInitScript(VITALS_INIT);
    await page.goto(`${BASE}/app/signin`, { waitUntil: 'load' });
    await page.getByTestId('identity-u_mai').waitFor();
    cold.push(await readVitals(page));
    await page.goto(`${BASE}/app/signin`, { waitUntil: 'load' });
    await page.getByTestId('identity-u_mai').waitFor();
    warm.push(await readVitals(page));
    const t0 = Date.now();
    await page.getByTestId('identity-u_mai').click();
    await page.getByTestId('project-card').first().waitFor();
    dash.push(Date.now() - t0);
    await browser.close();
  }
  out.runs.push({
    profile: profile.name,
    path: '/app/signin (shell)',
    cold: {
      lcp: stats(cold.map((s) => s.lcp?.time ?? 0)),
      cls: stats(cold.map((s) => s.cls)),
      fcp: stats(cold.map((s) => s.fcp ?? 0)),
      jsTransfer: stats(cold.map((s) => s.jsTransfer)),
      bootstrap: stats(cold.map((s) => s.load ?? 0)),
    },
    warm: { lcp: stats(warm.map((s) => s.lcp?.time ?? 0)), jsTransfer: stats(warm.map((s) => s.jsTransfer)) },
    signInToDashboardMs: stats(dash),
    resources: cold[0]?.resources.filter((r) => /\.(js|css)/.test(r.name)),
  });
  console.log(
    profile.name,
    '/app/signin cold LCP p50',
    Math.round(out.runs.at(-1).cold.lcp.p50),
    'ms · JS',
    Math.round(out.runs.at(-1).cold.jsTransfer.p50 / 1024),
    'KB · sign-in→dashboard p50',
    out.runs.at(-1).signInToDashboardMs.p50,
    'ms',
  );
}
save('public-vitals', out);
