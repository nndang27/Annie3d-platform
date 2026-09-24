import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, inList, pk, tstz, updatedAt } from './_shared';
import { assets } from './assets';
import { users } from './auth';
import { boardNodes, boards, nodeVersions } from './boards';
import { workspaces } from './workspaces';

export const RUN_KINDS = ['graph', 'edit', 'export', 'agent'] as const;
export const RUN_SCOPES = ['node', 'from_here', 'with_upstream', 'all'] as const;
export const RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial'] as const;
export const STEP_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'skipped', 'cached'] as const;

export const runs = pgTable(
  'runs',
  {
    id: pk(),
    boardId: uuid().notNull().references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    requestedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    kind: text().notNull().default('graph'),
    scope: text().notNull(),
    rootNodeId: uuid(),
    status: text().notNull().default('queued'),
    estimatedCredits: integer().notNull(),
    chargedCredits: integer().notNull().default(0),
    /** Retried POSTs with the same key return the same run (idempotency). */
    idempotencyKey: uuid().notNull(),
    /** True when this run consumed the workspace's one free run. */
    usedFreeRun: boolean().notNull().default(false),
    errorCode: text(),
    lastEventSeq: integer().notNull().default(0),
    /** Region-edit and export parameters (F8, F6). */
    params: jsonb().notNull().default({}),
    createdAt: createdAt(),
    startedAt: tstz(),
    finishedAt: tstz(),
  },
  (t) => [
    uniqueIndex('runs_idempotency_uq').on(t.workspaceId, t.idempotencyKey),
    check('runs_kind_chk', sql`${t.kind} IN (${inList(RUN_KINDS)})`),
    check('runs_scope_chk', sql`${t.scope} IN (${inList(RUN_SCOPES)})`),
    check('runs_status_chk', sql`${t.status} IN (${inList(RUN_STATUSES)})`),
    check('runs_credits_chk', sql`${t.estimatedCredits} >= 0 AND ${t.chargedCredits} >= 0`),
    check('runs_params_obj', sql`jsonb_typeof(${t.params}) = 'object'`),
    check('runs_finish_chk', sql`${t.finishedAt} IS NULL OR ${t.finishedAt} >= ${t.createdAt}`),
    index('runs_board_recent_idx').on(t.boardId, t.createdAt.desc()),
    index('runs_active_idx').on(t.workspaceId, t.status).where(sql`${t.status} IN ('queued', 'running')`),
    index('runs_requested_by_idx').on(t.requestedBy),
  ],
);

export const runSteps = pgTable(
  'run_steps',
  {
    id: pk(),
    runId: uuid().notNull().references(() => runs.id, { onDelete: 'cascade' }),
    nodeId: uuid().references(() => boardNodes.id, { onDelete: 'set null' }),
    seq: smallint().notNull(),
    status: text().notNull().default('pending'),
    credits: integer().notNull().default(0),
    cacheHit: boolean().notNull().default(false),
    inputHash: text(),
    outputVersionId: uuid().references((): AnyPgColumn => nodeVersions.id, { onDelete: 'set null' }),
    errorCode: text(),
    errorMessage: text(),
    gate: text(),
    startedAt: tstz(),
    finishedAt: tstz(),
  },
  (t) => [
    uniqueIndex('run_steps_run_seq_uq').on(t.runId, t.seq),
    check('run_steps_status_chk', sql`${t.status} IN (${inList(STEP_STATUSES)})`),
    check('run_steps_credits_chk', sql`${t.credits} >= 0`),
    check('run_steps_msg_len', sql`${t.errorMessage} IS NULL OR length(${t.errorMessage}) <= 500`),
    check('run_steps_hash_chk', sql`${t.inputHash} IS NULL OR ${t.inputHash} ~ '^[0-9a-f]{64}$'`),
    index('run_steps_node_idx').on(t.nodeId),
    index('run_steps_output_version_idx').on(t.outputVersionId),
  ],
);

/**
 * Per-node result cache keyed by hash(kind, settings, inputs, engine version): "Run from here"
 * never recomputes unchanged upstream nodes. Scoped per workspace for privacy.
 */
export const resultCache = pgTable(
  'result_cache',
  {
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    inputHash: text().notNull(),
    nodeKind: text().notNull(),
    engineVersion: text().notNull(),
    versionId: uuid().notNull().references(() => nodeVersions.id, { onDelete: 'cascade' }),
    hitCount: integer().notNull().default(0),
    createdAt: createdAt(),
    lastHitAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.inputHash] }),
    check('result_cache_hash_chk', sql`${t.inputHash} ~ '^[0-9a-f]{64}$'`),
    index('result_cache_version_idx').on(t.versionId),
  ],
);

/** Jobs sent to external engines (External Engine Protocol v1, packages/contracts/src/engine.ts). */
export const engineJobs = pgTable(
  'engine_jobs',
  {
    id: pk(),
    runStepId: uuid().notNull().references(() => runSteps.id, { onDelete: 'cascade' }),
    engine: text().notNull(),
    status: text().notNull().default('dispatched'),
    /** SHA-256 of the per-job callback secret; the secret itself is never stored. */
    callbackSecretHash: text().notNull(),
    request: jsonb().notNull(),
    lastCallback: jsonb(),
    deadlineAt: tstz().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('engine_jobs_status_chk', sql`${t.status} IN ('dispatched', 'running', 'succeeded', 'failed', 'expired')`),
    index('engine_jobs_step_idx').on(t.runStepId),
    index('engine_jobs_open_idx').on(t.deadlineAt).where(sql`${t.status} IN ('dispatched', 'running')`),
  ],
);

export const reels = pgTable(
  'reels',
  {
    id: pk(),
    runId: uuid().notNull().references(() => runs.id, { onDelete: 'cascade' }),
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    mode: text().notNull(),
    status: text().notNull().default('queued'),
    assetId: uuid().references(() => assets.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('reels_mode_chk', sql`${t.mode} IN ('client', 'server')`),
    check('reels_status_chk', sql`${t.status} IN ('queued', 'rendering', 'ready', 'failed')`),
    index('reels_run_idx').on(t.runId),
    index('reels_workspace_idx').on(t.workspaceId),
    index('reels_asset_idx').on(t.assetId),
  ],
);

export const exports = pgTable(
  'exports',
  {
    id: pk(),
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid().notNull().references(() => boards.id, { onDelete: 'cascade' }),
    nodeId: uuid().references(() => boardNodes.id, { onDelete: 'set null' }),
    versionId: uuid().references(() => nodeVersions.id, { onDelete: 'set null' }),
    idempotencyKey: uuid().notNull(),
    preset: text(),
    status: text().notNull().default('queued'),
    report: jsonb(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    finishedAt: tstz(),
  },
  (t) => [
    uniqueIndex('exports_idempotency_uq').on(t.workspaceId, t.idempotencyKey),
    check('exports_status_chk', sql`${t.status} IN ('queued', 'running', 'succeeded', 'failed')`),
    check('exports_preset_chk', sql`${t.preset} IS NULL OR ${t.preset} IN ('web', 'google_merchant', 'google_swirl')`),
    index('exports_board_idx').on(t.boardId),
    index('exports_node_idx').on(t.nodeId),
    index('exports_version_idx').on(t.versionId),
    index('exports_created_by_idx').on(t.createdBy),
  ],
);

export const exportFiles = pgTable(
  'export_files',
  {
    exportId: uuid().notNull().references(() => exports.id, { onDelete: 'cascade' }),
    assetId: uuid().notNull().references(() => assets.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.exportId, t.assetId] }), index('export_files_asset_idx').on(t.assetId)],
);
