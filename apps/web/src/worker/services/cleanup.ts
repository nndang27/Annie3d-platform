import { WORKING_COPY_TTL_DAYS } from '@annie3d/contracts';
import type { Db } from '@annie3d/db';
import { type SQL, sql } from 'drizzle-orm';
import type { Env } from '../env';
import { bucketOf } from './assets';

const DAY = 24 * 60 * 60 * 1000;

/** When a working copy made or run now expires. */
export const workingCopyExpiry = (now = new Date()) => new Date(now.getTime() + WORKING_COPY_TTL_DAYS * DAY);

/** Every place an asset can be referenced from; an asset is deletable only when none match. */
const referenced = (asset: SQL) => sql`(
  EXISTS (SELECT 1 FROM node_version_outputs o WHERE o.asset_id = ${asset})
  OR EXISTS (SELECT 1 FROM node_versions v WHERE v.output_asset_id = ${asset})
  OR EXISTS (SELECT 1 FROM boards b WHERE b.thumbnail_asset_id = ${asset})
  OR EXISTS (SELECT 1 FROM export_files f WHERE f.asset_id = ${asset})
  OR EXISTS (SELECT 1 FROM reels r WHERE r.asset_id = ${asset})
  OR EXISTS (SELECT 1 FROM board_nodes n WHERE n.settings->>'assetId' = ${asset}::text)
)`;

const uuidList = (ids: string[]) =>
  sql.join(
    ids.map((x) => sql`${x}::uuid`),
    sql`, `,
  );

/**
 * Deletes expired desktop working copies (boards whose expires_at has passed), then the files
 * only they used, in the database and in R2. The user's `.annie3d` file keeps its own copy.
 *
 * Only assets an expired board referenced are candidates, and one is deleted only when nothing
 * else references it (the same bytes are stored once per workspace, so an ordinary board may
 * share them), it is not a shared public fixture, and it is older than a day (an upload still
 * waiting for its first reference is never touched).
 */
export async function purgeWorkingCopies(env: Env, db: Db, now = new Date(), limit = 25) {
  const expired = await db.execute<{ id: string }>(
    sql`SELECT id FROM boards WHERE expires_at < ${now} ORDER BY expires_at LIMIT ${limit}`,
  );
  const result = { boardsDeleted: 0, assetsDeleted: 0, objectsDeleted: 0 };
  for (const { id } of expired.rows) {
    const candidates = await db.execute<{ id: string }>(sql`
      SELECT o.asset_id AS id FROM node_version_outputs o JOIN node_versions v ON v.id = o.version_id
        WHERE v.board_id = ${id}
      UNION SELECT v.output_asset_id FROM node_versions v WHERE v.board_id = ${id} AND v.output_asset_id IS NOT NULL
      UNION SELECT (n.settings->>'assetId')::uuid FROM board_nodes n
        WHERE n.board_id = ${id} AND n.settings->>'assetId' ~ '^[0-9a-f-]{36}$'`);
    // Runs, steps, versions, nodes, edges, ops, shares and exports go with the board (FK cascade);
    // the credit ledger keeps its entries (run_id set null). A run since listing extends expiry.
    const del = await db.execute(sql`DELETE FROM boards WHERE id = ${id} AND expires_at < ${now}`);
    if (!del.rowCount) continue;
    result.boardsDeleted++;
    const ids = candidates.rows.map((r) => r.id);
    if (!ids.length) continue;
    // Variant rows go with their assets, so read their keys first.
    const variants = await db.execute<{ asset_id: string; storage_key: string }>(
      sql`SELECT asset_id, storage_key FROM asset_variants WHERE asset_id IN (${uuidList(ids)})`,
    );
    const gone = await db.execute<{ id: string; bucket: string; storage_key: string }>(sql`
      DELETE FROM assets a
      WHERE a.id IN (${uuidList(ids)})
        AND a.bucket <> 'public'
        AND a.created_at < ${new Date(now.getTime() - DAY)}
        AND NOT ${referenced(sql`a.id`)}
      RETURNING a.id, a.bucket, a.storage_key`);
    for (const a of gone.rows) {
      const bucket = bucketOf(env, a.bucket);
      await bucket.delete(a.storage_key);
      result.assetsDeleted++;
      result.objectsDeleted++;
      // Variant keys are content addressed and may be shared: delete only unused ones.
      for (const v of variants.rows.filter((x) => x.asset_id === a.id)) {
        const still = await db.execute(
          sql`SELECT 1 FROM asset_variants WHERE storage_key = ${v.storage_key} LIMIT 1`,
        );
        if (still.rows.length) continue;
        await bucket.delete(v.storage_key);
        result.objectsDeleted++;
      }
    }
  }
  return result;
}
