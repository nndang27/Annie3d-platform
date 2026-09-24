import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, inList, pk, tstz, updatedAt } from './_shared';
import { assets } from './assets';
import { users } from './auth';
import { runs } from './runs';
import { workspaces } from './workspaces';

export const NODE_KINDS = [
  'photo',
  'text',
  'upload3d',
  'audio',
  'model3d',
  'stage',
  'packshot',
  'adVideo',
  'export',
  'note',
] as const;
export const VERSION_SOURCES = ['run', 'edit', 'upload', 'agent'] as const;
export const OUTPUT_ROLES = ['primary', 'poster', 'turntable', 'packshot', 'report', 'extra'] as const;

export const boards = pgTable(
  'boards',
  {
    id: pk(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    /** Monotonic sequence of applied op batches (Linear-style sync id). */
    seq: bigint({ mode: 'number' }).notNull().default(0),
    thumbnailAssetId: uuid().references(() => assets.id, { onDelete: 'set null' }),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tstz(),
  },
  (t) => [
    check('boards_title_len', sql`length(${t.title}) BETWEEN 1 AND 120`),
    check('boards_seq_chk', sql`${t.seq} >= 0`),
    index('boards_workspace_recent_idx')
      .on(t.workspaceId, t.updatedAt.desc())
      .where(sql`${t.archivedAt} IS NULL`),
    index('boards_thumbnail_idx').on(t.thumbnailAssetId),
    index('boards_created_by_idx').on(t.createdBy),
  ],
);

/**
 * Nodes are records keyed by client-generated UUIDv7. Deletes are tombstones (`deleted_at`) so
 * undo can revive the same id and sync can tell "deleted" from "never existed"
 * (Excalidraw `isDeleted`; Figma explicit delete ops).
 */
export const boardNodes = pgTable(
  'board_nodes',
  {
    id: uuid().primaryKey(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    x: doublePrecision().notNull(),
    y: doublePrecision().notNull(),
    label: text(),
    settings: jsonb().notNull().default({}),
    /** Fractional index; compared byte-wise (COLLATE "C", set in migration 0001). */
    zKey: text().notNull(),
    rowVersion: integer().notNull().default(1),
    currentVersionId: uuid().references((): AnyPgColumn => nodeVersions.id, { onDelete: 'set null' }),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tstz(),
  },
  (t) => [
    check('board_nodes_kind_chk', sql`${t.kind} IN (${inList(NODE_KINDS)})`),
    check('board_nodes_label_len', sql`${t.label} IS NULL OR length(${t.label}) <= 120`),
    check('board_nodes_settings_obj', sql`jsonb_typeof(${t.settings}) = 'object'`),
    check('board_nodes_coords_chk', sql`abs(${t.x}) <= 1e7 AND abs(${t.y}) <= 1e7`),
    check('board_nodes_zkey_len', sql`length(${t.zKey}) BETWEEN 1 AND 64`),
    index('board_nodes_board_live_idx').on(t.boardId).where(sql`${t.deletedAt} IS NULL`),
    index('board_nodes_workspace_idx').on(t.workspaceId),
    index('board_nodes_current_version_idx').on(t.currentVersionId),
    index('board_nodes_created_by_idx').on(t.createdBy),
  ],
);

export const boardEdges = pgTable(
  'board_edges',
  {
    id: uuid().primaryKey(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceNodeId: uuid()
      .notNull()
      .references(() => boardNodes.id, { onDelete: 'cascade' }),
    sourcePort: text().notNull().default('out'),
    targetNodeId: uuid()
      .notNull()
      .references(() => boardNodes.id, { onDelete: 'cascade' }),
    targetPort: text().notNull(),
    createdAt: createdAt(),
    deletedAt: tstz(),
  },
  (t) => [
    check('board_edges_source_port_chk', sql`${t.sourcePort} = 'out'`),
    check('board_edges_target_port_chk', sql`${t.targetPort} ~ '^[a-z][a-zA-Z0-9]{0,31}$'`),
    check('board_edges_no_self_loop', sql`${t.sourceNodeId} <> ${t.targetNodeId}`),
    uniqueIndex('board_edges_live_uq')
      .on(t.sourceNodeId, t.targetNodeId, t.targetPort)
      .where(sql`${t.deletedAt} IS NULL`),
    index('board_edges_board_live_idx').on(t.boardId).where(sql`${t.deletedAt} IS NULL`),
    index('board_edges_target_idx').on(t.targetNodeId),
    index('board_edges_workspace_idx').on(t.workspaceId),
  ],
);

/**
 * Append-only op log: sync after reconnect, undo history across sessions, process reels.
 * `op_id` makes batches idempotent. Partition by `created_at` when it grows (schema-design.md).
 */
export const boardOps = pgTable(
  'board_ops',
  {
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    seq: bigint({ mode: 'number' }).notNull(),
    opId: uuid().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    ops: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.boardId, t.seq] }),
    uniqueIndex('board_ops_op_id_uq').on(t.boardId, t.opId),
    check('board_ops_ops_array', sql`jsonb_typeof(${t.ops}) = 'array'`),
    index('board_ops_actor_idx').on(t.actorId),
  ],
);

/** Every output of a runnable node is a version; nothing is overwritten (F9). */
export const nodeVersions = pgTable(
  'node_versions',
  {
    id: pk(),
    nodeId: uuid()
      .notNull()
      .references(() => boardNodes.id, { onDelete: 'cascade' }),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    versionNo: integer().notNull(),
    source: text().notNull(),
    runId: uuid().references((): AnyPgColumn => runs.id, { onDelete: 'set null' }),
    parentVersionId: uuid().references((): AnyPgColumn => nodeVersions.id, { onDelete: 'set null' }),
    outputAssetId: uuid().references(() => assets.id, { onDelete: 'set null' }),
    /** Snapshot of settings/prompt used; keeps history meaningful after the node changes. */
    params: jsonb().notNull().default({}),
    gates: jsonb().notNull().default([]),
    inputHash: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('node_versions_node_no_uq').on(t.nodeId, t.versionNo),
    check('node_versions_no_chk', sql`${t.versionNo} > 0`),
    check('node_versions_source_chk', sql`${t.source} IN (${inList(VERSION_SOURCES)})`),
    check('node_versions_params_obj', sql`jsonb_typeof(${t.params}) = 'object'`),
    check('node_versions_gates_arr', sql`jsonb_typeof(${t.gates}) = 'array'`),
    check('node_versions_hash_chk', sql`${t.inputHash} IS NULL OR ${t.inputHash} ~ '^[0-9a-f]{64}$'`),
    index('node_versions_board_idx').on(t.boardId),
    index('node_versions_workspace_idx').on(t.workspaceId),
    index('node_versions_run_idx').on(t.runId),
    index('node_versions_parent_idx').on(t.parentVersionId),
    index('node_versions_output_asset_idx').on(t.outputAssetId),
    index('node_versions_created_by_idx').on(t.createdBy),
  ],
);

/** A version can have several files (4 packshots, poster, turntable clip, report). */
export const nodeVersionOutputs = pgTable(
  'node_version_outputs',
  {
    versionId: uuid()
      .notNull()
      .references(() => nodeVersions.id, { onDelete: 'cascade' }),
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    role: text().notNull(),
    position: smallint().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.versionId, t.assetId] }),
    check('node_version_outputs_role_chk', sql`${t.role} IN (${inList(OUTPUT_ROLES)})`),
    index('node_version_outputs_asset_idx').on(t.assetId),
  ],
);
