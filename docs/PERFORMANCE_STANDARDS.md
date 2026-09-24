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

Cold GPU cache (first use on a machine) still costs one-off compiles when the editor or the
simulator first draws (editor ~350 ms environment map + ~130 ms first frame; simulator ~260 ms):
these are Metal pipeline compiles inside Chromium, the same class as the board's first-zoom
stalls (docs/DESKTOP.md).
