import {
  ExportRequest,
  type ExportResponse,
  GLB_PRESETS,
  type GlbPresetId,
  NODE_DEFS,
  type NodeKind,
  type ResolvedInput,
} from '@annie3d/contracts';
import { assetVariants, exportFiles, exports } from '@annie3d/db';
import { eq, inArray } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { z } from 'zod';
import { buildBundle } from '../engines/export';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, HttpError, httpError, uuidParam } from '../lib/http';
import { LocalizedError, tFor } from '../lib/i18n';
import { requireEditor, requireUser } from '../lib/session';
import { assetDto } from '../services/assets';
import { loadGraph } from '../services/boards';
import { artifactStore, ensureAssets, readAsset, resolveInputs } from '../services/runner';

export const exportRoutes = new Hono<AppEnv>();
type Db = ReturnType<typeof getDb>;

async function exportDto(c: Context<AppEnv>, db: Db, id: string): Promise<z.infer<typeof ExportResponse>> {
  const e = await db.query.exports.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!e) throw httpError(404, 'not_found', 'api.export.notFound');
  const links = await db.select().from(exportFiles).where(eq(exportFiles.exportId, id));
  const ids = links.map((l) => l.assetId);
  const [rows, variants] = ids.length
    ? await Promise.all([
        db.query.assets.findMany({ where: (t, { inArray }) => inArray(t.id, ids) }),
        db.select().from(assetVariants).where(inArray(assetVariants.assetId, ids)),
      ])
    : [[], []];
  // Zip first, then the files in bundle order.
  const order = (e.report as { order?: string[] } | null)?.order ?? ids;
  const files = [...rows]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((a) => assetDto(c.env, a, variants));
  const report = (e.report as { report?: z.infer<typeof ExportResponse>['report'] } | null)?.report ?? null;
  return { id: e.id, status: e.status as 'succeeded', files, report };
}

/**
 * F6: export a model version (from the editor) or an Export node's inputs as a checked bundle.
 * Runs inline: exports are lossless re-packs of files already in R2 (seconds, not minutes).
 * A retried request with the same idempotency key returns the same export.
 */
exportRoutes.post('/api/exports', requireEditor, async (c) => {
  const req = await body(c, ExportRequest);
  const db = getDb(c);
  const ws = c.get('workspaceId')!;
  const user = c.get('user')!;
  const dup = await db.query.exports.findFirst({
    where: (t, { and, eq }) => and(eq(t.workspaceId, ws), eq(t.idempotencyKey, req.idempotencyKey)),
  });
  if (dup) return c.json(await exportDto(c, db, dup.id));
  const node = await db.query.boardNodes.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.id, req.nodeId), eq(t.workspaceId, ws), isNull(t.deletedAt)),
  });
  if (!node) throw httpError(404, 'not_found', 'api.board.nodeNotFound');
  let inputs: ResolvedInput[];
  let versionId: string | null = null;
  if (node.kind === 'model3d' || node.kind === 'upload3d') {
    versionId = req.versionId ?? node.currentVersionId;
    const v = versionId
      ? await db.query.nodeVersions.findFirst({
          where: (t, { and, eq }) => and(eq(t.id, versionId!), eq(t.nodeId, node.id)),
        })
      : undefined;
    if (!v?.outputAssetId) throw httpError(400, 'bad_request', 'api.export.noModelYet');
    const a = await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, v.outputAssetId!) });
    inputs = [{ port: 'model', type: 'model3d', assetId: a!.id, mime: a!.mime, versionId: v.id }];
  } else if (node.kind === 'export') {
    const { graph } = await loadGraph(db, node.boardId);
    inputs = await resolveInputs(db, graph, node.id);
  } else {
    throw httpError(400, 'bad_request', 'api.export.wrongNode');
  }
  const settings = node.settings as { glbPreset?: string; includeMp4?: boolean; includePng?: boolean };
  const preset = (req.glbPreset ??
    (settings.glbPreset && settings.glbPreset in GLB_PRESETS ? settings.glbPreset : 'web')) as GlbPresetId;
  const store = artifactStore(c.env, ws);
  let bundle: Awaited<ReturnType<typeof buildBundle>>;
  try {
    bundle = await buildBundle(
      {
        putArtifact: store.putArtifact,
        readInput: (i) => readAsset(c.env, db, i.assetId!),
        progress: async () => {},
      },
      inputs,
      {
        preset,
        includeMp4: req.includeMp4,
        includePng: req.includePng,
        // English kind name when unnamed: file names stay stable across languages.
        name: node.label ?? NODE_DEFS[node.kind as NodeKind].label,
        t: tFor(c),
      },
    );
  } catch (e) {
    if (e instanceof LocalizedError) throw new HttpError(400, 'bad_request', e.key, e.params);
    throw httpError(400, 'bad_request', 'api.export.failed', { reason: (e as Error).message });
  }
  const id = crypto.randomUUID();
  await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    const ids = await ensureAssets(
      tx,
      { workspaceId: ws, boardId: node.boardId, runId: null, userId: user.id },
      bundle.outputs,
    );
    const unique = [...new Set(ids)];
    await tx.insert(exports).values({
      id,
      workspaceId: ws,
      boardId: node.boardId,
      nodeId: node.id,
      versionId,
      idempotencyKey: req.idempotencyKey,
      preset,
      status: 'succeeded',
      report: { report: bundle.report, order: unique, files: bundle.files },
      createdBy: user.id,
      finishedAt: new Date(),
    });
    await tx.insert(exportFiles).values(unique.map((assetId) => ({ exportId: id, assetId })));
  });
  return c.json(await exportDto(c, db, id), 201);
});

exportRoutes.get('/api/exports/:exportId', requireUser, async (c) => {
  return c.json(await exportDto(c, getDb(c), uuidParam(c, 'exportId')));
});
