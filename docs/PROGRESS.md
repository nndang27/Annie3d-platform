# Build progress (canvas, 12 features)

Scores are 0–100 per axis (docs/BUILD_PLAN_CANVAS.md §3). "Prod-10k" = readiness for 10,000
users. Each entry lists what was measured, not assumed.

## P0–P1 · Plan, skills, restructure — done
- Canvas-only app: one Vite project (SPA + Worker), static /home and /legal.
- Contracts: 10 node kinds, typed ports, reversible reducer, run plans, events, API schemas,
  engine plug point. 10 unit tests.

## P2 · Database — done
- 28 tables on Neon Postgres 18 (Sydney); hardening migration; atomic ledger.
- Verified on disposable Neon branches: 9/9 integration tests (`pnpm test:db`).
- Score: Backend 90 · Tests 85 · Prod-10k 75 (partitioning of `board_ops` and RLS policies pending).

## P3 · API Worker (core) — done
- Hono Worker, Better Auth (Google; password only when ANNIE3D_TEST_AUTH=1 locally), workspace
  provisioning with 60 free credits, per-request pg via Hyperdrive, rate-limit bindings.
- Boards: list, create (blank / starter / guest import), snapshot with stale flags, rename,
  archive; op batches locked per board, idempotent by `opId`, validated by the shared reducer,
  tombstones with guarded revive; op log replay.
- Assets: presigned single/multipart uploads to R2, sha256 dedupe, size + magic-byte checks,
  image dimensions from headers, immutable streaming with ETag/304 and byte ranges.
- Credits: estimate with cache prediction, ledger, simulated checkout (HMAC-signed, idempotent).
- R2: CORS for presigned uploads; lifecycle rule expires `dev/` objects after 7 days.
- Verified: 13/13 API tests on the live stack (`pnpm test:api`: Worker + disposable Neon branch +
  real R2), including tenant isolation, idempotency, undo, fake-file rejection, 304 and 206.
- API reference generated from contracts: docs/API.md (38 routes).
- Score: Backend 80 (runs/edits/agent/exports/shares routes land in P5–P9) · Tests 80 · Prod-10k 65.

## P4 · Canvas core (F1, free graph, sync) — done
- **Canvas:** React Flow 12 free node graph; typed wires with `canConnect`; a wire dropped on
  empty canvas opens a palette filtered to compatible inputs; ⌘K/N palette; right-click menus;
  duplicate/delete; Starters menu drops pre-wired lines of ordinary nodes; undo/redo via inverse ops.
- **F1:** guests land on an example board that has already run. It has three Starter lines
  (beauty, electronics, jewelry), every node shows real rendered fixtures from R2
  (`/api/public/fixtures/v1/*`, immutable, Workers Cache API).
- **Local-first sync:** optimistic reducer, IndexedDB outbox, 250 ms batching, idempotent retry,
  resync on rejection. Guest boards and uploaded files persist in IndexedDB and are imported
  on sign-in, including re-uploading the guest's files to R2.
- **Performance techniques:** viewport culling; memo nodes with per-node selectors; stable RF
  objects (WeakMap); rAF-throttled drags with one op per gesture; settled-zoom LOD with
  counter-scaled compact cards; images chosen by zoom × DPR (256/512/1024 WebP); one video at a
  time; lazy auth client and editor chunk.
- **Bugs found by tests and fixed:**
  - Rapid zoom clicks did not accumulate.
  - The outbox queue could leak across boards.
  - Duplicate packshot angles from symmetric fixtures.
  - A 1024 px PNG was served into 276 px cells.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| E2E (Playwright, disposable Neon branch) | 30/30 across Chromium, WebKit and Firefox |
| API tests | 13/13 |
| Store unit tests | 6/6 |
| Lighthouse, production build, desktop | Performance 97 · Accessibility 100 · Best Practices 100 · SEO 100 |
| LCP / TBT / CLS (Lighthouse, simulated) | 1.1 s / 0 ms / 0.001 |
| Pan/zoom, 203 nodes, hardware GPU | ~120 fps, p95 frame 9.2 ms, including 4× CPU throttle |
| Pan, 203 nodes, SwiftShader software GPU | 17 fps (raster bound; CPU throttle did not change it) |
| DOM nodes at 100% zoom | 6 of 203 (culling) |
| Main JS | 67 kB gzip |

**Open items:**
- zod dominates the main bundle; slimming it is planned for P10.
- Text compression is left to Cloudflare in production and will be verified at deploy.
- Guest example photos are not yet carried into the imported board; P5 seeds fixture assets.

**Scores:** UI 70 · Backend 82 · Tests 88 · Prod-10k 68.

## P5 · Runs, engine simulator, live progress (F2–F5 core, F11 cost) — done
- **Run API:**
  - `POST /api/boards/:id/runs` plans the run, schedules only non-cached steps, and reserves
    credits in the same transaction as the run rows. It is idempotent per key and allows one
    active run per board.
  - Also `GET /api/boards/:id/runs`, `GET /api/runs/:id`, `POST /api/runs/:id/cancel`, and the
    `GET /api/runs/:id/events` WebSocket.
- **RunRoom Durable Object** (one per run):
  - Executes from `alarm()`, so an eviction retries and resumes at the first unfinished step.
  - Stores a gap-free event log in SQLite and fans it out over hibernatable WebSockets.
    Reconnects replay exactly what was missed (`?after=seq`).
  - Deletes itself 24 h after the run finishes.
- **Engine plug point:** `engines/registry.ts` maps each node kind to an `Engine`.
  - The deterministic simulator reports staged progress, honours cancel, and writes outputs
    through `putArtifact` into content-addressed R2 keys. It returns quality gates (`#fail`,
    `#slow` are test hooks).
  - Real agents replace it per kind, in process or through the External Engine Protocol.
- **Result cache and staleness:** input hash = kind + engine version + settings + upstream
  versions.
  - Unchanged nodes are free and never scheduled.
  - A result becomes current through an ordinary op, so the op log, other tabs and undo agree.
- **Credits:** reserve at start; settle once, atomically with the final status (guarded against
  alarm retries); failed and cancelled steps are refunded.
- **F1 for signed-in users:** new accounts and imported guest boards open on the example
  already run. Seeding uses a few bulk statements and copies no files (migration 0002).
- **UI:** a cost dialog before any charge, with unchanged nodes summarised as free. Also live
  per-node progress and stage labels, and Running… / Cancel in the top bar. Gate failures are
  shown on the node, toasts summarise the result, and a run in progress resumes after a reload.
  The viewport is remembered per board, and Shift+2 zooms to the selection.
- **Bugs found by tests and fixed:**
  - A ledger foreign-key ordering error.
  - Duplicate storage keys when an export and its model shared the same bytes.
  - Asset URLs were tied to `APP_URL`; they are now same-origin paths.
  - The test harness `spawnSync` starved the server's log pipe.
  - Seeding took >10 s; it was reduced with bulk writes.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| API tests | 23/23 |
| E2E, Chromium + WebKit + Firefox | 42/42 |
| DB integration tests | 9/9 |

The API tests cover a full line run, replay, up to date, partial re-run, 402, gate refund,
cancel, idempotency and 409, tenant isolation, and seeding. The E2E tests cover the up-to-date
example, cost, live progress with v2, gate error, and reload plus cancel.

| Timing (local dev → Neon Sydney, no Hyperdrive pooling) | Result |
| --- | --- |
| Example board create + seed | 3.3 s (~45 round trips); re-measure on deploy |

**Scores:** UI 76 · Backend 88 · AI-plug 85 · Tests 90 · Prod-10k 72.

## P6 · 3D editor overlay (F8 region edit, F9 versions, F4 packshot camera) — done
- **Editor:** a lazily loaded overlay (three.js chunk, 186 kB gzip, never on first load) with
  one WebGL context per open, rendered on demand.
  - Tools: orbit, brush, lasso, clear, packshot camera, preview light.
  - Bottom of the viewport: a version strip and animation playback. Right: an agent panel with
    context chips.
- **Selection:** three-mesh-bvh in `indirect` mode keeps the GLB's triangle order.
  - Face ids are global in glTF document order, so client and server agree on the faces.
  - Brush uses a BVH sphere shapecast. Lasso selects front-facing triangle centroids inside
    the screen polygon.
- **Region edit API:** `POST /api/boards/:id/nodes/:nodeId/edits` creates an edit run (4 cr).
  The face list is stored in R2; parameters live on the run.
- **Simulated edit engine:** applies the instruction to the selected faces for real with
  glTF-Transform. Colour words, matte/gloss/metal are supported, in a new primitive with a
  derived material.
  - The result is version n+1 (`source: edit`, parent = base). It inherits the base input
    hash, so the node stays fresh.
  - An empty selection fails the `selection` gate and is refunded.
- **Versions (F9):** strip, side-by-side compare (one renderer, scissor split, shared camera),
  and revert as an undoable op.
- **Packshot camera (F4):** the current view sets downstream packshot nodes to custom
  angles, or adds a connected packshot node.
- **Memory (memory-leak-debugging skill, Chrome DevTools MCP heap snapshots):** 5 open/close
  cycles first retained 6 editors and 12 renderers. Two causes were found and fixed:
  - React removes DOM before passive effect cleanups, so OrbitControls could not unregister
    its document keydown listener. Fixed with a layout-effect lifecycle plus explicit removal.
  - three r186's shared `DFG_LUT` texture keeps a dispose listener per renderer. It is now
    disposed after each renderer.
  - After the fixes: 0 editors, renderers or controls retained.
- **Robustness:**
  - An error boundary closes the editor if WebGL fails.
  - A stale `?edit=` link closes itself.
  - A fresh canvas per mount avoids reusing a lost WebGL context in StrictMode.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| Unit tests | 16/16 |
| API tests | 24/24 |
| E2E, Chromium + WebKit + Firefox | 54/54 |

The API tests add a region edit that yields a new GLB and keeps the base, revert, and a gate
refund. The E2E tests add brush and lasso, clear, close releasing the canvas, the guest
sign-in gate, edit → v2, compare, revert, and the packshot camera.

**Known gap:** edited versions reuse the base posters until a render engine refreshes them.

**Scores:** UI 84 · Backend 89 · AI-plug 88 · Tests 91 · Prod-10k 74.

## P7 · Exports (F6) and share links (F10) — done
- **Exporter (Worker, glTF-Transform):**
  - Re-packs the GLB losslessly by pruning unused data, then checks it against the preset:
    bytes, rendered triangles (instancing-aware), largest texture (read from PNG/JPEG/WebP
    headers), animation, and a structural validator round trip.
  - Presets are Web / store, Google Merchant and Google Swirl.
  - `@gltf-transform/functions` was dropped: its ndarray dependency uses `new Function`, which
    Workers forbid. Decimation and texture compression need WASM/native encoders, so they
    belong to the export engine plugged in later; the report names the failing limit.
- **Export API:**
  - `POST /api/exports` exports a model version (from the editor or canvas menu) or an Export
    node's inputs. The bundle is a zip plus the GLB, ad MP4 and packshot images; existing files
    are referenced, not copied. It is idempotent per key.
  - `GET /api/exports/:id` returns an export; `?download=` sets the attachment filename.
- **Export node runs** use the same exporter; preset checks become the version's gates.
  The example board's export bundles are pre-built by the same code (`fixtures/export-bundles.ts`).
- **Shares:**
  - Tokens are 128-bit base64url, with one live link per target; revoke is a timestamp.
  - `GET /api/public/shares/:token` returns the payload with the hero video first.
  - Public asset route only serves assets inside the shared target.
- **Share page `/s/:token`:**
  - Server-rendered with Open Graph and Twitter tags (absolute og:image and og:video), so link
    previews work without JavaScript.
  - No scripts; a strict CSP (`default-src 'none'`); light and dark themes; 60 s cache.
  - Carries a "Make yours free" CTA as the growth loop.
- **UI:** an export dialog (preset cards, pass/fail report, download zip or GLB), a share dialog
  (copy, open preview, view count, turn off), an export summary on the Export node, and
  "Export / download…" in the node menu.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| API tests | 31/31 |
| E2E, Chromium + WebKit + Firefox | 63/63 |

The API tests add presets and idempotency, zip download headers, and Swirl failing only on
animation for a static GLB. They also cover the Export node bundling GLB + MP4 + PNGs, share
create/reuse, public payload, cross-target isolation, the OG page without scripts, and revoke.

**Scores:** UI 88 · Backend 91 · AI-plug 88 · Tests 92 · Prod-10k 76.

## P8 · Accounts, credits and billing (F11) — done
- **Sign-in:** Google, plus Google One Tap through Better Auth's `oneTap` plugin.
  - One Tap is prompted when a guest reaches a moment of value (Run, Share, Save). The Google
    button stays as the fallback.
  - The public client id comes from `GET /api/public/config`.
- **Credits:**
  - 60 free credits on sign-up cover one full Starter run; the cost is shown before every run.
  - Only succeeded, non-cached steps are charged, and failed or cancelled steps are refunded.
- **Billing:**
  - Plans: Creator $19 / 300 credits and Studio $49 / 1,000 credits.
  - Checkout goes through a hosted page (`/billing/checkout`, signed link, no scripts, strict
    CSP) with the same shape as Stripe/Paddle. Paying posts to the signed confirm endpoint,
    which grants idempotently and redirects back with `?checkout=success`.
  - Return paths are same-origin only; a foreign `returnUrl` falls back to `/`.
- **UI:**
  - A credits dialog shows balance and held credits, plan cards and history.
  - An account menu offers Credits & plan and Sign out.
  - A payment toast appears on return.
- **Fixed from tests:** a revoked share link still showed in WebKit from its 60 s cache. Share
  pages and payloads now revalidate on every view.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| API tests | 33/33 (adds the hosted checkout, the 303 return and the open-redirect guard) |
| E2E, three browsers | 66/66 after the cache fix (adds buy a plan → checkout page → back with 360 credits → history → sign out) |

**Scores:** UI 90 · Backend 92 · AI-plug 88 · Tests 93 · Prod-10k 78.

## P9 · Agent panel (F7) and process reel (F12) — done
- **Agent plug point:** `worker/agents/types.ts`. An agent turns a message into streamed
  actions: text, op batches and runs. The route applies ops through `applyBatch` (same
  reducer, lock and op log as a person), starts runs through the normal run path within the
  message's credit budget, and streams SSE. Threads and messages are stored for history and
  context.
- **Simulated agent:**
  - Understands look, mood (warmer/cooler…), duration (nearest 6/10/15 s), aspect, motion,
    headline, detail, export preset, add packshots, and run.
  - Targets the selected line and asks when several nodes match instead of guessing.
  - Skips no-op edits and says so.
- **Dock:**
  - SSE over fetch with streaming text and ✓ chips for applied edits.
  - Agent edits are undoable with ⌘Z, since each is a normal inverse batch.
  - Runs started by the agent stream into the board, and history reloads.
- **Process reel:**
  - Recorded in the browser at 540×960: the ad (with its music) on top, and below it a replay
    of the run on the board timed from the run room's event log.
  - Output is MP4 or WebM via MediaRecorder, uploaded through the presigned path and
    registered with `POST /api/runs/:id/reels`. Server mode is a plug point and returns 501.
- **Bugs found by tests and fixed:**
  - "make it square" triggered a run.
  - The SSE stream used a DB client that `closeDb` had already closed; the stream now has its
    own connection.
  - R2 CORS lacked the test origins, which revealed that signed-in browser uploads had no E2E.
    A new upload E2E covers it on all browsers.

**Measured on 2026-09-24:**

| Check | Result |
| --- | --- |
| Unit tests | 23/23 (agent planner) |
| API tests | 38/38 (agent SSE ask/edit/run/budget/history, reels) |
| E2E, three browsers | 73 passed, 2 skipped (the reel is recorded in Chromium only); adds agent edit → undo → run → history, a recorded and downloadable reel, and browser upload |

**Scores:** UI 93 · Backend 93 · AI-plug 92 · Tests 94 · Prod-10k 80.

## P10 · Quality pass and production deploy — done
- **Security headers:**
  - Static assets get CSP, HSTS, Permissions-Policy, COOP, nosniff and frame denial via
    `_headers`. The Worker sets its own headers for API, share and checkout.
  - CSP allows only self, Google Identity Services and R2 presigned uploads.
  - zod runs jitless, so the CSP sees no eval probe.
- **Build hygiene:** client source maps are moved out of the deployed assets (kept in
  `dist/sourcemaps`), and hashed assets are cached immutably.
- **Production deploy:**
  - Worker `annie3d` with the `production` environment and Hyperdrive to the Neon production
    branch (migrated).
  - Secrets were set from stdin, including a fresh production auth secret; test sign-in is
    disabled.
  - Runbook: `docs/DEPLOY.md`.

**Measured on production, 2026-09-24:**

| Check | Result |
| --- | --- |
| `/api/health` DB round trip via Hyperdrive | 11 ms (local dev direct: ~167 ms) |
| Lighthouse desktop | 99 / 100 / 100 / 100, LCP 0.7 s, TBT 0 ms, CLS 0.001 |
| Lighthouse mobile (simulated slow 4G) | 98 / 100 / 100 / 100, LCP 1.9 s |
| Guest smoke test | first image in 347 ms, all previews decoded, editor opens, Run asks to sign in, 0 console errors |
| Load test, 1,000 requests × 4 endpoints at 50 concurrency from one client | 0 errors |
| DB endpoint under load | ~1,240 req/s, p95 68 ms |
| App shell under load | p95 78 ms |

**Scores:** UI 93 · Backend 94 · AI-plug 92 · Tests 94 · Prod-10k 84.

## Readiness for 10,000 users (honest summary)
**Done and measured:**
- All 12 features are built and wired end to end.
- Tests: 23 unit, 38 live API and 73 E2E across three browsers, plus 9 DB tests.
- Tenant isolation, idempotency and credit safety are tested.
- Performance: ~120 fps canvas with 200 nodes on a real GPU; Lighthouse ≥ 98 on production;
  a single client pushes >1,200 req/s through the DB path without errors.
- Edge-scale architecture: Workers, Durable Objects per run, Hyperdrive pooling, and R2 with
  CDN-cached public fixtures.

**Open before a public launch:**
1. **Real engines** (user's part) via `engines/registry.ts` or the External Engine Protocol.
   The same goes for a real agent via `agents/registry.ts`.
2. **Google OAuth production URIs** (owner action).
3. **Real payments** (Stripe/Paddle webhook replacing the simulated confirm).
4. **Error tracking and alerting.** Workers observability is on; there is no Sentry or
   alerting yet.
5. **CI/CD activation** (template ready).
6. **Account deletion and data export** (privacy law), and email notifications.
7. **Scale work for later:** `board_ops` partitioning or archiving, Postgres RLS as defence in
   depth, and a server-side reel render worker.

**Overall:**

| Measure | Estimate |
| --- | --- |
| MVP feature completeness (UI + simulated AI) | ≈ 92% |
| Production readiness for 10,000 users, excluding the real AI engines | ≈ 82% |

## 2026-09-24 — Miro-style grid and zoom (user request)

Measured on a live Miro board with a canvas pixel probe (20–200%):

| What | Miro (measured) | Annie 3D now |
| --- | --- | --- |
| Grid | two weights; minor 80 board units below 100%, 20 units from 100% (×4 per power of 4); major every 4 minors | same (`canvas/Grid.tsx`) |
| Minor line strength | grows with on-screen cell size, ≈ clamp((px−12)/48): 16 px→0.2, 40 px→0.5, 60 px→full; majors always full | same formula |
| Level change | seamless: old minors become the new majors, no jump or fade animation | same |
| Colours | background #f2f2f2, lines #e2e2e2 | same |
| +/− steps | 20, 33, 50, 75, 100, 150, 200% (animated) | 25, 33, 50, 75, 100, 150, 200% (300 ms) |
| Range | 20–200% on an empty board | 25–200% (user: no tiny zoom) |
| Mouse wheel | zooms around the cursor | zooms around the cursor, eased; trackpad two-finger scroll still pans, pinch zooms |

Removed: the compact (text-only summary) node level. Exact Miro easing was not measurable (the
browser pane throttles animation frames), so the 300 ms duration is our choice, not a measurement.

## 2026-09-24 — Debug round 1: node UI (user request)

The user asked for the ElevenLabs flow-node look (reference screenshots: generation node, input
node, wire with a delete button), copy/paste and duplicate that keep outputs, image paste from
other apps, double-click to add a text node, and quick sharing without deploying.

| Item | Implementation | Verified |
| --- | --- | --- |
| Node layout | Title and engine above the card; result on top, prompt and split `Run ▾` (this node / with inputs / from here) below; settings, Replace, download, delete and `…` in a toolbar under the selected node (`canvas/FlowNode.tsx`) | E2E `node UI, wires and clipboard` (3 browsers), `docs/screens/p11-01`, `p11-02` |
| Input node | Full-bleed image card, `Run from here` overlay, Replace in the toolbar | screenshot `p11-06` |
| Ports | 34 px round bubbles outside the card with a type icon and pastel colour; faded until wired or hovered; label on hover | E2E (connected class) |
| Wires | Custom edge (`canvas/FlowEdge.tsx`): pastel stroke of the source type, stronger on hover/selection, round blue × at the midpoint removes it. Drawn inside the wire's SVG group (an HTML layer flickered in Firefox) | E2E removes a wire in 3 browsers, `p11-03` |
| Marquee | Partial selection (Figma): a marquee picks every node it touches | manual + `p11-05` |
| Copy / cut / paste / duplicate | `canvas/clipboard.ts`: payload = nodes (settings incl. prompt), internal wires, current versions; system clipboard as text, so paste works across tabs/boards; pastes at the cursor; ⌘D offsets by 40 px. Server op field `copyOfVersionId` creates a `copy` version sharing the output assets (migration 0003). A pasted chain stays fresh; a copy wired differently shows stale | API test `copy / paste keeps outputs`, E2E (prompt and output kept) |
| Paste / drop an image | Image files from the clipboard or dropped on the canvas become Photo nodes (≤ 25 MB); pasted plain text becomes a Text node | E2E (Photo node with preview) |
| Double-click | Empty canvas → Text node with its editor focused (focus retried until React Flow has measured the node) | E2E (editor focused, text saved) |
| Share without deploy | `pnpm share`: build (development config, dev Neon branch) → `vite preview` :4173 → Cloudflare quick tunnel; the link survives rebuilds; `pnpm share:stop`. The preview build is shared, not the dev server (which would expose source and `.dev.vars`). Outside production the auth base URL follows the `*.trycloudflare.com` host | `/api/health` over the tunnel; OAuth redirect_uri uses the tunnel origin; `/.dev.vars` returns the SPA shell |

Known limits of the shared link: Google sign-in needs the tunnel's callback URL in the Google
console (a new random URL each time the tunnel restarts); signed-in uploads need the tunnel origin
in the R2 CORS rules (guests keep files in the browser and are unaffected).

## 2026-09-24 — Debug round 2: undo, ports, wires, 3D shortcut, Run, F13 Simulation

| Item | Change | Verified |
| --- | --- | --- |
| Undo after deleting several nodes lost results and wires | Delete key now sends nodes and wires as ONE batch (`onDelete`), and the inverse of `node.delete` also restores each node's `currentVersionId`; the server accepts a revived node pointing back at its own version (nodes are tombstoned, versions survive) | unit test (reducer), API test `undo of a delete (server)`, E2E (one ⌘Z restores the exact graph) |
| Port bubbles | 28 px with 12 px icons (≈ ElevenLabs proportion to the node); the port name appears in a dark tooltip under the pointer instead of grey labels on hover | E2E tooltip |
| Wire delete | A white-blue spark runs from the source end to the midpoint in 280 ms (ease-out) carrying the × button, which stays at the middle (reduced motion: no run) | E2E (button settles at the midpoint) |
| 3D result | "Open 3D" text button replaced by a corner icon (Move3D) on hover; double-click on the result opens the editor, one click only selects | E2E |
| Run | No credit label (still in the tooltip and the run dialog); compact 26 px `Run ▾`; the prompt spans the card width | E2E |
| F13 Simulation node | `simulation` kind (migration 0004), in every Starter (8 nodes, 9 wires). Simulator overlay: shop page, TikTok, sticker (transparent PNG), showroom; one WebGL canvas (`SimViewer`) moved between layouts. Phone remote at `/sim/<room>` over the `SimRoom` Durable Object relay (no storage, ≤ 8 sockets, 128-bit room id): tilt (DeviceOrientation, iOS permission), drag pad, recenter, spin, place, snapshot back to the phone | E2E `F13 simulation` (screen + phone page, two-way), screenshots |
| Tooling | `apps/web` typecheck now `tsc -b --force`: the incremental build missed errors caused by changes in `packages/contracts` | caught a missing `simulation` entry |

Production deploy needs migrations 0003 and 0004 first, and the `SimRoom` Durable Object migration (`v2`) ships with the Worker.

## 2026-09-25 — Debug round 3: board files, responsive layout, wire and node polish

| Item | Change | Verified |
| --- | --- | --- |
| `.annie3d` board file | ZIP with `annie3d.json` (nodes, wires, settings incl. prompts) + `assets/` (current result of every node with poster/thumb/turntable). Board menu (⋯ next to the title), ⌘S download, ⌘O open, drop a file on the canvas. Guests open it in the browser (files kept in IndexedDB, variants too); signed-in users POST it to `/api/boards/:id/import` (≤ 80 MB), which stores the files in the workspace (content-addressed), creates nodes/wires with new ids and one `upload` version per node, and records fresh input hashes | E2E export → import round trip (guest), API import test (+ rejects non-Annie files) |
| Wire current | The × sits at the midpoint from the first moment; only the light runs from the source end | E2E midpoint test |
| Run button | Own row under the prompt; the prompt keeps the full card width and grows while typing | screenshot |
| 3D shortcut icon | Custom three-arrow mark (up, down-left, down-right) as in the reference | screenshot |
| Responsive | Fluid top bar (labels drop below 640 px, save state becomes a dot), toolbar keeps tools/+/undo/agent on phones, safe-area insets, `dvh`, simulator header scrolls its tabs instead of pushing Close off-screen (`minmax(0, 1fr)`), performance panel fits the width and is in the board menu; touch screens pan with one finger, get 34–40 px targets and see hover-only controls on the selected node | E2E `responsive` on iPhone SE / iPhone 13 / iPad Pro 11 in 3 engines |
| Desktop app | Research only: `docs/DESKTOP_APP_RESEARCH.md` (Electron shell loading the live site, update button, file association, BYOK vs subscription login policies) | — |
