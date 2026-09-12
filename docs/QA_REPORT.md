# QA report

Build identity: the platform is its own git repository (`https://github.com/nndang27/Annie3d-platform.git`, branch `main`); `perf-results/*.json` carry `identity.commit`. Environment: macOS (Darwin 25.6, Apple M5, 24 GB), Node 25.5.0, pnpm 10.28.2, Playwright 1.63 with bundled Chromium 146, WebKit (Playwright's Safari-equivalent build) and Firefox (all headless, SwiftShader/software GL). All browser checks run against the **production build** served by `scripts/preview-server.mjs` on one origin (`/` marketing, `/app/` app).

## Commands

```bash
pnpm typecheck     # tsc (contracts, ui, viewer-3d, web) + astro check
pnpm lint          # biome check
pnpm test          # vitest
pnpm build         # fixture report + astro build + vite build
pnpm preview       # http://localhost:4173
pnpm test:e2e      # playwright: desktop (journeys, controls, public, screenshots), a11y, mobile,
                   #   viewports-{chromium,webkit,firefox}, journeys-{webkit,firefox}
pnpm perf          # tests/perf/*.mjs → perf-results/*.json
pnpm bundle:report # perf-results/bundle-report.json
```

## Results (final run, 2026-09-12)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | 0 errors in contracts, ui, viewer-3d, web; `astro check` 0 errors (20 files) |
| `pnpm lint` (biome, 141 files) | 0 errors; remaining diagnostics are `useExhaustiveDependencies` warnings on intentional canvas callbacks |
| `pnpm test` (vitest) | 21/21 passed: state machine, returnTo validation, graph rules, backend idempotency, cancellation/late ticks, retry reuse, waiting-input, event replay/gaps, pinned selection, persisted-scheduler recovery, billing reconciliation (repeat callbacks, delayed, declined), credit limits, optimistic revisions, duplicate/delete, upload rejection |
| `pnpm test:e2e` full matrix, run 10 (`perf-results/e2e-run10.log`, 2026-09-13, final build) | **134/135 passed** in 4.9 min: Chromium desktop 41/41 (9 journeys J1–J9c, 9 control-matrix specs, 6 public-site specs, screenshots, 9 axe scans + app-screen axe + focus/dialog, mobile), viewport matrix 42/42 (7 viewports × Chromium/WebKit/Firefox), WebKit journeys + public 19/19, Firefox journeys + public 18/19. The one failure was J5 on Firefox: `page.reload: NS_BINDING_ABORTED` on the test's own reload right after the fixture's reload, before any app interaction (J5 had passed on Firefox in the two previous runs, `crossbrowser2.log`, `crossbrowser3.log`). See the Firefox navigation row in the matrix section; the fixture now retries an aborted reload once and logs it. |
| Firefox re-run after that change (`perf-results/crossbrowser4-firefox.log`) | **19/19 passed** in 49 s; the fixture logged exactly one retried navigation (`page.goto /app/settings/billing` after `<unknown error>`), no console/page errors. |
| Console/page/resource errors | 0 unexpected across all E2E specs (fixture asserts `errors` is empty per test) |
| Broken links | 0 (homepage internal-link sweep, 404 status for unknown routes, `/api/*` and missing assets return 404, never the SPA shell) |

Earlier runs and what they found (all fixed): run 1 — 23 failures from live backend objects in the query cache (no re-render after in-place mutation; fixed by serialising results at the mock "wire"), hidden dialogs matching selectors, missing `[hidden]` override, persistence race on navigation; run 2–5 — Flows canvas re-work regressions (unstable zustand selector loop, portal stacking, duplicate palette ids), a mount effect that re-created the 3D viewer on every scene edit (dependency array altered by an unsafe auto-fix), pending `deleteDatabase` wiping newer state, sign-out redirect remounting the sign-in page and swallowing the next click, mobile overflow (timeline, breadcrumb), disabled-button contrast.

## Cross-browser and viewport matrix (2026-09-13)

Asked by the founder: does the UI hold up in Safari and Chrome, from laptop to iPad to phone, portrait and landscape?

**Engines.** Chromium 146, WebKit and Firefox as shipped with Playwright 1.63. WebKit here is the same engine as Safari but not Safari on a device: no real iPhone/iPad hardware was used, so device-only behaviour (Safari toolbar collapsing, iOS autoplay policy, MediaRecorder container) is **not** verified.

**Viewports** (`tests/e2e/viewports.spec.ts`, run on all three engines): phone portrait 390×844, phone landscape 844×390, small phone 320×568, tablet portrait 768×1024, tablet landscape 1024×768, laptop 1280×800, wide 1600×1000. For every viewport the spec loads six public pages (home, product, templates, template detail, pricing, help article) and eight app screens (dashboard, Overview / Workflow / Studio / Outputs tabs, composer, billing, new project) and asserts: no horizontal document overflow (≤ 1 px), no element whose box extends past the viewport, and the primary control (`choose-studio`, `run-workflow` / cancel) inside the viewport. Result: **42/42 passed** (14 specs × 3 engines) after the fixes below.

**Journeys and public-site specs on WebKit and Firefox** (`journeys-webkit`, `journeys-firefox`): J1–J9c plus the six public-site specs, **38/38 passed** on the final build (`perf-results/crossbrowser3.log`). Chromium remains the reference project (`perf-results/e2e-run10.log`, see the results table).

What the matrix found and what changed:

| Found | Engine / viewport | Fix |
| --- | --- | --- |
| Uploading a product photo failed: "Error preparing Blob/File data to be stored in object store" | WebKit | IndexedDB now stores `{ type, buffer }` instead of the `File` object (`services/mock/store.ts`); `getBlob` rebuilds a `Blob`. |
| Downloads (PNG/JSON/MP4/WebM exports) never surfaced to the test driver | WebKit (Playwright issue #21892: no download event for `blob:` anchors) | App-side `downloadBlob` keeps a log of started downloads exposed on `window.__3dads.downloads()`; the test helper `captureDownload` reads the bytes there on WebKit and uses the real download event elsewhere. The product code path is identical. |
| Pricing toggle: arrow keys did nothing after a mouse click | WebKit | Safari does not focus buttons on click; the segmented control now focuses the clicked option so keyboard navigation continues from it. |
| Keyboard journey: Tab never reached the identity buttons | WebKit | Safari default: Tab visits text fields only, Option+Tab visits all controls. The test helper uses `Alt+Tab` on WebKit; markup unchanged. |
| `window.__3dads` read before boot finished on a fresh navigation | WebKit | Test waits for the app to boot (`waitForApp`). |
| Billing page: heading badge, plan cards and invoice rows wider than the viewport | 390×844 and 320×568, all engines | Settings layout stacks under 700 px (section nav becomes a horizontal strip); badges may wrap under 480 px; invoice rows wrap. |
| Workspace bar / tab strip wider than 320 px | 320×568, all engines | Grid children get `min-width: 0`; tab strip capped at 100 %. |
| A navigation issued by the test right after a reload aborted with `NS_ERROR_FAILURE`, `NS_BINDING_ABORTED` or `<unknown error>` | Firefox only; 4 occurrences in 5 Firefox runs (~19 specs each), never twice in the same spec, never on Chromium/WebKit | Test fixture retries that `goto`/`reload` once and prints a warning each time it happens (`[fixtures] … retried once`), so every use is visible in the log. No console, page or network errors accompany it; the app itself does not navigate at boot on those pages. Not treated as an app defect; a root cause in Playwright-Firefox navigation timing has not been established. |
| Project-card count read before the dashboard rendered | Firefox | Test waits for the first card. |

## Screenshot inspection

`test-results/screenshots/`: home/pricing/templates at 390, 768, 1280, 1440; dashboard populated + empty + mobile; workflow canvas idle + running; studio; outputs; billing; checkout; offline banner. Reviewed by the implementer for hierarchy, overflow and state legibility; see `docs/PERFORMANCE_REPORT.md` for the visual notes that led to changes (initial canvas zoom, composer footprint, header on 390 px).

## Manual keyboard/focus checks (performed in the production preview)

- Tab order on sign-in: skip link → logo → identities → email → continue → links; visible 2 px focus ring (`:focus-visible`).
- Dashboard card menu: Enter opens, arrow keys move, Escape closes and restores focus; rename dialog autofocuses its input, Escape closes, focus returns.
- Workflow canvas: N opens the palette with search focus, ↑↓↩ add a node, Esc closes; ⌘K quick actions; V/H/C modes; ⌘Z/⇧⌘Z undo/redo; list view connects inputs with native selects (no drag required).
- Studio: Space toggles playback (not when typing), ⌘Z undo; timeline slider is a native range with `aria-valuetext`.
- Reduced motion (`prefers-reduced-motion: reduce`): camera tweens are instant, canvas dot grid removed, shimmer/pulse animations off (J9b runs with reduced motion emulated).

## Known limitations

- WebM recording depends on `MediaRecorder`; verified in Chromium and in Playwright's WebKit build (J6b produced a WebM with an EBML header there). On real Safari the container may be MP4 and the preset label would need to follow; not verified on a device.
- Cross-browser coverage is engine-level (Chromium, WebKit, Firefox on macOS). No iPhone/iPad hardware, no Safari-on-iOS gestures, no Android Chrome device were used.
- Axe scans exclude the React Flow canvas internals (`.react-flow`); the node cards themselves are scanned via the list view and node markup uses labelled controls.
- The a11y suite is automated + implementer keyboard checks; it is not a full WCAG 2.2 AA audit with assistive technology.
