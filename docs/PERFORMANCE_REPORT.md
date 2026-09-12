# Performance report

Lab measurements on the **production build** (`pnpm build`) served by `scripts/preview-server.mjs` (brotli/gzip for text assets, immutable caching for hashed files). Raw data: `perf-results/public-vitals.json`, `perf-results/editor-gpu.json`, `perf-results/editor-swiftshader.json`, `perf-results/bundle-report.json`; scripts in `tests/perf/`. These are **lab results, not field p75**; the Core Web Vitals field targets remain targets.

## Conditions

| Item | Value |
| --- | --- |
| Build | working tree of 2026-09-12 (Vite 8.3 / rolldown, Astro 7.3), `git rev-parse --short HEAD` recorded in each JSON |
| Machine | Apple M5 MacBook Pro, 24 GB, macOS 25.6 |
| Browser | Chromium 153.0.8010.12 (Playwright 1.63) |
| Renderer (headless) | ANGLE Vulkan **SwiftShader** — software GL |
| Renderer (headed, `GPU=real`) | ANGLE Metal, Apple M5 |
| Viewport / DPR | 1440×900 @2 |
| Profiles | `reference` (no throttle), `throttled-4x-fast3g` (CPU ×4, 1.6 Mb/s ↓, 150 ms RTT via CDP) |
| Samples | 3 cold + 3 warm page loads per page/profile; 5 s orbit and 5 s playback windows; 10 mount/unmount cycles |
| Mock latency | `latencyScale 0.05` (calls 6–13 ms) except where noted; simulated backend time is excluded from the frontend numbers |

## Bundles (compressed, from `bundle-report.json`)

| Route / chunk | gzip | brotli | Budget | Status |
| --- | --- | --- | --- | --- |
| Marketing `/` initial JS (page + HomeDemo island script) | 2.5 KB | 2.1 KB | ≤ 25 KB | pass |
| Marketing CSS (all pages) | 5.6 KB | — | ≤ 30 KB | pass |
| Marketing on-intent 3D (`viewer-3d`, loaded only after "Rotate the model") | 146.8 KB | 120.0 KB | not initial | pass (loaded on click only; verified by E2E) |
| App shell (index 8.3 + react 67.0 + tanstack 33.9 + services 17 + small route chunks ≈ 130 KB gzip) | ≈ 130 KB | ≈ 113 KB | ≤ 140 KB | pass |
| Dashboard route chunk | 3.9 KB | 3.4 KB | ≤ 40 KB | pass |
| Workflow editor chunk incl. React Flow (`WorkflowTab`) | 69.7 KB | 60.0 KB | ≤ 160 KB | pass; loaded only on the Workflow tab |
| Viewer chunk incl. Three.js (`viewer-3d`) | 146.7 KB | 120.0 KB | ≤ 220 KB | pass; loaded only when the Studio opens |
| Hero LCP image (`hero.webp`, 1400×1050 source, responsive `srcset`) | 13.6 KB transfer at 1440 px | — | ≤ 120 KB | pass |
| Fonts | Inter variable, latin subset only on first paint (48.6 KB woff2), `font-display: swap` | — | ≤ 2 files | pass |

Fixed during measurement: an earlier build placed React core inside the React Flow chunk (pnpm nested-path matching), which made every route load 53 KB of React Flow; matching React before library paths and letting React Flow stay in the lazily loaded editor chunk removed it.

## Public site (Astro)

| Page | Profile | LCP p50 (cold) | CLS max | JS transfer | LCP element |
| --- | --- | --- | --- | --- | --- |
| `/` | reference | 876 ms | 0.000 | 3 KB | hero `<img>` (webp) |
| `/pricing` | reference | 644 ms | 0.000 | 1 KB | text |
| `/templates` | reference | 1256 ms | 0.000 | 1 KB | template poster |
| `/templates/turntable-hero-skincare` | reference | 544 ms | 0.002 | 1 KB | poster |
| `/help/quickstart` | reference | 788 ms | 0.003 | 1 KB | text |
| `/` | throttled 4×/Fast 3G | 1320 ms | 0.000 | 3 KB | hero |
| `/pricing` | throttled | 1092 ms | 0.000 | 1 KB |  |
| `/templates` | throttled | 1908 ms | 0.000 | 1 KB |  |
| `/templates/…skincare` | throttled | 1240 ms | 0.002 | 1 KB |  |
| `/help/quickstart` | throttled | 1228 ms | 0.003 | 1 KB |  |

All public pages are under the 2.5 s LCP and 0.1 CLS budgets in both profiles. No Three.js, React Flow or app code is requested on public pages before intent (asserted by `public.spec.ts`).

## App shell and navigation

| Metric | reference | throttled 4×/Fast 3G | Budget |
| --- | --- | --- | --- |
| `/app/signin` cold LCP p50 | 708 ms | 2008 ms (above the 1.5 s reference budget on Fast 3G; see gaps) | ≤ 1.5 s useful paint (reference) |
| `/app/signin` JS transfer (brotli) | 135 KB | 135 KB | ≤ 140 KB |
| Sign-in click → dashboard cards rendered (includes mock latency) | 849 ms | 818 ms | — |
| Warm tab navigation (Overview/Workflow/Outputs/Studio), p50 | 28 ms (GPU) / 34 ms (SwiftShader) | — | ≤ 300 ms |
| Action acknowledgement: Run click → visible pending state, p95 | 6.0 ms (GPU) / 2.3 ms (SwiftShader) | — | ≤ 100 ms |
| Typing while a run streams events: keystroke → next paint, p95 | 12.0 ms (GPU) / 29.7 ms (SwiftShader); all 35 keystrokes applied and mirrored to the ad overlay | — | ≤ 50 ms, no dropped keys |

The static HTML shell in `index.html` (header with the Demo workspace chip) paints before the JS bundle; React replaces it after services initialise (`app:bootstrap` User Timing measure).

## 3D viewport (Studio, serum-bottle fixture: 3 250 triangles, 5 draw calls, DPR 2 on a 640×640 stage)

| Metric | Real GPU (Apple M5, headed) | SwiftShader (headless) | Budget |
| --- | --- | --- | --- |
| Cold editor entry: Studio tab click → first useful 3D frame, p50 | 816 ms | 1858 ms | ≤ 1.2 s after chunk arrival (GPU) |
| Orbit drag 5 s: rAF interval p50 / p95 | 8.3 / 16.7 ms | 8.3 / 1516 ms | p95 ≤ 20 ms |
| Orbit dropped frames (> 33 ms) | 0.0 % (545 frames) | 81 % | ≤ 2 % |
| Turntable playback 5 s: rAF interval p95 | 9.2 ms | 83 ms | p95 ≤ 20 ms |
| Playback dropped frames | 0.2 % (587 frames) | 97 % | ≤ 2 % |
| Idle (paused, no interaction) frames over 2 s | 0 (idle flag true) | 0 | 0 |
| Adaptive DPR | stays at 2 on GPU; drops to 1.25 during interaction on SwiftShader and restores after settle | | |

Only the headed run on the real Apple M5 GPU meets the 60 fps budget; the SwiftShader numbers are software rendering and are reported for transparency, not as device evidence. No other hardware (Windows/Intel/mobile GPU) was available; those tiers are **unverified**.

## Resource lifetime (10 project switches with Studio open, then leave to the Library)

| Cycle | Fixture | JS heap | DOM nodes | Listeners | Live viewers |
| --- | --- | --- | --- | --- | --- |
| 1 | serum-bottle | 5.4 MB | 518 | 215 | 0 |
| 3 | smart-speaker | 4.4 MB | 518 | 215 | 0 |
| 10 | serum-bottle | 4.4 MB | 523 | 215 | 0 |

Heap growth from cycle 3 to 10: −0.3 % (GPU run) / +1 % (SwiftShader). Listener count constant; the viewer registry is empty after every leave (geometry, materials, render targets, controls, observers disposed by `ProductViewer.dispose()`). Budget (≤ 15 % growth): pass.

## Workflow graph

Stress dataset (400 projects; first project's workflow has 60 nodes): graph pan p95 rAF interval 9.1 ms (GPU) / 33 ms (SwiftShader). With `onlyRenderVisibleElements` active above 30 nodes, only the 5 nodes in the viewport are mounted during the pan; progress ticks patch a single node through a per-node zustand selector, and typing in the composer does not re-render the graph (verified by the typing-while-streaming measurement above).

## Mock-latency separation

`transport.ts` adds representative latency (normal 120–260 ms per call, steps 0.7–1.6 s) that is scaled by `latencyScale`; measurements above use 0.05 so the numbers reflect frontend cost, except "sign-in → dashboard" which includes two mock round trips and is reported as such.

## Remaining gaps

- Field data (real users, real p75) does not exist for a demonstration; the values here are single-machine lab runs.
- Real-device 60 fps is verified only on the Apple M5; mobile GPUs and integrated Windows GPUs are unverified.
- Throttled app-shell LCP is above the reference budget on Fast 3G (see table); the shell is already split (React + router/query + services) and compressed; further reduction would need dropping TanStack Query or React Flow-free settings routes, which was not done to keep the architecture.
- WebM export timing and MediaRecorder throughput were not measured.
