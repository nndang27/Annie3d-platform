# Database (Neon Postgres 18, Sydney)

Schema source: `packages/db/src/schema/*.ts` (Drizzle). Migrations: `packages/db/migrations`
(`0000_init.sql` generated, `0001_hardening.sql` hand-written). Integration tests:
`pnpm test:db` (creates a disposable Neon branch from `dev`, migrates, tests, deletes it).

## Standards applied (postgres-best-practices skill, schema-design.md / indexing.md)

- snake_case identifiers, plural table names; camelCase only in TypeScript (`casing: 'snake_case'`).
- UUIDv7 primary keys: `DEFAULT uuidv7()` (built into PG18) and client-generated UUIDv7 for
  canvas records, so records can be created offline and inserts stay index-local.
- `timestamptz` for every time; `text` + `CHECK` for bounded strings and small value sets.
- Every foreign key column is indexed (verified by a catalog query: 0 unindexed FKs).
- `workspace_id` on every tenant-owned table (ready for Row-Level Security) and
  tenant-leading composite indexes such as `(workspace_id, created_at DESC)`.
- Partial indexes for hot subsets: live nodes/edges (`deleted_at IS NULL`), active runs,
  ready assets (dedupe), open engine jobs.
- JSONB only for flexible, schema-versioned payloads (node settings, version params, gates),
  guarded by `jsonb_typeof` CHECKs; validated by zod in the API.
- Money-like data (credits): conditional atomic UPDATEs, append-only ledger enforced by
  triggers, idempotent external references.
- Migrations run on the direct (unpooled) connection, tested on a branch before `dev`.

## Tables (28)

| Group | Tables | Notes |
| --- | --- | --- |
| Auth (Better Auth) | users, sessions, accounts, verifications | case-insensitive unique email |
| Tenancy | workspaces, workspace_members | personal workspace per user; roles owner/editor/viewer |
| Canvas | boards, board_nodes, board_edges, board_ops | tombstones for nodes/edges; op log with per-board `seq` and idempotent `op_id`; z-order `COLLATE "C"` |
| Files | assets, asset_variants | metadata only, files in R2; sha256 dedupe per workspace |
| Versions | node_versions, node_version_outputs | nothing overwritten; current version must belong to its node (trigger) |
| Runs | runs, run_steps, result_cache, engine_jobs | idempotent runs; per-workspace result cache by input hash; external engine jobs store only a hash of the callback secret |
| Outputs | exports, export_files, reels | GLB preset reports, process reels |
| Sharing | shares | 128-bit tokens, revocation timestamp, view counter |
| Billing | credit_accounts, credit_entries, subscriptions, payment_events | balance ≥ reserved ≥ 0; ledger append-only; webhook inbox unique per provider event |
| Agent | agent_threads, agent_messages | structured JSON content |

## Verified behaviour (live test branch, 9/9)

- 20 concurrent reservations of 5 credits against a balance of 60: exactly 12 succeed, balance
  never negative, settlement leaves 24 credits and 0 reserved.
- The same payment event delivered twice concurrently credits once.
- Ledger UPDATE/DELETE are rejected; deleting a workspace still cascades.
- Content-hash dedupe, live-edge uniqueness, no self-loops, JSON shape checks, current-version
  ownership, op idempotency, byte-wise z-order, database-maintained `updated_at`.

## Scaling notes for 10,000+ users

- `board_ops` will be the largest table: partition by `created_at` (monthly) and archive old
  partitions once replay windows are defined.
- Enable RLS policies on `workspace_id` when direct SQL access or multi-member workspaces ship.
- Read replicas on Neon for share pages and analytics if read load grows.
