import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, inList, pk, updatedAt } from './_shared';
import { users } from './auth';
import { workspaces } from './workspaces';

export const ASSET_KINDS = ['image', 'model3d', 'video', 'audio', 'text', 'file'] as const;
export const BUCKETS = ['uploads', 'artifacts', 'public'] as const;
export const ASSET_STATUSES = ['pending', 'ready', 'failed'] as const;

/**
 * Files live in R2; rows hold metadata only (tldraw sync: "large binary assets are stored
 * separately"). Content-addressed by sha256 so the same upload is stored once per workspace.
 */
export const assets = pgTable(
  'assets',
  {
    id: pk(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    mime: text().notNull(),
    byteSize: bigint({ mode: 'number' }).notNull(),
    sha256: text().notNull(),
    bucket: text().notNull(),
    /**
     * Unique per object, except in the PUBLIC bucket: shared immutable fixtures (the example
     * board) are referenced by many workspaces without copying (never deleted, so sharing is safe).
     */
    storageKey: text().notNull(),
    status: text().notNull().default('pending'),
    width: integer(),
    height: integer(),
    durationMs: integer(),
    triangleCount: integer(),
    originalFilename: text(),
    meta: jsonb().notNull().default({}),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('assets_kind_chk', sql`${t.kind} IN (${inList(ASSET_KINDS)})`),
    check('assets_bucket_chk', sql`${t.bucket} IN (${inList(BUCKETS)})`),
    check('assets_status_chk', sql`${t.status} IN (${inList(ASSET_STATUSES)})`),
    check('assets_size_chk', sql`${t.byteSize} > 0`),
    check('assets_sha256_chk', sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
    check('assets_meta_obj', sql`jsonb_typeof(${t.meta}) = 'object'`),
    check(
      'assets_dims_chk',
      sql`(${t.width} IS NULL OR ${t.width} > 0) AND (${t.height} IS NULL OR ${t.height} > 0)`,
    ),
    // Dedupe: one ready asset per (workspace, content, kind).
    uniqueIndex('assets_dedupe_uq').on(t.workspaceId, t.sha256, t.kind).where(sql`${t.status} = 'ready'`),
    uniqueIndex('assets_storage_key_uq').on(t.storageKey).where(sql`${t.bucket} <> 'public'`),
    index('assets_workspace_created_idx').on(t.workspaceId, t.createdAt.desc()),
    index('assets_created_by_idx').on(t.createdBy),
  ],
);

/** Derived files (thumbnails, posters, turntable clip, optimised GLBs) generated asynchronously. */
export const assetVariants = pgTable(
  'asset_variants',
  {
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    variant: text().notNull(),
    mime: text().notNull(),
    byteSize: bigint({ mode: 'number' }).notNull(),
    /** Not unique: variants of shared public fixtures point at the same object. */
    storageKey: text().notNull(),
    width: integer(),
    height: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.assetId, t.variant] }),
    index('asset_variants_storage_key_idx').on(t.storageKey),
    check('asset_variants_variant_chk', sql`${t.variant} ~ '^[a-z0-9_]{2,40}$'`),
    check('asset_variants_size_chk', sql`${t.byteSize} > 0`),
  ],
);
