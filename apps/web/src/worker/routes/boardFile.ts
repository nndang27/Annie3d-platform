import {
  BOARD_FILE_MANIFEST,
  BOARD_FILE_MAX_BYTES,
  BoardFileManifest,
  type EngineOutput,
  type EngineVariant,
  extForMime,
  FILE_REF_SETTINGS,
  type GraphOp,
  generateKeyBetween,
  NODE_DEFS,
  newId,
  nextZKey,
} from '@annie3d/contracts';
import { nodeVersions } from '@annie3d/db';
import { eq, inArray } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { httpError, uuidParam } from '../lib/http';
import { requireEditor } from '../lib/session';
import { applyBatch, computeInputHashes, loadBoard, loadGraph, versionDtos } from '../services/boards';
import { artifactStore, persistVersion } from '../services/runner';

export const boardFileRoutes = new Hono<AppEnv>();

const u8ToBuffer = (u: Uint8Array) =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

/**
 * Import a `.annie3d` file into a board (signed-in). The ZIP is read here, its files are stored
 * in this workspace (content-addressed, so re-importing costs nothing), nodes get new ids at
 * (x, y), and each node's result becomes an "upload" version, so previews, exports and runs
 * work as if it had been made on this board. One undoable batch for the nodes and wires, one
 * for the result pointers.
 */
boardFileRoutes.post('/api/boards/:boardId/import', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const workspaceId = c.get('workspaceId')!;
  const userId = c.get('user')!.id;
  const lim = await c.env.RL_UPLOAD.limit({ key: userId });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many imports, slow down');
  if (Number(c.req.header('content-length') ?? 0) > BOARD_FILE_MAX_BYTES)
    throw httpError(413 as 400, 'bad_request', 'The file is larger than 80 MB');
  const raw = new Uint8Array(await c.req.arrayBuffer());
  if (raw.byteLength > BOARD_FILE_MAX_BYTES)
    throw httpError(413 as 400, 'bad_request', 'The file is larger than 80 MB');
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(raw);
  } catch {
    throw httpError(400, 'bad_request', 'Not an Annie 3D file');
  }
  const man = files[BOARD_FILE_MANIFEST];
  const parsed = man ? BoardFileManifest.safeParse(JSON.parse(strFromU8(man))) : null;
  if (!parsed?.success) throw httpError(400, 'bad_request', 'Not an Annie 3D file (or a newer version)');
  const m = parsed.data;
  const db = getDb(c);
  await loadBoard(db, workspaceId, boardId);

  // 1. Nodes and wires with fresh ids, placed with their top-left at (x, y).
  const x0 = Number(c.req.query('x') ?? 0) || 0;
  const y0 = Number(c.req.query('y') ?? 0) || 0;
  const minX = Math.min(...m.nodes.map((n) => n.x));
  const minY = Math.min(...m.nodes.map((n) => n.y));
  const ids = new Map(m.nodes.map((n) => [n.id, newId()]));
  // Fractional z-keys above everything on the board, in file order.
  let z = nextZKey((await loadGraph(db, boardId)).graph);
  const zKeys = m.nodes.map(() => {
    const k = z;
    z = generateKeyBetween(z, null);
    return k;
  });
  const create: GraphOp[] = m.nodes.map((n, i) => {
    const settings = { ...n.settings };
    for (const k of FILE_REF_SETTINGS) if (k in settings) settings[k] = null;
    return {
      type: 'node.create',
      node: {
        id: ids.get(n.id)!,
        kind: n.kind,
        x: Math.round(x0 + n.x - minX),
        y: Math.round(y0 + n.y - minY),
        label: n.label,
        settings,
        zKey: zKeys[i]!,
      },
    };
  });
  for (const e of m.edges) {
    const s = ids.get(e.source);
    const t = ids.get(e.target);
    if (s && t)
      create.push({
        type: 'edge.create',
        edge: { id: newId(), source: s, sourcePort: 'out', target: t, targetPort: e.targetPort },
      });
  }
  await applyBatch(db, workspaceId, userId, boardId, newId(), create);

  // 2. Results: store the files, create one version per node, point the nodes at them.
  const store = artifactStore(c.env, workspaceId);
  const kindOf = new Map(m.nodes.map((n) => [ids.get(n.id)!, n.kind]));
  const created: { nodeId: string; versionId: string }[] = [];
  for (const group of m.outputs) {
    const nodeId = ids.get(group.nodeId);
    if (!nodeId) continue;
    const outputs: EngineOutput[] = [];
    for (const f of group.files) {
      const bytes = files[f.path];
      if (!bytes) throw httpError(400, 'bad_request', `Missing ${f.path}`);
      const out = await store.putArtifact(u8ToBuffer(bytes), {
        kind: f.kind,
        mime: f.mime,
        ext: extForMime(f.mime),
        role: f.role,
        width: f.width ?? undefined,
        height: f.height ?? undefined,
        durationMs: f.durationMs ?? undefined,
        triangleCount: f.triangleCount ?? undefined,
      });
      const variants: EngineVariant[] = [];
      for (const v of f.variants) {
        const vb = files[v.path];
        if (!vb) continue;
        const put = await store.putFile(u8ToBuffer(vb), { ext: extForMime(v.mime), mime: v.mime });
        variants.push({
          variant: v.variant,
          ...put,
          mime: v.mime,
          width: v.width ?? undefined,
          height: v.height ?? undefined,
        });
      }
      outputs.push({ ...out, variants });
    }
    const versionId = await persistVersion(
      db,
      { workspaceId, boardId, runId: null, userId, source: 'upload' },
      nodeId,
      null, // the real input hash is recorded below, once the whole graph exists
      {},
      outputs,
      [],
    );
    created.push({ nodeId, versionId });
  }
  const rows = created.length
    ? await db
        .select()
        .from(nodeVersions)
        .where(
          inArray(
            nodeVersions.id,
            created.map((v) => v.versionId),
          ),
        )
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const point: GraphOp[] = created.map(({ nodeId, versionId }) => {
    const kind = kindOf.get(nodeId)!;
    // Input nodes also name their file in settings (like an upload).
    const input = NODE_DEFS[kind].category === 'input';
    return {
      type: 'node.update',
      id: nodeId,
      patch: {
        currentVersionId: versionId,
        ...(input ? { settings: { assetId: byId.get(versionId)?.outputAssetId ?? null } } : {}),
      },
    };
  });
  const res = point.length
    ? await applyBatch(db, workspaceId, userId, boardId, newId(), point)
    : { seq: 0, duplicate: false };

  // 3. The imported results are as fresh as their new inputs: record the hashes.
  const { graph } = await loadGraph(db, boardId);
  const hashes = await computeInputHashes(graph);
  for (const { nodeId, versionId } of created) {
    const h = hashes.get(nodeId);
    if (h) await db.update(nodeVersions).set({ inputHash: h }).where(eq(nodeVersions.id, versionId));
  }
  return c.json(
    {
      seq: res.seq,
      ops: [...create, ...point],
      nodeIds: [...ids.values()],
      versions: await versionDtos(
        db,
        c.env,
        created.map((v) => v.versionId),
      ),
    },
    201,
  );
});
