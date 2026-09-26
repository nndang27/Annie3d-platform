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
  - The app checks at start, every 60 s (`ANNIE3D_POLL_MS`) and on focus (at most every 30 s),
    downloads only files whose sha256 it lacks (verified) in the background, then shows only
    **Update available · Restart to update** (the download itself is silent).
  - **Restart to update** (as the Claude and Codex apps do): the new version is staged, the app
    quits and starts again into it, with no "what's new" message. If the new version does not
    confirm within 20 s (`ANNIE3D_CONFIRM_MS`), the next start rolls back. Unsigned or
    tampered manifests are refused. `ANNIE3D_RELAUNCH=0` quits without relaunching (tests).
  - Without the click, a downloaded update starts with the next launch (shell 0.3.2, as Chrome
    and VS Code do). On macOS, where the app keeps running with no window, it also starts with
    the next window once every window was closed. Opening the app or a board file therefore never
    shows the old version followed by the pill. Before 0.3.2 only the click switched versions:
    every launch, including a double-clicked `.annie3d`, started the last version that had been
    restarted into. The installed app ran pack 383dd7f while d652a66 and six older packs sat
    downloaded. The same 20 s confirmation applies. A version that rolled back is not started
    again on its own (`failed` in `current.json`).
  - A manifest with a newer stamp but the same files is not an update: the app's own bundle and
    the deploy build the same commit twice (0 of 46 files differ). The app adopts the newer
    stamp without a download or a pill. Before, a freshly installed app showed "Update
    available" for nothing.
  - Live test on the installed app (2026-09-25, 0.2.0, pack 033d523 → 6bfb30b): CI finished
    12:37:20Z, the pill appeared at 12:37:32 without any user action; after the click the old
    process was gone in 0.3 s, the new one was up in 0.3 s and the board was on screen at 0.8 s
    with web version `2026.9.25-123658+6bfb30b` and the neumorphic nodes. (That build still
    showed release notes and an "Updated" pill; both were removed afterwards at the user's request.)
  - Shell updates (new Electron / native code) use electron-updater from
    `<origin>/desktop/shell/<os>/` and show the same **Update available · Restart to update**; active only for packaged
    apps (macOS also needs signing).
- **Board files are documents** (shell 0.3.0): each `.annie3d` file opens in its own window,
  streams its assets from disk, and Save writes it back; a run uploads a hidden working copy that
  expires 7 days after its last run. Format, limits and the zip-bomb guard: `docs/BOARD_FILES.md`.
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
- ~~Page effects: removing every box-shadow, filter and text-shadow still left cold stalls.~~
  Wrong: that single Electron run was partly warm. The deterministic Chrome rig below shows the
  page's own effects caused most stalls.
- "Cache is per app location" (above) is only partly true: a fresh copy in a new folder stalled
  anywhere from 3 to 10 times. Single cold runs are noisy; compare several.

## Fix: board paint without blur (2026-09-25)

Rig: `tests/perf/cold-compare.mjs` (Chrome for Testing, its own Metal cache moved aside; the
count repeats exactly run to run) and `tests/perf/pipeline-trace.mjs` (lists every Graphite
pipeline compiled during a zoom, with its label and compile time).

Same cold zoom, production build (before the fix), 3 rounds each:

| App | Zoom stalls |
| --- | --- |
| Excalidraw (one canvas) | 1 (67 ms) |
| tldraw (DOM/SVG, like ours) | 1 (108–125 ms) |
| Annie 3D | 6 (≤117 ms); new build 7–8 (≤258 ms) and a hover stall |

Bisecting with `INJECT_CSS`: hiding images changed nothing; removing blurred `box-shadow` alone
went 6 → 1. The pipeline trace named the rest: `$1DBlur12`/`$2DBlur28` (blurred shadows),
`RadialGradient4` (sim thumbnails, up to 158 ms), plus generic ones every image-and-icon page hits
(`TessellateStrokes`, `HWYUVImage`, `AnalyticClip`).

Change: rules that paint on the board use borders, spread-only rings, 1–2 px hard offsets and
flat fills; blurred shadows stay in the fixed UI. The wire spark's glow is a wide faint stroke and
its head has flat halo circles (the old CSS `blur`/`drop-shadow` also re-filtered every frame).
`apps/web/src/client/boardPaint.test.ts` fails if a blurred shadow, blur filter or gradient
returns to board content; it flags all 15 rules the old CSS had.

| Cold shader cache | Before | After |
| --- | --- | --- |
| Chrome, zoom | 7–8 stalls, ≤258 ms | 4 stalls, ≤110 ms |
| Chrome, pointer sweep | 1 (92 ms) | 0 |
| Desktop app, zoom (truly cold, 2 runs) | 9–11, ≤250 ms | 2–3, ≤258 ms |
| Desktop app, pointer sweep | 4–5, ≤225 ms | 1, ≤117 ms |

Warm (every later session): 200-node board pans and zooms at 116–120 fps, also with 4× CPU
throttling (`tests/perf/canvas.mjs 200 --gpu [--zoom=1]`); hovering a wire keeps 120 fps
(p95 9.2 ms, no long animation frames).

Not adopted: `--enable-skia-graphite-precompilation` (6 → 3 before the fix, no change after);
self-rounded preview images (moved one stall from zoom to hover).

Open: Chrome 153 creates pipelines through Dawn's async path (`CreatePipelineAsyncEvent` on a
worker); the Electron trace shows no Dawn events, and its remaining stalls sit inside
`addRenderPass` on the GPU main thread. Which switch or build difference causes this is not
established. Sources: Chromium Graphite blog (fewer pipelines "so they can be compiled at
startup"), https://blog.chromium.org/2025/07/introducing-skia-graphite-chromes.html; Electron
shader-cache persistence fix (in 44.4.4+), https://github.com/electron/electron/pull/54113;
crbug 40281459 "[Graphite] Cache Metal shader pipelines".

## Tried and not shipped: reuse rastered pixels while zooming (2026-09-25)

Idea (Excalidraw reuses cached element bitmaps while zooming and redraws sharp ~300 ms after
it stops): in a DOM board the same thing is `will-change: transform` on `.react-flow__viewport`
during a zoom, removed at the settle so Chromium re-rasters once at the new scale.

Measured on one build (`tests/perf/cold-compare.mjs` 3 rounds, `tests/perf/zoom-raster.mjs`,
sharpness by pixel-comparing Electron `capturePage()` crops with the plain board; Playwright
screenshots force a repaint and cannot show blur):

| Variant | Cold zoom stalls | Warm GPU raster during a zoom | Text after stopping |
| --- | --- | --- | --- |
| Plain (shipped) | 4–5 | 46 ms | sharp |
| will-change toggled per gesture | 4 | 31–37 ms | identical to plain from 100 ms |
| always a layer (`will-change: opacity`), transform hint while zooming | 3–5 | similar | identical from 100 ms |
| will-change: transform permanently | 0 | 24–28 ms | stays soft (≈1,000 edge pixels off by >32 levels) |

The sharp re-raster at the new scale is what compiles the new GPU pipelines, so reusing pixels
during the gesture only moves the stall to the settle. Only never re-rastering removes it, and
that leaves text blurry. Warm zooming already has no long frames, so the 30–45 % raster saving
buys nothing visible. Not shipped; revisit if a heavy board shows raster-bound zoom frames.

## Fix: no rounded clip over node content (2026-09-25)

`tests/perf/pipeline-trace.mjs` (now with a pointer sweep and `INJECT_CSS` bisecting) named the
remaining cold compiles. Hiding groups of elements showed:

- `Image … AnalyticClip` (116 ms) and `MiddleOutFan/TessellateCurves [EvenOdd]` (61 ms): the
  card's `overflow: hidden` + `border-radius` clip over images, drawn as a stencil path when
  zoomed. Fixed: the card no longer clips; `.node-preview` rounds its own top corners (all four
  on input nodes) and its image, video and packshot-grid corners round themselves. Pixel diff of
  all 13 example nodes at 4× density: max 7 levels (anti-aliasing), one sub-pixel edge on a Run
  button.
- `HWYUVImage` (113 ms) and `… DstIn` (70 ms): the hovered node's `<video>` (decoded video
  frames, rounded corners). Inherent to showing video; compiled once, on first playback.
- `TessellateStrokes … AnalyticClip` (58 ms): stroked SVG icons in nodes at large zoom; the
  clip is not a rounded one (none left). Left as is.

| Cold shader cache | Start of the day | After blur fix | Now |
| --- | --- | --- | --- |
| Chrome, zoom | 7–8 stalls, ≤258 ms | 4, ≤110 ms | 3, ≤92 ms (3 rounds) |
| Desktop app, zoom | 9–11, ≤250 ms | 2–3, ≤258 ms | 2, ≤100 ms (2 truly cold runs) |
| Desktop app, pointer sweep | 4–5, ≤225 ms | 1, ≤117 ms | 1, ≤92 ms |

For reference, the same rig gives tldraw 1 stall (≤125 ms) and Excalidraw 1 (67 ms).
E2E canvas, simulation and responsive: 72/72 across Chromium, WebKit and Firefox.
