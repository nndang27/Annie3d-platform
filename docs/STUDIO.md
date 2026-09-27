# 3D Studio: decision and measurements (2026-09-27)

## Decision
The 3D studio is Pascal Editor (github.com/pascalorg/editor, MIT; its six bundled plugins are MIT too),
kept as a separate app in `Production_system/Pascal_editor` (Next.js 16, React 19, React Three Fiber 9,
three.js 0.186 `WebGPURenderer` with a WebGL2 fallback). All studio code is written there. This app only
links to it:

- Web: the top bar's **Studio** button (`apps/web/src/client/lib/studio.ts`) opens `VITE_STUDIO_URL`
  (development default `http://localhost:3002`) with `?from=<board URL>`. A build without a studio URL shows
  no button.
- Desktop: `ANNIE3D_STUDIO_URL` (development default `:3002`) opens the studio in its own sandboxed window
  with no preload, so it never reaches `window.annieDesktop`; its back link focuses the board window.
- The studio's "Back to Annie 3D" button accepts only Annie origins (`NEXT_PUBLIC_ANNIE_APP_URL`,
  default `:5173,:4173`) as return targets.

Not decided yet: production hosting of the studio (own Worker/domain or `/studio` on this origin), shared
sign-in, and passing a board node's model into the studio.

## Measured viewer performance
Setup: Pascal production build (`next start`), Playwright Chromium 153 headed on the real GPU
(Apple Metal 3, WebGPU), 1440×900 at 2× DPR. Right-drag orbit ~6 s, then wheel zoom; frames counted from
GPU submits. Scenes: a furnished two-bedroom flat built with Pascal's own MCP tools, repeated.
Tools: `Pascal_editor/annie/perf/` (`build-scene.ts`, `probe.mjs`).

| Scene | Triangles | Draw calls | Orbit FPS (p95 frame) | CPU frame | GPU frame | JS heap | Tab RSS |
|---|---|---|---|---|---|---|---|
| 1 flat, 34 nodes | 7.9k | 168 | 50 (25 ms) | 1.2 ms | 2.5 ms | 92 MB | 648 MB |
| 9 buildings × 2 floors, 586 nodes | 130k | 2,531 | 50 (25 ms) | 5.2 ms | 3.4 ms | 229 MB | 934 MB |
| 36 buildings × 3 floors, 3,493 nodes | 477k | 6,332 | **29** (50 ms; 18 frames > 50 ms, one 458 ms) | 28.5 ms | 4.0 ms | 571 MB | 1.6 GB |
| same, WebGL2 forced | 477k | 2,331 | **24** (51 ms) | 34.9 ms | 14.4 ms | 643 MB | 1.3 GB |

Observations:
- 50 FPS is Pascal's own cap (`FrameLimiter`, `maxFps=50`); it renders continuously, also when nothing
  moves (idle = 50 frames/s of GPU work).
- The large scene is CPU-bound: ~26 ms per frame encoding draw calls while the GPU needs ~4 ms.
  16,206 visible meshes remain after batching.
- WebGPU beats the WebGL2 fallback on the same scene (29 vs 24 FPS, GPU 4 vs 14 ms).
- Memory grows ~140 KB of JS heap per node; there is no LOD and no geometry work in workers.

Not measured: Blender on the same scene (no claim is made here about the comparison).

## Core viewer work, in order of expected gain (hypotheses until measured with the probe)
1. Render on demand (invalidate on change/input) and uncap to the display rate while interacting.
2. Cut per-mesh CPU cost: merge static geometry per level (doors, windows, walls, slabs), more instancing.
3. Distance LOD and culling of hidden levels; move geometry builds to workers.
