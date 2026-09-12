# 3Dads website and simulated product — implementation plan

Date: 2026-09-12. Owner: Fable (design + frontend + QA). Status column is updated as work lands; see the bottom section for completion status.

Source of truth for scope: `PROMPT_FABLE_BUILD_3DADS_WEBSITE.md`. Design/performance authority: `INSTRUCT_DESIGN_UI.md` §22–30. Architecture organisation: `documents/architecture/sim-adoption-decision-20260912.md` (apps/* + packages/* with real consumers). Founder decisions in `documents/platform/TECH_PREPARE.md` §4 (Vite app, Astro site, React Flow, one WebGL canvas per page) are honoured where they do not conflict with the prompt.

## 1. Product framing

3Dads turns a product reference (image or catalog fixture) plus a creative brief into 3D advertising scenes, animations and ad variants for ecommerce teams. Journey: **reference → brief → workflow → 3D scene → animation/ad variants → review → export**.

This phase ships a complete, tested frontend against a **stateful mock transport**. Nothing calls an LLM, generation provider, harness, payment or email service. Every screen calls typed service interfaces; the mock adapter is initialised explicitly and labelled "Demo workspace".

## 2. Monorepo layout (pnpm workspaces)

```
apps/marketing        Astro 7, static, zero React; islands are small vanilla scripts. Served at /
apps/web              Vite 8 + React 19 + TS. TanStack Router (code-based, lazy routes), TanStack Query, zustand. Served at /app/
packages/contracts    Domain types, service interfaces, run state machine, returnTo validation, catalog (templates, plans, fixtures metadata)
packages/ui           Design tokens (CSS), base styles, small React primitives (Button, Field, Dialog, Tabs, Badge, Toast…) — consumed by apps/web; tokens.css consumed by apps/marketing
packages/viewer-3d    Plain Three.js demand-rendered ProductViewer, procedural product fixtures, animation presets — consumed by apps/web (Studio) and by the marketing homepage demo island (lazy, on intent)
scripts/              preview-server (one origin: / = marketing, /app = web SPA), bundle-report, reset-fixtures, poster rendering
tests/e2e             Playwright journeys, a11y, screenshots against the production preview
tests/perf            Playwright + CDP measurement scripts (web vitals lab, frame-time, memory plateau, bundle)
docs/                 Plan, budgets, report, routes matrix, mock scenarios, QA, harness contract
fixtures/             Real downloadable sample media (ffmpeg-generated MP4, labelled sample), generated posters
```

Dependency rule: apps import packages; packages never import apps; `contracts` has zero runtime deps; `ui` never imports `viewer-3d`; marketing never imports React, React Flow or Three.js in its initial bundle.

Runtime: Node 22+ (tested on 25.5), pnpm 10.

## 3. Route coverage

### Marketing (Astro, prerendered)
| Route | Content | Interactive islands |
| --- | --- | --- |
| `/` | Hero, product demo (poster + on-intent 3D viewer), representative outputs, how it works, capabilities, example templates, control/trust, pricing entry, FAQ, CTA | nav menu (vanilla), 3D demo (lazy viewer-3d) |
| `/product` | Workflow explanation, node catalogue, run states, editing, export | none |
| `/templates` | Searchable/filterable gallery | vanilla search/filter script |
| `/templates/[slug]` | Detail: outcome, inputs, deliverable, limits, sample output, "Use template" → app | none |
| `/pricing` | Monthly/yearly segmented control, three illustrative plans, usage unit, comparison table, FAQ | vanilla interval toggle (updates plan links) |
| `/help`, `/help/[slug]` | Quickstart, concepts, troubleshooting, exports, demo limits, FAQ | none |
| `/legal/privacy`, `/legal/terms` | Drafts labelled demo content | none |
| `/404` | Useful not-found | none |

### App (Vite SPA under `/app/`)
| Route | Purpose |
| --- | --- |
| `/app/signin`, `/app/signup`, `/app/recover` | Fixture identities; preserve `returnTo`, `template`, `plan`, `interval` |
| `/app` | Dashboard: recent projects, active runs, search/filter, create/duplicate/rename/archive/delete, empty state |
| `/app/projects/new` | From template or uploaded image + product description + campaign brief |
| `/app/projects/$projectId` | Workspace: Overview / Workflow (canvas + list) / Studio (3D, timeline, ad composition, variants, versions) / Outputs; composer; inspector; run history |
| `/app/library` | Asset/output library: search/filter, provenance, versions, preview, download |
| `/app/settings/{profile,workspace,notifications,members,billing}` | Settings |
| `/app/billing/checkout`, `/app/billing/return` | Simulated checkout + reconciliation |
| `/app/dev/scenarios` | Documented scenario selector (unobtrusive; also `?scenario=`) |
| `/app/*` | In-app 404, expired session, denied, offline banners are states, not routes |

## 4. Component boundaries

- **Data layer** (`apps/web/src/services`): `PlatformServices` interface from contracts; `createMockServices()` (explicit init in `main.tsx`), `createRealServices()` stub that throws `NotConfiguredError` — never silent fallback. Hooks (`useProjectsQuery`, `useRunSubscription`, …) are the only way screens reach services.
- **Mock backend** (`services/mock/backend.ts`): in-memory domain state per workspace, persisted to IndexedDB with bounded retention; virtual clock + persisted scheduler (runs continue across navigation and reload); operation-id dedup; sequence-numbered event log with bounded replay; scenario/latency injection in `transport.ts`, separated from domain logic.
- **Editor state** (zustand): `workflowStore` (document + undo/redo + dirty), `sceneStore` (scene + ad composition + undo/redo), `uiStore` (selection, panels, view mode). Persisted through services at edit boundaries.
- **Renderer** (`packages/viewer-3d`): imperative class; React wrapper only bridges props → viewer methods and stats → small status component. No per-frame React state.
- **Graph** (`@xyflow/react`): custom node/edge types, narrow selectors, progress patches by node id.

## 5. Mock contracts (summary; full detail in docs/MOCK_SCENARIOS.md and docs/HARNESS_INTEGRATION_CONTRACT.md)

- Commands carry `operationId`; repeated ids return the original result.
- Run states: `draft → queued → running → (waiting_input | paused) → running → completed | failed | cancelled`; `cancelling` settles to `cancelled`. Transition table is executable (`contracts/runs.ts`).
- Events: `{seq, runId, at, type, payload}`; subscribe with cursor; buffer 200 per run; gap ⇒ snapshot.
- Artifacts have `revision` numbers and `acceptance: 'unreviewed' | 'accepted' | 'rejected'`, separate from run status and preview availability.
- Billing: checkout sessions with server-held status; return page reconciles by `checkoutId`; entitlements only from subscription state.

## 6. User journeys (E2E targets)
1. Home → template → signup → project created from that template.
2. Upload reference → brief → run → inspect 3D output.
3. Edit scene/ad text → undo/redo → play/scrub → aspect → save/reload.
4. Start run → leave → return → status recovered, no duplicate run.
5. Cancel → retry/duplicate → prior artifacts kept; late events ignored.
6. Versions → choose → export → download → validate bytes/type.
7. Pricing → sign-in → checkout → pending/success/failure/cancel → entitlement + return.
8. Sign out → another user → no leakage.
9. Keyboard-only, reduced motion, mobile step list, offline recovery, no-WebGL fallback.

## 7. Performance budgets
Recorded in `docs/PERFORMANCE_BUDGETS.md` before implementation grows; measured in `docs/PERFORMANCE_REPORT.md`.

## 8. Test strategy
- `vitest`: contracts (state machine, returnTo), mock backend (dedup, stale events, cancellation, billing reconciliation, retention, scoping), stores (undo/redo).
- Playwright against `pnpm build && pnpm preview` (single origin, production assets): journeys, control matrix, axe on key pages, screenshots at 390/768/1280/1440, console/resource/broken-link checks.
- Perf scripts: lab LCP/CLS/INP-proxy, route chunk sizes (gzip), first-useful-editor-frame, frame-time distribution during orbit/playback, idle-render check, heap plateau over repeated mount/unmount.

## 9. Execution order
1. Contracts + catalog → 2. mock backend + transport + unit tests → 3. viewer-3d + fixtures → 4. ui package → 5. web app shell, auth, dashboard, create → 6. workspace (workflow, studio, outputs, composer) → 7. library, settings, billing → 8. marketing site → 9. preview server, E2E, a11y, screenshots → 10. perf measurement + fixes → 11. docs + DEBUG entry.

## 10. Assumptions recorded
- Brand copy is English, centralised in `apps/web/src/i18n/en.ts` and Astro content; Inter variable font (self-hosted via fontsource) covers Vietnamese diacritics.
- Prices are illustrative and labelled; no customer logos or testimonials.
- Product fixtures are authored procedurally in code (legally reusable); uploaded images are shown/saved as real previews, downstream geometry is a labelled demonstration fixture.
- "MP4 render" is a simulated queue delivering a labelled sample MP4; PNG snapshot, WebM browser recording and scene JSON are real exports of the user's edited scene.
- shadcn/ui and `motion` (TECH_PREPARE proposals) are not installed: the primitive set is small and hand-written on the design-guide tokens; adopting a registry later does not change screen code.

## Status
See "Completion status" appended at the end of implementation.

## Completion status (2026-09-12)

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo (pnpm): apps/marketing, apps/web, packages/contracts, packages/ui, packages/viewer-3d | Done | Dependency direction respected; viewer-3d consumed by app and by the marketing on-intent island |
| Contracts, run state machine, media-typed node catalogue | Done | `packages/contracts`; 21 unit tests |
| Stateful mock adapter (persisted scheduler, event log, idempotency, billing reconciliation, scenarios) | Done | `apps/web/src/services/mock`; explicit init, no silent fallback |
| Public site: home, product, templates (+detail), pricing, help (+5 articles), legal drafts, 404 | Done | Astro static, zero React; posters rendered from the real viewer |
| Auth flows, dashboard, project creation, library, settings ×5, checkout/return, scenarios page | Done | |
| Flows-style workflow canvas (typed ports, prompt+Run per node, floating footer, "…" menu, context menu, palette, quick actions, toolbar, modes, runs drawer) + list view | Done | Added after founder feedback (ElevenLabs Flows reference) |
| 3D studio (demand-rendered viewer, scene/ad controls, timeline, versions, export PNG/WebM/JSON + simulated MP4) | Done | |
| Vitest, Playwright journeys/controls/a11y/mobile/screenshots, perf scripts | Done | Results in docs/QA_REPORT.md and docs/PERFORMANCE_REPORT.md |
| Harness integration | Not started by design | Contract documented in docs/HARNESS_INTEGRATION_CONTRACT.md |

Deviations from the original plan: the workflow inspector was replaced by the per-node floating footer on the canvas (kept in list view); node ports are media-typed (image/text/video/3D/scene/audio) with optional "any input" ports on generative nodes; comment nodes and image/video/TTS demo nodes were added to the catalogue.
