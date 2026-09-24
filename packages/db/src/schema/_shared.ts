import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Conventions (postgres-best-practices skill, schema-design.md):
 * - snake_case identifiers, plural table names;
 * - UUIDv7 primary keys (`uuidv7()` is built into Postgres 18; time-ordered ids keep B-tree
 *   inserts local). Ids created by clients are also UUIDv7 (packages/contracts/src/ids.ts);
 * - timestamptz everywhere; `text` + CHECK instead of varchar(n) and instead of enum types for
 *   small value sets that may grow;
 * - every foreign key column is indexed (Postgres does not do it automatically);
 * - `workspace_id` on every tenant-owned table for RLS and tenant-leading composite indexes.
 */
export const pk = () => uuid().primaryKey().default(sql`uuidv7()`);
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const tstz = () => timestamp({ withTimezone: true });

/** Builds `col IN ('a','b')` for CHECK constraints from a TypeScript tuple. */
export function inList(values: readonly string[]) {
  return sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', '));
}
