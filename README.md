# 3Dads platform — website and simulated product

Monorepo for the 3Dads public site (Astro) and application (Vite + React + Three.js), running against a stateful demo adapter. No LLM, generation provider, harness, payment or email service is called.

## Requirements

- Node 22.12+ (developed on 25.5), pnpm 10 (`corepack enable` or `npm i -g pnpm@10`)
- Playwright Chromium for E2E and measurements: `npx playwright install chromium`
- `ffmpeg` only if you regenerate `fixtures/sample-render.mp4`

## Commands

```bash
pnpm install                 # workspace install
pnpm dev                     # site on http://localhost:4321, app on http://localhost:5173/app/
pnpm build                   # fixture report + both apps (apps/marketing/dist, apps/web/dist)
pnpm preview                 # one-origin production preview on http://localhost:4173 (site at /, app at /app/)
pnpm typecheck               # tsc for packages/app, astro check for the site
pnpm lint                    # biome
pnpm test                    # vitest (contracts, mock backend)
pnpm test:e2e                # playwright against the production preview (run pnpm build first):
                             #   chromium journeys/controls/a11y/mobile + 7-viewport matrix on chromium/webkit/firefox
                             #   + journeys on webkit/firefox
pnpm perf                    # lab measurements → perf-results/*.json (run pnpm build && pnpm preview first)
pnpm bundle:report           # compressed chunk sizes → perf-results/bundle-report.json
pnpm fixtures:reset          # prints how to reset browser-side demo data
node scripts/render-posters.mjs   # re-render fixture/template posters with the real viewer
```

Deep links refresh correctly under `/app/*` (SPA fallback) and `/templates/*`, `/help/*` (static HTML); `/api/*` and missing assets return real 404s.

## Layout

See `docs/IMPLEMENTATION_PLAN.md`. Data flows through `packages/contracts` → `apps/web/src/services` (demo adapter) → hooks → screens. Docs: `docs/MOCK_SCENARIOS.md`, `docs/ROUTES_AND_INTERACTIONS.md`, `docs/PERFORMANCE_BUDGETS.md`, `docs/PERFORMANCE_REPORT.md`, `docs/QA_REPORT.md`, `docs/HARNESS_INTEGRATION_CONTRACT.md`.

## Demo identities

- mai@lumen.demo (owner, Lumen Skincare, typical dataset)
- sam@lumen.demo (viewer, same workspace)
- alex@northwind.demo (owner, Northwind Audio, small dataset)

Scenario selector: account menu → Demo scenarios, or `?scenario=slow|offline|flaky|…`.
