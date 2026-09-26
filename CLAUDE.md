# Annie 3D platform: working rules

Product: Annie 3D, the 3D supermarket: a node canvas of ready-made 3D workflows (3D ads are one aisle).
Vision, aisles, engines and dependency order: `docs/VISION_3D_SUPERMARKET.md` (read first).
Plan: `docs/BUILD_PLAN_CANVAS.md`. Scope: `docs/MVP_STRATEGY.md` (F1–F12).

## Stack (do not change without a written decision in docs/)
- Vite + React 19 SPA with the Cloudflare Vite plugin; Worker API on Hono; Durable Objects.
- Neon Postgres 18 via Hyperdrive + `pg`; Drizzle ORM and SQL migrations in `packages/db`.
- R2 for files (buckets `annie3d-uploads`, `annie3d-artifacts`, `annie3d-public`, region OC).
- React Flow 12 canvas, zustand stores with per-node selectors, TanStack Query for server data.
- three.js in one shared WebGL context (editor overlay only).

## Skill ownership
| Work | Load these skills |
| --- | --- |
| Writing/reviewing React code | `react-best-practices`, `composition-patterns` |
| UI review before commit | `web-design-guidelines` (pinned `command.md`) |
| Measuring load/interaction | `core-web-vitals`, `performance`, `chrome-devtools` (MCP traces) |
| Memory (editor open/close) | `memory-leak-debugging` |
| Accessibility | `accessibility`, `a11y-debugging` |
| Security headers, cleanup | `best-practices` |
| Worker/DO/Wrangler | `cloudflare:workers-best-practices`, `cloudflare:durable-objects`, `cloudflare:wrangler` |
| Database | `neon-postgres`, `neon-postgres-branches` |

Overrides for this stack: `next/dynamic` → `React.lazy` / TanStack lazy; SWR → TanStack Query;
ignore `server-*` React rules; never make React Flow wheel/touch listeners passive;
`web-vitals` INP does not cover continuous drags, so pan/zoom FPS is measured by
`tests/perf`.

## Workflow per change
1. Write code with the React rules in context; cite the source of any optimisation in a comment.
   Every text a person can read goes through `t()`. Add it in English and in all nine other
   languages in the same change (docs/I18N.md; translators follow packages/i18n/TRANSLATING.md).
2. `pnpm lint && pnpm typecheck && pnpm test`; E2E for touched flows.
3. Measure with Chrome DevTools MCP on the production build when performance is affected.
4. Report measured results separately from hypotheses; include screenshots.
5. Commit and push to `origin main` at the end of each phase.

## Secrets
Local values live only in `.dev.vars` and `.env.local` (gitignored). Never print, log or
commit them; never paste them into chat. Test-only auth is enabled only when
`ANNIE3D_TEST_AUTH=1` in local/test environments.
