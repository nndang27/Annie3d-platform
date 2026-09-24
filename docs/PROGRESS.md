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
