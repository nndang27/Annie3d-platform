# Harness integration contract (future; not implemented)

The frontend talks to `PlatformServices` (`packages/contracts/src/services.ts`). Replacing the demo adapter means implementing that interface against the real API and selecting it in `apps/web/src/services/bootstrap.ts` (`VITE_SERVICES_MODE=live`). No screen imports mock code; no `if (mock)` branches exist in components.

## Commands (mutations)

All mutations carry a client-generated `operationId` (`newOperationId()`, 16 hex chars). The server must treat a repeated `operationId` as the same command and return the original result. Proposed HTTP mapping (Hono API, per TECH_PREPARE 2.2):

| Service method | Proposed endpoint | Notes |
| --- | --- | --- |
| `projects.create` | `POST /v1/projects` | multipart when `reference.source = upload`; returns `Project` |
| `projects.saveScene` | `PUT /v1/projects/:id/scene` | `baseRevision` → 409 `conflict` on mismatch |
| `workflows.save` | `PUT /v1/workflows/:id` | `baseRevision` optimistic concurrency |
| `runs.start` | `POST /v1/projects/:id/runs` | body `{ workflowId, operationId, onlyNodeId? }`; 202 with `Run` (`queued`) or 409 if a run is active |
| `runs.cancel` / `pause` / `resume` / `answerInput` / `retry` | `POST /v1/runs/:id/{cancel,pause,resume,answer,retry}` | transitions must follow `canTransition` |
| `artifacts.setAcceptance` | `PATCH /v1/artifacts/:id` | acceptance is user state, separate from run status |
| `artifacts.storeBrowserExport` | `POST /v1/artifacts/browser-export` | multipart blob + `scene`/`ad` JSON |
| `exports.enqueue` | `POST /v1/exports` | returns `ExportJob` |
| `billing.createCheckout` | `POST /v1/billing/checkout` | server computes price from `planId`+`interval`; returns hosted URL in the live product |
| `billing.reconcile` | `POST /v1/billing/checkout/:id/reconcile` | idempotent fulfilment; webhook is authoritative |

## Events

`runs.subscribe(runId, cursor, onEvent, onGap)` expects an ordered stream of `RunEvent { seq, runId, at, type, payload }` with per-run monotonically increasing `seq`. Proposed transport: SSE `GET /v1/runs/:id/events?cursor=<seq>` (or WebSocket relay). The server replays events with `seq > cursor` from a bounded buffer; when the cursor is older than the buffer, it responds with `{ gap: true, snapshot: Run }` and the client reconciles from the snapshot. The client:

- ignores events with `seq <= cursor` or a different `runId`;
- coalesces `step.progress` into ≤ ~12 UI updates/s;
- applies terminal events promptly, then fetches `GET /v1/runs/:id` to reconcile;
- re-subscribes from its cursor after reconnect.

Event types: `run.accepted, run.started, step.started, step.progress, step.completed, step.failed, artifact.created, run.waiting_input, run.resumed, run.paused, run.cancelling, run.cancelled, run.completed, run.failed, run.log`.

## Node graph and ports

Nodes are typed by `NODE_KINDS` (`packages/contracts/src/workflow.ts`). Ports are media-typed (`image`, `text`, `video`, `model3d`, `scene`, `audio`, `approval`); generative nodes expose optional "any input" ports plus their required ones. The server receives the same `WorkflowDoc` (nodes with `settings.prompt`, `settings.engine`, per-kind settings; edges by port id) and must apply the same `checkConnection` rules before accepting a save or a run. Engine names shown on nodes come from `settings.engine` and must map to real provider/model identifiers in the live adapter.

## Artifact references

`Artifact.preview` is a discriminated union: `{ kind: 'image', blobKey }` (a server URL in the live product), `{ kind: 'fixture', fixtureId }` (demo only) or `{ kind: 'none' }`. For real reconstructions add `{ kind: 'model', url, format: 'glb', lod?: string[] }` and extend `packages/viewer-3d` with a `GLTFLoader` path (meshopt/KTX2 per TECH_PREPARE 4.5). Canonical geometry stays server-side; the viewer consumes display proxies with stable part ids so selection and edits survive optimisation.

`Artifact.scene`/`ad` carry the editable documents; browser exports keep them alongside the rendered file so scene data is always exportable separately from media.

## Engine EditOps (TECH_PREPARE 1.4)

The studio currently edits `SceneDoc`/`AdComposition` locally and saves revisions. With a live engine, the same edits become `EditOp`s (`scene.set`, `placement.set`, `material.set`, `animation.set`, `ad.set`) sent to `PUT /v1/projects/:id/scene`; the viewer applies them optimistically and the engine confirms by re-rendering previews.

## What the mock does that the live adapter must also do

- Persist accepted work independently of the browser (runs survive reloads).
- Deduplicate commands by `operationId`.
- Never grant entitlements from a client query string.
- Report `session_expired`, `forbidden`, `usage_limit`, `conflict`, `not_found`, `rate_limited` with the `ServiceError` codes in `packages/contracts/src/errors.ts` so existing UI recovery paths work unchanged.
