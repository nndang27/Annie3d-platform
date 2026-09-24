# Build plan: Annie 3D canvas (12 features, real backend, simulated AI)

Status: active plan, started 2026-09-24. Source of scope: `MVP_STRATEGY.md` (F1–F12),
`SINGLE_PAGE_WORKSPACE.md` (layout, approved UI in `docs/ui/`),
`WORKSPACE_ENGINEERING_PATTERNS.md` (techniques), `FULLSTACK_SETUP.md` (services),
`CICD_SETUP.md` (after the build).

## 0. Ground rules for this build

1. **One product page**: the canvas at `/` (and `/b/:boardId`). The 3D editor is an overlay
   (`?edit=<nodeId>`). A static Home (`/home`) and legal pages exist only for SEO and the
   OAuth consent screen. A share viewer lives at `/s/:token`. Everything else is deleted.
2. **Real backend, simulated AI.** Auth, database, storage, runs, credits and sharing are
   real (Cloudflare Worker + Neon + R2). Generation engines are a deterministic simulator that
   produces real files (images, GLB, MP4, audio, text) from fixtures, so the whole flow is
   testable. The simulator sits behind the same interface the real agents will implement.
3. **Every optimisation cites a source** (docs, a production codebase, or a paper) in code
   comments and in the phase report. Prefer vetted libraries over hand-written versions.
4. **Measure, don't assume.** Each phase ends with automated tests, a Chrome DevTools MCP
   trace or Lighthouse run where relevant, screenshots, and a completeness score against
   "production for 10,000 users".
5. **Skills in use**: Vercel `react-best-practices`, `composition-patterns`,
   `web-design-guidelines`; Addy Osmani `core-web-vitals`, `accessibility`, `best-practices`,
   `performance`; Chrome `chrome-devtools`, `memory-leak-debugging`, `a11y-debugging`,
   `debug-optimize-lcp`; Cloudflare `workers-best-practices`, `durable-objects`, `wrangler`;
   Neon `neon-postgres`, `neon-postgres-branches`.
6. Commit and push to `github.com/nndang27/Annie3d-platform` at the end of every phase.

## 1. Target structure

```
apps/
  web/            Vite + React SPA (canvas) AND the Cloudflare Worker (Cloudflare Vite plugin)
    src/client/   canvas UI, editor overlay, agent panel, share viewer entry
    src/worker/   Hono API, Better Auth, Durable Objects (BoardRoom, RunRoom), simulator
    wrangler.jsonc
  site/           Astro: /home, /legal/privacy, /legal/terms (built into web/public)
packages/
  contracts/      zod schemas: node kinds, ports, graph ops, API DTOs, run events
  db/             Drizzle schema, SQL migrations, seed, test helpers (Neon branch per run)
  viewer-3d/      three.js: one shared renderer, GLB loading, BVH region selection, capture
  ui/             tokens and primitives
fixtures/         generated sample assets + generator scripts (images, GLB, MP4, audio, text)
tests/            e2e (Playwright), perf (budgets), load (k6-style scripts)
```

## 2. Phases

| # | Phase | Output | Exit test |
| --- | --- | --- | --- |
| P0 | Plan, skills, repo rules | this doc, `.claude/skills/*`, `CLAUDE.md` | skills listed in session |
| P1 | Clean-up and restructure | delete old routes/pages/mock backend; new workspace layout; build green | build + lint + typecheck |
| P2 | Database | Drizzle schema, migrations on Neon `dev`, seed, constraint tests on an ephemeral Neon branch | migration up/down, constraint + concurrency tests |
| P3 | API Worker | Hono routes, Better Auth (Google + test-only auth), Hyperdrive, R2 presigned multipart, rate limits, idempotent ops | Workers vitest pool integration tests |
| P4 | Canvas core (F1, F7 shell, F9 shell) | React Flow canvas, 9 node kinds, typed ports, palette, context menu, toolbar, pills, example board, local-first ops queue | E2E + pan/zoom FPS with 200 nodes |
| P5 | Runs and simulator (F2, F3, F5) | RunRoom Durable Object, WebSocket events with sequence + resume, result cache, stale propagation, Run all | E2E run, reconnect, cancel, cache hit |
| P6 | 3D editor overlay (F4, F8, F9) | single WebGL context, GLB via GLTFLoader + meshopt, BVH brush/lasso selection, version compare, packshot camera | heap flat after 20 open/close, selection tests |
| P7 | Export and share (F6, F10) | glTF-Transform optimise + Khronos validator per preset, MP4/PNG sets, share page with OG tags | preset pass/fail tests, share E2E |
| P8 | Credits, sign-in gate, billing (F11) | ledger, estimates, free run, simulated checkout (Stripe later) | ledger concurrency tests |
| P9 | Agent panel (F7) and process reel (F12) | simulated agent issuing graph ops; replay-based reel to WebM | E2E |
| P10 | Quality pass and deploy | CWV traces, Lighthouse, a11y, security headers, deploy to `workers.dev`, perf gate | report + live URL |

## 3. Completeness scoring (per feature, per phase report)

- **UI** (0–100): matches the approved screens and interaction spec.
- **Backend** (0–100): real persistence, auth, limits, idempotency.
- **AI** (0–100): 0 = simulator only; real engines plug in later.
- **Tests** (0–100): unit, integration, E2E, perf coverage.
- **Production-10k** (0–100): what remains for 10,000 users (load, monitoring, abuse, cost).
