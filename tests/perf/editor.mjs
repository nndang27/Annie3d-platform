// Cold editor entry, warm navigation, typing while streaming, graph pan, 3D orbit/playback, idle rendering,
// model switching, repeated mount/unmount (resource plateau).
import { BASE, buildIdentity, launch, resetDemo, save, signIn, stats } from './lib.mjs';

const out = { identity: buildIdentity(), sections: {} };
const { browser, page, cdp, env } = await launch({
  gpu: process.env.GPU === 'real' ? 'real' : 'swiftshader',
});
out.env = env;
await resetDemo(page, 0.05);
await signIn(page);

const _openProject = async () => {
  await page.goto(`${BASE}/app`);
  await page.getByTestId('project-card').first().locator('a').first().click();
  await page.getByTestId('workspace').waitFor();
};

// --- cold editor entry (Studio tab, viewer chunk + first useful frame) ---
{
  const samples = [];
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/app`);
    await page.getByTestId('project-card').first().locator('a').first().click();
    await page.getByTestId('workspace').waitFor();
    await page.evaluate(() => performance.clearMeasures());
    const t0 = Date.now();
    await page.getByRole('tab', { name: 'Studio' }).click();
    await page.getByTestId('viewer-canvas').waitFor();
    await page.waitForFunction(
      () => window.__3dads.viewers.size > 0 && [...window.__3dads.viewers][0].getStats().framesRendered > 0,
    );
    const wall = Date.now() - t0;
    const marks = await page.evaluate(() => window.__3dads.marks());
    samples.push({
      wall,
      import: marks.find((m) => m.name === 'viewer:import')?.duration,
      firstUsefulFrame: marks.find((m) => m.name === 'viewer:first-useful-frame')?.duration,
    });
  }
  out.sections.coldEditorEntry = {
    samples,
    wall: stats(samples.map((s) => s.wall)),
    importMs: stats(samples.map((s) => s.import ?? 0)),
    firstUsefulFrameMs: stats(samples.map((s) => s.firstUsefulFrame ?? 0)),
  };
  console.log(
    'cold editor entry (tab click → first 3D frame) p50',
    out.sections.coldEditorEntry.wall.p50,
    'ms; viewer import',
    out.sections.coldEditorEntry.importMs.p50,
    'ms',
  );
}

// --- warm navigation between tabs ---
{
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const tab = ['Overview', 'Workflow', 'Outputs', 'Studio'][i % 4];
    const t0 = Date.now();
    await page.getByRole('tab', { name: tab }).click();
    await page.locator(`#panel-${tab.toLowerCase()}`).waitFor();
    samples.push(Date.now() - t0);
  }
  out.sections.warmTabNavigation = stats(samples);
  console.log('warm tab navigation p50', out.sections.warmTabNavigation.p50, 'ms');
}

// --- action acknowledgement: click → visible state (Run button → Stop run) ---
{
  await page.getByRole('tab', { name: 'Workflow' }).click();
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t = await page.evaluate(async () => {
      const btn = document.querySelector('[data-testid="run-workflow"]');
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => {
        const check = () =>
          document.querySelector('[data-testid="bar-cancel-run"]') ||
          document.querySelector('[data-testid="run-workflow"][aria-busy="true"]')
            ? r()
            : requestAnimationFrame(check);
        check();
      });
      return performance.now() - t0;
    });
    samples.push(t);
    await page.getByTestId('bar-cancel-run').click();
    await page.getByTestId('run-workflow').waitFor({ timeout: 20000 });
  }
  out.sections.actionAcknowledgementMs = stats(samples);
  console.log(
    'run click → visible pending state p95',
    out.sections.actionAcknowledgementMs.p95.toFixed(1),
    'ms',
  );
}

// --- typing while events stream (Studio composer + CTA input during a run) ---
{
  await page.evaluate(() => localStorage.setItem('3dads.latencyScale', '0.3'));
  await page.reload();
  await page.getByTestId('workspace').waitFor();
  await page.getByTestId('run-workflow').click();
  await page.getByRole('tab', { name: 'Studio' }).click();
  await page.getByTestId('viewer-canvas').waitFor();
  const res = await page.evaluate(async () => {
    const input = document.querySelector('[data-testid="cta-input"]');
    const latencies = [];
    const text = 'Typing while the run streams events';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 0; i < text.length; i++) {
      const t0 = performance.now();
      setter.call(input, text.slice(0, i + 1));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      latencies.push(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 30));
    }
    return {
      latencies,
      final: input.value,
      overlay: document.querySelector('[data-testid="ad-overlay"]')?.textContent?.includes('streams events'),
    };
  });
  out.sections.typingWhileStreaming = {
    keystrokeToPaintMs: stats(res.latencies),
    allKeysApplied: res.final === 'Typing while the run streams events',
    overlayUpdated: res.overlay,
  };
  console.log(
    'keystroke → next paint p95',
    out.sections.typingWhileStreaming.keystrokeToPaintMs.p95.toFixed(1),
    'ms; all keys applied',
    res.final === 'Typing while the run streams events',
  );
  await page
    .getByTestId('bar-cancel-run')
    .click()
    .catch(() => {});
  await page.evaluate(() => localStorage.setItem('3dads.latencyScale', '0.05'));
}

// --- 3D: orbit drag, playback frame times, idle ---
{
  await page.reload();
  await page.getByTestId('workspace').waitFor();
  await page.getByRole('tab', { name: 'Studio' }).click();
  await page.getByTestId('viewer-canvas').waitFor();
  await page.waitForFunction(() => window.__3dads.viewers.size > 0);
  const canvas = await page.getByTestId('viewer-canvas').boundingBox();
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  // orbit: 5 s of drag with frame interval sampling via rAF
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__sampling) requestAnimationFrame(tick);
    };
    window.__sampling = true;
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    await page.mouse.move(cx - 150, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy, { steps: 30 });
    await page.mouse.up();
  }
  const orbit = await page.evaluate(() => {
    window.__sampling = false;
    const f = window.__frames.slice(2);
    const v = [...window.__3dads.viewers][0];
    return { frames: f, viewer: v.frameTimeDistribution(), stats: v.getStats() };
  });
  out.sections.orbit = {
    rafIntervalMs: stats(orbit.frames),
    droppedOver33ms: orbit.frames.filter((x) => x > 33).length,
    droppedPct: (100 * orbit.frames.filter((x) => x > 33).length) / orbit.frames.length,
    renderMs: orbit.viewer,
    drawCalls: orbit.stats.drawCalls,
    triangles: orbit.stats.triangles,
    dpr: orbit.stats.dpr,
  };
  console.log(
    'orbit rAF interval p95',
    out.sections.orbit.rafIntervalMs.p95.toFixed(1),
    'ms; dropped >33ms',
    out.sections.orbit.droppedPct.toFixed(1),
    '%; render p95',
    orbit.viewer.p95.toFixed(1),
    'ms; draws',
    orbit.stats.drawCalls,
    'tris',
    orbit.stats.triangles,
  );
  // playback
  await page.getByTestId('play-toggle').click();
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    window.__sampling = true;
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(5000);
  const play = await page.evaluate(() => {
    window.__sampling = false;
    const v = [...window.__3dads.viewers][0];
    return { frames: window.__frames.slice(2), viewer: v.frameTimeDistribution() };
  });
  out.sections.playback = {
    rafIntervalMs: stats(play.frames),
    droppedPct: (100 * play.frames.filter((x) => x > 33).length) / play.frames.length,
    renderMs: play.viewer,
  };
  console.log(
    'playback rAF interval p95',
    out.sections.playback.rafIntervalMs.p95.toFixed(1),
    'ms; dropped',
    out.sections.playback.droppedPct.toFixed(1),
    '%',
  );
  await page.getByTestId('play-toggle').click();
  // idle: frames rendered must not increase
  await page.waitForTimeout(600);
  const f1 = await page.evaluate(() => [...window.__3dads.viewers][0].getStats().framesRendered);
  await page.waitForTimeout(2000);
  const f2 = await page.evaluate(() => [...window.__3dads.viewers][0].getStats());
  out.sections.idle = {
    framesBefore: f1,
    framesAfter2s: f2.framesRendered,
    idleFlag: f2.idle,
    extraFrames: f2.framesRendered - f1,
  };
  console.log('idle frames over 2 s:', f2.framesRendered - f1, 'idle flag', f2.idle);
}

// --- model switching + repeated mount/unmount → resource plateau ---
{
  const heap = async () => {
    const m = await cdp.send('Performance.getMetrics');
    const get = (n) => m.metrics.find((x) => x.name === n)?.value ?? 0;
    return { jsHeap: get('JSHeapUsedSize'), nodes: get('Nodes'), listeners: get('JSEventListeners') };
  };
  await cdp.send('Performance.enable');
  const cycles = [];
  const _ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="project-card"]')).map((e) =>
      e.getAttribute('data-project-id'),
    ),
  );
  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE}/app`);
    await page.getByTestId('project-card').first().waitFor();
    const list = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="project-card"]')).map((e) =>
        e.getAttribute('data-project-id'),
      ),
    );
    const id = list[i % Math.min(list.length, 6)];
    await page.goto(`${BASE}/app/projects/${id}?tab=studio`);
    await page.getByTestId('viewer-canvas').waitFor();
    await page.waitForFunction(
      () => window.__3dads.viewers.size > 0 && [...window.__3dads.viewers][0].getStats().framesRendered > 0,
    );
    const st = await page.evaluate(() => [...window.__3dads.viewers][0].getStats());
    await page.goto(`${BASE}/app/library`);
    await page.getByTestId('library-item').first().waitFor();
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    await page.waitForTimeout(300);
    const h = await heap();
    const viewers = await page.evaluate(() => window.__3dads.viewers.size);
    cycles.push({
      cycle: i + 1,
      fixture: st.fixtureId,
      geometries: st.geometries,
      textures: st.textures,
      liveViewers: viewers,
      ...h,
    });
    console.log(
      'cycle',
      i + 1,
      st.fixtureId,
      'heap',
      (h.jsHeap / 1048576).toFixed(1),
      'MB nodes',
      h.nodes,
      'listeners',
      h.listeners,
      'viewers',
      viewers,
    );
  }
  const first = cycles[2];
  const last = cycles.at(-1);
  out.sections.resourcePlateau = {
    cycles,
    heapGrowthPctFromCycle3: (100 * (last.jsHeap - first.jsHeap)) / first.jsHeap,
    nodesGrowth: last.nodes - first.nodes,
    listenersGrowth: last.listeners - first.listeners,
    liveViewersAtEnd: last.liveViewers,
  };
}

// --- graph pan/drag on the stress graph ---
{
  await page.evaluate(() => window.__3dads.reseed('stress'));
  await page.goto(`${BASE}/app`);
  await page.getByTestId('project-card').first().waitFor();
  const id = await page.evaluate(() =>
    document.querySelector('[data-testid="project-card"]')?.getAttribute('data-project-id'),
  );
  // stress workspace: the first seeded project (oldest) has the 60-node graph; find it via backend
  const stressId = await page.evaluate(() => {
    const ws = window.__3dads.backend.ws;
    const w = ws?.workflows.find((x) => x.nodes.length >= 50);
    return w ? w.projectId : null;
  });
  console.log('stress workflow project', stressId);
  await page.goto(`${BASE}/app/projects/${stressId || id}?tab=workflow`);
  await page.getByTestId('workflow-canvas').waitFor();
  await page.waitForTimeout(500);
  const nodeCount = await page.evaluate(() => document.querySelectorAll('.react-flow__node').length);
  const box = await page.getByTestId('workflow-canvas').boundingBox();
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    window.__sampling = true;
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 25 });
    await page.mouse.up();
  }
  const pan = await page.evaluate(() => {
    window.__sampling = false;
    return window.__frames.slice(2);
  });
  out.sections.graphPan = {
    nodesRendered: nodeCount,
    rafIntervalMs: stats(pan),
    droppedPct: (100 * pan.filter((x) => x > 33).length) / pan.length,
  };
  console.log(
    'graph pan (',
    nodeCount,
    'nodes in DOM) rAF p95',
    out.sections.graphPan.rafIntervalMs.p95.toFixed(1),
    'ms',
  );
  await page.evaluate(() => window.__3dads.reseed('typical'));
}

save('editor', out);
await browser.close();
