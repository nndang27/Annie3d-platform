# Performance standards and how we measure them

## Standards we hold the product to

| What | Good | Poor | Source |
| --- | --- | --- | --- |
| Largest Contentful Paint (main content visible) | ≤ 2.5 s | > 4 s | web.dev, Core Web Vitals, 75th percentile of page loads |
| Interaction to Next Paint (input → next frame) | ≤ 200 ms | > 500 ms | web.dev, Core Web Vitals |
| Cumulative Layout Shift | ≤ 0.1 | > 0.25 | web.dev, Core Web Vitals |
| First Contentful Paint | ≤ 1.8 s | > 3 s | web.dev (FCP) |
| Time to First Byte | ≤ 0.8 s | > 1.8 s | web.dev (TTFB) |
| Reaction to input | < 100 ms (process input in < 50 ms) | | RAIL model |
| Animation frame | ≤ 10 ms of work (16 ms budget at 60 fps) | | RAIL model |
| First load to interactive | ≤ 5 s on a mid-range phone on slow 3G; ≤ 2 s for later loads | | RAIL model |
| Feels instant / keeps flow / keeps attention | 0.1 s / 1 s / 10 s | | Nielsen Norman Group, response-time limits |

Why it matters: Google's mobile research found that 53 % of mobile visits are abandoned when a
page takes longer than 3 s, and that bounce probability rises 32 % as load time goes from 1 s
to 3 s.

Sources:
- https://web.dev/articles/vitals
- https://web.dev/articles/defining-core-web-vitals-thresholds
- https://web.dev/articles/ttfb
- https://web.dev/articles/fcp
- https://web.dev/articles/rail
- https://www.nngroup.com/articles/response-times-3-important-limits/
- https://www.marketingdive.com/news/google-53-of-mobile-users-abandon-sites-that-take-over-3-seconds-to-load/426070/

## Feature budgets (Performance panel)

Defined in `apps/web/src/client/lib/perf.ts` (`FEATURE_BUDGETS`). Instant actions (paste,
duplicate, undo) use the 0.1 s limit; opening a view (3D editor, simulator) and first agent words
use the 1 s flow limit; server work that shows progress (runs, exports) is judged against its
own budget.

## How to measure

| Tool | What it measures | How |
| --- | --- | --- |
| Performance panel | This browser: TTFB, FCP, LCP, CLS, INP, "board ready", request count and size, every feature timing (last, p95, count), slowest API calls and files with worker time (`Server-Timing`) | Gauge button in the top bar, ⌥P, or `?perf` in the URL; "Copy report" gives JSON |
| Real-user beacons | The same numbers from every visitor, with country and Cloudflare colo | `POST /api/rum` on tab hide → Workers Logs (`event: "rum"`) |
| `pnpm measure <url>` | Cold and warm loads of any URL (local, `pnpm share` link, production) in headless Chromium | e.g. `pnpm measure https://annie3d.nndang2701.workers.dev --runs 3` |
| Lighthouse | Lab score on the production build | Chrome DevTools MCP (see CLAUDE.md) |

## Measured 2026-09-24 (from Sydney)

| URL | Board ready (cold) | Images ready (cold) | TTFB | Warm load |
| --- | --- | --- | --- | --- |
| Local preview `localhost:4173` | 0.11 s | 0.15 s | 8 ms | — |
| `pnpm share` quick tunnel | 3.3 s | 4.2 s | 1.7 s | ~0.6 s |
| Production (Cloudflare edge) | 0.27–0.93 s | 0.29–0.94 s | 62–87 ms | 0.14–0.17 s |

The quick tunnel is the slow part: every request goes visitor → Cloudflare edge → one tunnel
connection → this laptop, nothing is cached at the edge (`cf-cache-status: DYNAMIC`), and ~25
parallel image requests queue behind each other (≈ 1.1 s each). Visitors far from the laptop add
their own latency on top. Cloudflare documents quick tunnels as a testing tool. For links that
must feel like the product, use a Cloudflare preview deployment (edge speed, not production
traffic).

## Opening the 3D editor and the simulator (measured 2026-09-25)

`tests/perf/features.mjs` opens each overlay twice as a first-time visitor (a person's pointer
rests 300 ms on the node before clicking) and reads the app's own Performance panel, Event
Timing and Long Animation Frames. `--net` emulates 10 Mbps / 40 ms; `--cold` empties the GPU
shader cache.

| Local, warm GPU cache | Before | After |
| --- | --- | --- |
| Open 3D editor, first / second | 375 / 60 ms | 66–90 / 66 ms |
| Open simulator, first / second | 365 / 52 ms | 74–78 / 63 ms |
| Open 3D editor first, 10 Mbps link | 455 ms | 66 ms |
| INP (whole session) | 136–152 ms | 56–64 ms |

What the time was, and the fix for each:

1. **React Suspense throttle (~300 ms).** `React.lazy` suspends on its first render even when the
   module has already loaded, and React holds the fallback for FALLBACK_THROTTLE_MS. Timeline
   marks showed click → editor constructor 322 ms on the first open, 20 ms later. Fix
   (`lib/preload.ts`, the react-lazy-with-preload pattern): once the chunk is in, the overlay
   renders the component directly; the choice is fixed at mount so it never remounts.
2. **Download of three.js (~700 KB) on a real link.** Fix: prefetch on intent (hovering a 3D
   result or a simulation node, as Remix `prefetch="intent"`) plus an idle prefetch of the
   editor after the board is ready when it has a model to open (skipped with Save-Data). No long
   frames appear during page load or the idle prefetch.
3. **WebGL context and environment map inside the click (~50 ms).** Effects run before paint
   after a discrete event. Fix (`lib/afterNextPaint.ts`): the overlay paints first, the WebGL
   editor/viewer is built right after; the model load waits for it.

Tried and not kept: `WebGLRenderer.compileAsync` before the first frame. On ANGLE/Metal the
render pipeline state is still created at the first draw, so the cold first-render freeze only
fell 202 → 130 ms for the editor, did not change for the simulator, and every warm open got
15–20 ms slower (three.js polls completion every 10 ms).

### Baked room lighting (2026-09-25)

Both viewers built their image-based lighting on every open with
`PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`: render the room to a cube map, blur it in
several passes, each with its own shader. `scripts/bake-room-env.mjs` now runs that same call once
with the project's three.js and stores the 768×1024 CubeUV result as RGB9E5 texels (WebGL2
RGB9_E5, sampled directly, no decoding) gzip-compressed: `packages/viewer-3d/assets/room-env.bin`,
650 KB, fetched with the editor chunk (hover or idle) and unpacked once per page with the
browser's DecompressionStream. If the file cannot load, the viewer bakes at runtime as before.

Choices, measured on real models (serum bottle, headphones, gold ring with a diamond):

| Encoding | Size | Render vs runtime bake |
| --- | --- | --- |
| half float RGB, size 256, gzip | 899 KB | exact |
| half float, byte planes, gzip | 1091 KB | exact (worse compression) |
| half float RGB, size 128, gzip | 266 KB | ring max 61 levels: softer jewellery reflections, rejected |
| **RGB9E5, size 256, gzip** | **650 KB** | **mean 0.002, max 2 levels** |

In the editor: mean difference 0.015 levels, 28 of 3.3 M pixels above 4 levels.

| | Before | After |
| --- | --- | --- |
| Cold first editor open: environment bake | ~350 ms frozen | none |
| Warm open, editor / simulator | 58–66 / 63–78 ms | 35–47 / 41–65 ms |

Cold GPU cache (first use on a machine) still costs one-off compiles when the editor or the
simulator first draws (editor ~210 ms first frame; simulator ~250 ms, its canvas has an alpha
channel and so needs its own pipelines): Metal pipeline compiles inside Chromium, the same class
as the board's first-zoom stalls (docs/DESKTOP.md).

## Nodes blinked on every selection (fixed 2026-09-25)

React Flow runs controlled here (nodes come from the board store). `onNodesChange` applied only
position and selection changes, so node objects never carried `measured`; every new object (each
selection, each record update such as a run writing outputs) counted as unmeasured and React Flow
set `visibility: hidden` on it until it had measured it again (~10 ms, one frame). A
MutationObserver on the node saw `hidden → visible` on each click. Side effects: a one-frame blink,
a re-measure per update, and a prompt being typed lost focus and saved empty (the flaky E2E
canvas.spec.ts:271 failed 1–3 in 8 under parallel load; also on the previous commit). Fix
(`Canvas.tsx`): keep the sizes from 'dimensions' changes and pass them back as `measured` (React
Flow docs, controlled flows). After: no visibility change on select; the unchanged test passed
32/32 under the same load.

## Soft UI (neumorphic) nodes without the cost of soft shadows (2026-09-25)

Style: namethatui.com/styles/neumorphism — one matte surface (#e3e7ee) for board and nodes,
a light/dark shadow pair for raised controls, inset shadows for wells (preview, prompt), no
borders, large radii, one accent (#5c6995) for the primary action, WCAG AA text contrast and
an accent selection ring (shadows alone fail non-text contrast).

The style is made of blurred shadows, which the board cannot afford: board content re-rasters
at each zoom level and each blur size compiles a GPU pipeline (the reason `boardPaint.test.ts`
bans them). `scripts/bake-neu-sprites.mjs` bakes the shadows once into three sprites (raised,
circle, inset; lossless WebP, 38 KB together, shadow only, the shape transparent) drawn with
`border-image` (+ `border-image-outset`), scaled per control by width and outset.

Same look, measured on the example board (Chrome for Testing):

| | Baked sprites (shipped) | CSS box-shadow (the style's usual recipe) |
| --- | --- | --- |
| Cold zoom stalls | 3–4 (≤ 101 ms), as before the restyle | 4–8 |
| Cold pointer-sweep stalls | 0–1 (first video playback) | 0–3 |
| Warm GPU raster during a zoom | 210–262 ms (before the restyle 213–260) | 659–1,491 ms |
| Warm long frames during a zoom | 0–1 | 6–7 |
| 200-node pan / zoom | 116–120 / 117–120 fps | — |
