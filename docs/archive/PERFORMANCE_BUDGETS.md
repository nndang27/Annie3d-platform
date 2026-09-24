# Performance budgets and fixture definitions

Set 2026-09-12 before implementation grew. These are acceptance thresholds for the production build measured locally; field p75 values are targets that local lab runs cannot certify.

## Reference devices (declared)
| Tier | Device | Browser | Notes |
| --- | --- | --- | --- |
| Desktop reference | Apple M5 MacBook Pro, 24 GB, 3024×1964 Retina (DPR 2) | Chromium (Playwright bundled) | Primary measurement device |
| Constrained desktop | Same hardware, CPU 4× throttle, "Fast 3G"-like network via CDP | Chromium | Lab proxy for slower laptops |
| Mobile proxy | 390×844 viewport, DPR 3 emulated, CPU 4× | Chromium | Layout + interaction only; GPU results are not phone results |

Headless/software-rendered GPU numbers are recorded but never presented as real-device 60 fps proof.

## Public site (Astro)
| Metric | Budget |
| --- | --- |
| LCP (lab, desktop, cold) | ≤ 2.5 s (target ≤ 1.2 s on reference) |
| CLS | ≤ 0.1 |
| Initial JS on `/` (compressed, excluding on-intent viewer) | ≤ 25 KB |
| Initial CSS on `/` (compressed) | ≤ 30 KB |
| Hero LCP image transfer | ≤ 120 KB, explicit width/height, not lazy |
| Fonts | 1 family (Inter variable), ≤ 2 files, `font-display: swap` with metric fallback |
| Third-party scripts | 0 |
| Forbidden on public pages | Three.js, React Flow, app code, decoders in the initial load |

## App shell (Vite)
| Metric | Budget |
| --- | --- |
| Shell JS (entry + vendor react/router/query, compressed) | ≤ 140 KB |
| Dashboard route chunk | ≤ 40 KB |
| Workflow editor chunk incl. React Flow | ≤ 160 KB, loaded only on Workflow tab |
| Viewer-3d chunk incl. Three.js | ≤ 220 KB, loaded only when Studio/Outputs preview opens |
| App-shell useful paint (cold, prod) | ≤ 1.5 s |
| Cold editor entry to first useful 3D frame (typical fixture) | ≤ 1.2 s after chunk arrival |
| Warm route navigation | shell preserved; new content ≤ 300 ms |
| Action acknowledgement (click → visible state) | ≤ 100 ms on reference device |
| Typing latency while a run streams events | input echo ≤ 50 ms; no dropped keystrokes |

## 3D viewport
| Metric | Budget |
| --- | --- |
| Orbit / playback on typical fixture | 60 fps target: p95 frame interval ≤ 20 ms, dropped (>33 ms) ≤ 2% of frames over 5 s |
| Idle | 0 application-scheduled frames after 500 ms settle (animation paused) |
| DPR | capped at 2; adaptive down to 1.25 during sustained interaction if p95 > 20 ms |
| Draw calls, typical fixture | ≤ 24 |
| Triangles: small / typical / stress fixture | ≤ 12k / ≤ 60k / ≤ 400k (measured 3.2k / 15.7k / 126k) |
| GPU memory plateau over 10 mount/unmount cycles | textures + geometries return to baseline (renderer.info) |
| JS heap after 10 project switches | growth ≤ 15% of post-warm baseline |

## Mock transport (declared separately from frontend cost)
| Profile | Latency per call | Run step duration |
| --- | --- | --- |
| normal | 120–260 ms | 700–1600 ms |
| slow | 900–1800 ms | 3–6 s |
| offline | rejects immediately | paused |
| tests | 0–20 ms (latencyScale 0.05) unless a journey needs realistic timing |

Mock latency is never counted as frontend processing time in the report.

## Fixture definitions
| Fixture | Contents |
| --- | --- |
| Projects small / typical / stress | 3 / 24 / 400 projects |
| Graph small / typical / stress | 4 / 9 / 60 nodes |
| Events per run | ≤ 200 retained per run; 40 typical |
| Scenes | serum bottle (3 248 tris), headphones (15 744), smart speaker (3 840) — measured by `packages/viewer-3d/scripts/report-fixtures.mjs` into `fixtures/fixture-report.json`; stress = `ProductViewer.addStressCopies(n)` clones (8× headphones ≈ 126k) |

Budgets are not relaxed to pass; a failing budget is reported with the trace.
