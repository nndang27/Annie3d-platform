# Annie 3D desktop app (Electron): how it works and how to run it

Code: `apps/desktop` (shell) and `apps/web/src/client/desktop` (desktop-only UI chunk).
Plan and research: `docs/DESKTOP_APP_PLAN.md`, `docs/DESKTOP_APP_RESEARCH.md`.

## Model

- **Shell** (Electron 44, TypeScript bundled by esbuild): windows, menus, `.annie3d` file
  association, `annie3d://` links, update logic. `contextIsolation` + `sandbox`, no Node in the
  page; the page talks to the shell only through `window.annieDesktop` (typed in
  `packages/contracts/src/desktop.ts`).
- **Web pack**: the website's own build. The shell serves it from disk on the website's origin
  (it intercepts page and asset requests; `/api`, `/s`, `/billing`, WebSockets go to the network),
  so cookies, sign-in and CSP are unchanged and the app starts offline.
- **Updates**
  - Every `pnpm build` writes `dist/client/desktop/manifest.json` (all files with sha256, size
    and features, Ed25519-signed with `ANNIE3D_PACK_KEY` from `.dev.vars`). Deploying the
    website publishes it at `/desktop/manifest.json`.
  - The app checks at start, every 30 min and on focus after 5 min; downloads only files whose
    sha256 it lacks (verified), shows **Update ready · <features> · N files, KB · Reload**; on
    Reload it switches versions and reloads. If the page does not confirm within 20 s, it rolls
    back. Unsigned or tampered manifests are refused.
  - Shell updates (new Electron / native code) use electron-updater from
    `<origin>/desktop/shell/<os>/` and show **Relaunch to update**; active only for packaged
    apps (macOS also needs signing).
- **Two lists**: `packages/contracts/src/features.ts` — `surface: shared | desktop`,
  `layer: web | shell`, with source globs. A unit test fails if a client or shell file belongs to
  no feature (or to two). `pnpm desktop:plan [origin]` shows what the next deploy changes for app
  users (files, KB, features shared vs app-only, and whether a new app build is needed).

## Commands

```bash
pnpm build                                   # website + signed desktop manifest
pnpm --filter @annie3d/desktop start          # app against production, serving the built web pack
ANNIE3D_ORIGIN=http://localhost:4173 pnpm --filter @annie3d/desktop start   # against `pnpm preview`/`pnpm share`
ANNIE3D_DEV_URL=http://localhost:5173 pnpm --filter @annie3d/desktop dev     # live dev server (hot reload, no pack)
pnpm test:desktop                            # Electron tests against a fake site
pnpm desktop:plan                            # what the next deploy changes for app users
pnpm --filter @annie3d/desktop run pack       # unpacked app for this OS (release/)
pnpm --filter @annie3d/desktop run dist:mac   # dmg + zip (universal)
pnpm --filter @annie3d/desktop run dist:win   # NSIS installer (x64) + blockmap
pnpm --filter @annie3d/desktop run dist:linux # AppImage + deb
```

Use `pnpm run pack`, not `pnpm pack` (a pnpm built-in that makes a tarball).

## Distribution status (2026-09-25)

- Built on macOS: `.app` (arm64, run and tested), Windows NSIS `.exe` + `.blockmap`, Linux
  `.AppImage` and `.deb` (built, not yet run on those systems; the `Desktop` GitHub Actions
  workflow builds and tests on all three when started manually).
- Unsigned. Without an Apple Developer ID + notarization, macOS blocks downloaded copies until
  the user allows them in System Settings → Privacy & Security, and shell auto-updates stay off on
  macOS; Windows shows a SmartScreen warning ("More info → Run anyway"). Web-pack updates work
  without signing on all systems.

## App vs Chrome responsiveness (measured 2026-09-25)

Same build, M5 MacBook, Retina 2x, 120 Hz display. Scripts: `tests/perf/desktop-vs-web.mjs`
(synthetic input, 3 runs each) and `tests/perf/live-input.mjs` (a person's real trackpad input,
40 s in each). Results in `perf-results/desktop-vs-web-*.json` and `perf-results/live-input.json`.

| Metric | Chrome 153 | Annie 3D.app (Electron 44) |
| --- | --- | --- |
| Frame rate, idle / drag / pan | 120 / 120 / 120 Hz | 120 / 120 / 120 Hz |
| Interaction duration p50 (synthetic) | 24 ms | 24 ms |
| Real pointermove: event to 2nd frame p50 / p95 | 17.3 / 19.5 ms | 17.0 / 19.7 ms |
| Real wheel: event to 2nd frame p50 / p95 | 18.5 / 26.6 ms | 18.2 / 25.9 ms |
| API call p50 (production) | ~22 ms | ~22 ms |
| Static file | 28 ms (network) | 1 ms (local pack) |
| Main process timer lateness p95 | n/a | 0.8 ms |

No measured difference in rendering, input latency or network. One verified behaviour
difference was fixed: Electron's default `acceptFirstMouse: false` swallowed the first click on an
inactive macOS window (Chrome passes it through); the window now sets `acceptFirstMouse: true`.
A first synthetic run showed the app slower only because Playwright had emulated a 1x pixel ratio
for Chrome; compare both at the display's own ratio.

## First-use GPU stalls (measured 2026-09-25)

Symptom reported: zooming or moving the pointer "stalls once, then continues". Reproduced with
`tests/perf/hitch.mjs` (pinch-zoom bursts and pointer sweeps; frame gaps, Long Animation Frames,
GPU status). The stalled frames have an idle main thread (no script, style or layout): the time is
spent in the GPU process compiling Metal pipelines for Skia Graphite on first use.

| Case | Zoom stalls (worst) | Pointer-sweep stalls (worst) |
| --- | --- | --- |
| App, cold shader cache | 9–11 (217–250 ms) | 4–5 (150–192 ms) |
| App, warm cache (same location, even after a rebuild) | 0 | 0 |
| App copied to a new folder (cache is per location) | 10 (167 ms) | 4 (166 ms) |
| Chrome 153 (for Testing), cold cache | 6 (92 ms) | 0 |
| App, cold, hidden warm-up window first (7.2 s) | 1 (92–100 ms) | 2 (133–198 ms) |

- The macOS shader cache lives in `$(getconf DARWIN_USER_CACHE_DIR)/app.annie3d.desktop.helper`.
  Cold means the first sessions after installing or moving the app (and after Electron, macOS or
  GPU driver updates). The user's Chrome never shows it because its cache is warm.
- Rejected: `--disable-features=SkiaGraphite` removed the stalls only because Electron 44 then
  fell back to software compositing with WebGL disabled (interaction p50 24 → 40 ms, editor
  broken). `--enable-skia-graphite-precompilation` changed nothing.
- Open decision: a hidden warm-up window on first launch cuts most stalls but not all, and costs
  ~7 s of background GPU work. Not shipped.

Root cause, traced (`tests/perf/gpu-trace.mjs`): the stalled time is inside
`skgpu::graphite::CommandBuffer::addRenderPass` on the GPU main thread (`CrGpuMain`), below any
traced event, where Dawn/Metal realise pipelines on first use. That thread also composites the
displayed frame (Direct Rendering Display Compositor is off in Chrome and Electron alike), so a
compile there delays the frame. A cold Chrome for Testing trace shows the same slow render passes on
the same thread; the mechanism is Chromium's, not the app's.

Ruled out:
- Engine upgrade: Electron 45.0.0-alpha.11 (Chromium 155) stalls like Electron 44 (Chromium 152),
  9–10 zoom stalls up to 217 ms, two cold runs each.
- Page effects: removing every box-shadow, filter and text-shadow still left cold stalls.
- "Cache is per app location" (above) is only partly true: a fresh copy in a new folder stalled
  anywhere from 3 to 10 times. Single cold runs are noisy; compare several.
