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
