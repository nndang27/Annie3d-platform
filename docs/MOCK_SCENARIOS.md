# Mock scenarios, seeds and simulated capabilities

The app runs against a **stateful demo adapter** (`apps/web/src/services/mock/`). It is selected explicitly in `main.tsx` via `VITE_SERVICES_MODE` (default `demo`); `live` selects a stub that throws `not_configured` — there is no silent fallback. The header shows a **Demo workspace** chip whenever the demo adapter is active.

## Architecture

| File | Responsibility |
| --- | --- |
| `backend.ts` | Domain rules: session, projects, workflows, runs (engine), artifacts, exports, billing, workspace, notifications. Pure of latency/failure injection. |
| `scheduler.ts` | Persisted task scheduler. Simulated backend work is stored as tasks in workspace state; one timer wakes for the earliest task; `clock.advance()` runs due tasks synchronously; successors of a late task are scheduled relative to the task's due time so a reload catches up on work that "happened" while the tab was closed. |
| `clock.ts` | Virtual clock (real time + offset). |
| `store.ts` | IndexedDB (`annie3d-demo`, stores `state` and `blobs`) with in-memory fallback. |
| `state.ts` | State shape, fixture identities, seeds and retention limits. |
| `transport.ts` | Latency and scenario injection, connectivity state, 429/timeouts. |
| `services.ts` | Builds the `PlatformServices` interface from backend + transport. |
| `scenarios.ts` | Scenario catalogue (below). |

## Seeds and identities

| Identity | Email | Workspace | Role | Dataset on first load |
| --- | --- | --- | --- | --- |
| Mai Tran | mai@lumen.demo | Lumen Skincare (`ws_lumen`, Studio plan, 112/300 credits used) | owner | typical (24 projects, 6 with seeded outputs, project 1 has 3 versions) |
| Sam Okafor | sam@lumen.demo | Lumen Skincare | viewer | shares `ws_lumen` |
| Alex Rivera | alex@northwind.demo | Northwind Audio (`ws_northwind`, Starter plan) | owner | small (3 projects) |
| Sign-up | any new email | new workspace, Starter | owner | empty |

Datasets: `small` = 3 projects, `typical` = 24, `stress` = 400 projects with one 60-node workflow (`n-extra-*` branches). Ids are deterministic (`proj_000xyz`) from a persisted counter.

Retention (`RETENTION` in `state.ts`): 200 events per run, 30 runs per project, 100 notifications, 50 scene revisions per project, 500 usage records, 100 export jobs, 1000 operation ids.

## Persistence and isolation

- Global state (`users`, `workspaces`, `members`, `session`) and one record per workspace (`ws:<id>`) are persisted ~80 ms after each mutation and immediately before sign-out.
- Only the signed-in workspace is loaded in memory; sign-out unloads it and the app clears the TanStack Query cache. Query keys always include the workspace id.
- Uploaded images and browser exports are stored as Blobs keyed `upload:<projectId>` / `artifact:<artifactId>`.
- Session TTL is 12 h; an expired session raises `session_expired` on the next authenticated call.

## Scenario selector

Set via any of:

- `/app/dev/scenarios` (account menu → "Demo scenarios (developer)")
- `?scenario=<id>` on any app URL
- `localStorage['annie3d.scenario']`, `localStorage['annie3d.latencyScale']`
- `window.__annie3d.setScenario(id)`, `window.__annie3d.setLatencyScale(n)` (tests)

| id | Behaviour | Expected UI |
| --- | --- | --- |
| `normal` | 120–260 ms per call; steps 0.7–1.6 s; queue 0.5 s | runs complete |
| `slow` | 0.9–1.8 s per call; steps 3–6 s | immediate acknowledgement, local pending state |
| `offline` | every call rejects `network`; live events dropped; connectivity `offline` | banner, edits kept locally, reconnect replays from cursor |
| `flaky` | first two calls of each operation name → `rate_limited` (429, retry-after) | reads auto-retry; mutations offer retry, never duplicate |
| `timeout` | mutations hang 8 s then `timeout` | retry with the same operation id is applied once |
| `run-failure` | model build fails at 60 % | failed run, specific error, retained outputs, retry reuses earlier steps |
| `partial-result` | model and scene succeed, animation fails | success and failure shown together |
| `waiting-input` | ad-variants step asks for a layout | question + options; answer resumes |
| `upload-reject` | uploads > 200 KB rejected | field error naming file, size and limit; other fields kept |
| `expired-session` | next authenticated call reports expiry | redirect to sign-in with `returnTo`, drafts kept |
| `denied-role` | mutations behave as viewer | explanation and recovery route |
| `missing-artifact` | artifact reads report not found | missing-artifact state, no fake download |
| `payment-pending` | successful checkout is only confirmed after a 4 s callback | return page pending → confirmed, entitlement granted once |

Latency scale multiplies every simulated delay (E2E uses 0.05; perf scripts use 0.05 and 0.3–0.6 where realistic timing matters). Frontend measurements never include this simulated backend time.

## Engine model

- `startRun` validates role, active-run exclusivity, connected inputs and credits, dedups by `operationId`, reserves credits and schedules `run.start`.
- Each executable node becomes a step with measured progress units (model: 12 views, scene: 3 passes, animation: 4×duration frames, variants: one per aspect, export: 2 files, image generation/edit: 4 steps, upscale: 6 tiles, video generation: 16 frames, text-to-speech: 3 segments).
- Generic media nodes (image generation/edit/upscale, video generation) produce labelled fixture renders/clips — never content derived from the prompt. Text-to-speech produces a real 16-bit WAV of a synthetic chime (`synthTone`), labelled as not being speech. The node prompt is recorded in the artifact provenance note.
- Steps emit `step.started` → `step.progress`… → `step.completed` + `artifact.created`; the run ends with `run.completed` / `run.failed` / `run.cancelled`. Credits are charged once per run id.
- Cancel: `cancelling` (pending ticks are removed) → `cancelled` after 350 ms; late ticks for non-running runs are dropped.
- Retry: new run with `retryOf`; completed steps of the prior run are marked `skipped` and reuse their artifact ids.
- Pause/resume, waiting-for-input and answer are explicit transitions validated by `canTransition`.
- Artifacts are versioned per lineage (`project:node:key`); `supersededBy` links revisions. A project's automatic selection only advances for the project's latest run and never when the user pinned a selection.
- Export queue: `mp4-render` jobs tick 24 frames, then fetch `/app/fixtures/sample-render.mp4` (ffmpeg test pattern, 3 s, H.264, tagged as a placeholder) and store it as an `export` artifact labelled *Sample media — not your scene*.
- Billing: checkout sessions are server-held; `reconcile(id)` is idempotent and grants entitlement once (`fulfilledAt`); a `success=true` query string is ignored.

## Test hooks (`window.__annie3d`)

`reset(dataset?)`, `reseed(dataset)`, `setScenario`, `setLatencyScale`, `getConfig`, `expireSession`, `clock.now/advance`, `backend` (live object), `pendingTasks()`, `viewers` (live `ProductViewer` instances), `marks()` (User Timing measures), `queryClient`.
