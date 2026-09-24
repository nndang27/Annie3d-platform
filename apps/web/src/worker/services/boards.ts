import {
  applyOps,
  type BoardSnapshot,
  type EdgeRecord,
  type Graph,
  type GraphOp,
  graphFrom,
  NODE_DEFS,
  type NodeKind,
  type NodeRecord,
  type NodeVersionDto,
  OpError,
  STARTERS,
  type StarterId,
  starterGraph,
} from '@annie3d/contracts';
import {
  assets,
  assetVariants,
  boardEdges,
  boardNodes,
  boardOps,
  boards,
  type Db,
  nodeVersionOutputs,
  nodeVersions,
} from '@annie3d/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ENGINE_VERSIONS } from '../engines/versions';
import type { Env } from '../env';
import { httpError } from '../lib/http';
import { assetDto } from './assets';
import { type HashInput, inputHash, sha256Hex } from './hash';

type NodeRow = typeof boardNodes.$inferSelect;
type EdgeRow = typeof boardEdges.$inferSelect;

export function toRecord(n: NodeRow): NodeRecord {
  return {
    id: n.id,
    kind: n.kind as NodeKind,
    x: n.x,
    y: n.y,
    label: n.label,
    settings: n.settings as Record<string, unknown>,
    zKey: n.zKey,
    version: n.rowVersion,
    currentVersionId: n.currentVersionId,
  };
}
export function toEdge(e: EdgeRow): EdgeRecord {
  return {
    id: e.id,
    source: e.sourceNodeId,
    sourcePort: 'out',
    target: e.targetNodeId,
    targetPort: e.targetPort,
  };
}

export async function loadBoard(db: Db, workspaceId: string, boardId: string) {
  const b = await db.query.boards.findFirst({
    where: (t, { and, eq, isNull }) =>
      and(eq(t.id, boardId), eq(t.workspaceId, workspaceId), isNull(t.archivedAt)),
  });
  if (!b) throw httpError(404, 'not_found', 'Board not found');
  return b;
}

export async function loadGraph(db: Db, boardId: string): Promise<{ graph: Graph; nodes: NodeRow[] }> {
  const [nodes, edges] = await Promise.all([
    db
      .select()
      .from(boardNodes)
      .where(and(eq(boardNodes.boardId, boardId), isNull(boardNodes.deletedAt))),
    db
      .select()
      .from(boardEdges)
      .where(and(eq(boardEdges.boardId, boardId), isNull(boardEdges.deletedAt))),
  ]);
  return { graph: graphFrom(nodes.map(toRecord), edges.map(toEdge)), nodes };
}

/** Identity of what a node currently outputs, used as the input reference of its consumers. */
function outputRef(n: NodeRecord): string {
  if (NODE_DEFS[n.kind].runnable) return n.currentVersionId ?? 'none';
  if (n.kind === 'text' || n.kind === 'note') return `text:${JSON.stringify(n.settings.text ?? '')}`;
  return `asset:${(n.settings.assetId as string | null) ?? 'none'}`;
}

/** Input hashes of all runnable nodes given the current graph (used for stale flags and cache). */
export async function computeInputHashes(graph: Graph): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const n of graph.nodes.values()) {
    const engine = ENGINE_VERSIONS[n.kind];
    if (!engine) continue;
    const inputs: HashInput[] = [];
    for (const e of graph.edges.values()) {
      if (e.target !== n.id) continue;
      const src = graph.nodes.get(e.source);
      if (src) inputs.push({ port: e.targetPort, ref: outputRef(src) });
    }
    out.set(n.id, await inputHash(n.kind, engine, n.settings, inputs));
  }
  return out;
}

export async function versionDtos(db: Db, env: Env, versionIds: string[]): Promise<NodeVersionDto[]> {
  if (!versionIds.length) return [];
  const vs = await db.select().from(nodeVersions).where(inArray(nodeVersions.id, versionIds));
  const outs = await db
    .select()
    .from(nodeVersionOutputs)
    .where(inArray(nodeVersionOutputs.versionId, versionIds));
  const assetIds = [
    ...new Set([
      ...outs.map((o) => o.assetId),
      ...vs.map((v) => v.outputAssetId).filter((x): x is string => !!x),
    ]),
  ];
  const [assetRows, variantRows] = assetIds.length
    ? await Promise.all([
        db.select().from(assets).where(inArray(assets.id, assetIds)),
        db.select().from(assetVariants).where(inArray(assetVariants.assetId, assetIds)),
      ])
    : [[], []];
  const byId = new Map(assetRows.map((a) => [a.id, a]));
  return vs.map((v) => ({
    id: v.id,
    nodeId: v.nodeId,
    versionNo: v.versionNo,
    source: v.source as NodeVersionDto['source'],
    runId: v.runId,
    parentVersionId: v.parentVersionId,
    outputAssetId: v.outputAssetId,
    outputs: outs
      .filter((o) => o.versionId === v.id)
      .sort((a, b) => a.position - b.position)
      .map((o) => byId.get(o.assetId))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => assetDto(env, a, variantRows)),
    params: v.params as Record<string, unknown>,
    gates: v.gates as NodeVersionDto['gates'],
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function snapshot(
  db: Db,
  env: Env,
  workspaceId: string,
  boardId: string,
  role: 'owner' | 'editor' | 'viewer',
): Promise<BoardSnapshot> {
  const board = await loadBoard(db, workspaceId, boardId);
  const { graph, nodes } = await loadGraph(db, boardId);
  const hashes = await computeInputHashes(graph);
  const currentIds = nodes.map((n) => n.currentVersionId).filter((x): x is string => !!x);
  const versions = await versionDtos(db, env, currentIds);
  const versionHash = new Map(
    (currentIds.length
      ? await db
          .select({ id: nodeVersions.id, h: nodeVersions.inputHash })
          .from(nodeVersions)
          .where(inArray(nodeVersions.id, currentIds))
      : []
    ).map((r) => [r.id, r.h]),
  );
  return {
    board: {
      id: board.id,
      title: board.title,
      updatedAt: board.updatedAt.toISOString(),
      thumbnailUrl: null,
      seq: board.seq,
      role,
    },
    nodes: nodes.map((n) => {
      const h = hashes.get(n.id);
      const stale = !!(n.currentVersionId && h && versionHash.get(n.currentVersionId) !== h);
      return { ...toRecord(n), stale };
    }),
    edges: [...graph.edges.values()],
    versions,
  };
}

/** Creates a board from a starter, a guest board, or blank. Recorded as op batch #1. */
export async function createBoard(
  db: Db,
  workspaceId: string,
  userId: string,
  title: string,
  starter: 'blank' | StarterId,
  guest?: { nodes: Omit<NodeRecord, 'version' | 'currentVersionId'>[]; edges: EdgeRecord[] },
) {
  const g = guest
    ? { nodes: guest.nodes.map((n) => ({ ...n, version: 1, currentVersionId: null })), edges: guest.edges }
    : starter !== 'blank' && (STARTERS as readonly string[]).includes(starter)
      ? starterGraph(starter as StarterId)
      : { nodes: [], edges: [] };
  const ops: GraphOp[] = [
    ...g.nodes.map(
      (n): GraphOp => ({
        type: 'node.create',
        node: { id: n.id, kind: n.kind, x: n.x, y: n.y, label: n.label, settings: n.settings, zKey: n.zKey },
      }),
    ),
    ...g.edges.map((e): GraphOp => ({ type: 'edge.create', edge: e })),
  ];
  // Validate with the same reducer the client uses (throws OpError on bad guest data).
  const applied = ops.length ? applyOps({ nodes: new Map(), edges: new Map() }, ops).graph : null;
  return db.transaction(async (tx) => {
    const [b] = await tx
      .insert(boards)
      .values({ workspaceId, title, createdBy: userId, seq: ops.length ? 1 : 0 })
      .returning();
    if (!b) throw new Error('insert board failed');
    if (applied) {
      await persistDiff(
        tx as unknown as Db,
        b.id,
        workspaceId,
        userId,
        { nodes: new Map(), edges: new Map() },
        applied,
        new Set(applied.nodes.keys()),
      );
      await tx
        .insert(boardOps)
        .values({ boardId: b.id, seq: 1, opId: crypto.randomUUID(), actorId: userId, ops });
    }
    return b;
  });
}

/**
 * Writes the difference between two graphs. Upserts are guarded by board id so a client can
 * never take over a node id that belongs to another board.
 */
export async function persistDiff(
  db: Db,
  boardId: string,
  workspaceId: string,
  userId: string,
  before: Graph,
  after: Graph,
  touched: Set<string>,
  deferredVersions: Map<string, string> = new Map(),
) {
  const upserts = [...touched]
    .map((id) => after.nodes.get(id))
    .filter((n): n is NodeRecord => !!n)
    .map((n) =>
      deferredVersions.has(n.id)
        ? { ...n, currentVersionId: before.nodes.get(n.id)?.currentVersionId ?? null }
        : n,
    );
  const removed = [...touched].filter((id) => before.nodes.has(id) && !after.nodes.has(id));
  if (upserts.length) {
    await db
      .insert(boardNodes)
      .values(
        upserts.map((n) => ({
          id: n.id,
          boardId,
          workspaceId,
          kind: n.kind,
          x: n.x,
          y: n.y,
          label: n.label,
          settings: n.settings,
          zKey: n.zKey,
          rowVersion: n.version,
          currentVersionId: n.currentVersionId,
          createdBy: userId,
          deletedAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: boardNodes.id,
        set: {
          x: sql`excluded.x`,
          y: sql`excluded.y`,
          label: sql`excluded.label`,
          settings: sql`excluded.settings`,
          zKey: sql`excluded.z_key`,
          rowVersion: sql`excluded.row_version`,
          currentVersionId: sql`excluded.current_version_id`,
          deletedAt: sql`NULL`,
        },
        setWhere: sql`${boardNodes.boardId} = excluded.board_id`,
      });
  }
  if (removed.length) {
    await db
      .update(boardNodes)
      .set({ deletedAt: new Date() })
      .where(and(eq(boardNodes.boardId, boardId), inArray(boardNodes.id, removed)));
  }
  const addEdges = [...after.edges.values()].filter((e) => !before.edges.has(e.id));
  const dropEdges = [...before.edges.values()].filter((e) => !after.edges.has(e.id)).map((e) => e.id);
  if (addEdges.length) {
    await db
      .insert(boardEdges)
      .values(
        addEdges.map((e) => ({
          id: e.id,
          boardId,
          workspaceId,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          targetPort: e.targetPort,
        })),
      )
      .onConflictDoUpdate({
        target: boardEdges.id,
        set: { deletedAt: sql`NULL` },
        setWhere: sql`${boardEdges.boardId} = excluded.board_id`,
      });
  }
  if (dropEdges.length) {
    await db
      .update(boardEdges)
      .set({ deletedAt: new Date() })
      .where(and(eq(boardEdges.boardId, boardId), inArray(boardEdges.id, dropEdges)));
  }
}

/**
 * Applies one idempotent op batch. The board row is locked (SELECT … FOR UPDATE) so batches on
 * the same board are serialised; `op_id` dedupes retries; the server re-runs the shared reducer
 * so invalid ops (type mismatch, cycles, stale baseVersion) are rejected authoritatively.
 */
export async function applyBatch(
  db: Db,
  workspaceId: string,
  userId: string,
  boardId: string,
  opId: string,
  ops: GraphOp[],
) {
  return db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    const locked = await tx.execute<{ seq: string }>(
      sql`SELECT seq FROM boards WHERE id = ${boardId} AND workspace_id = ${workspaceId} AND archived_at IS NULL FOR UPDATE`,
    );
    const row = locked.rows[0];
    if (!row) throw httpError(404, 'not_found', 'Board not found');
    const dup = await tx
      .select({ seq: boardOps.seq })
      .from(boardOps)
      .where(and(eq(boardOps.boardId, boardId), eq(boardOps.opId, opId)));
    if (dup[0]) return { seq: dup[0].seq, duplicate: true };
    const { graph } = await loadGraph(tx, boardId);
    let result: ReturnType<typeof applyOps>;
    try {
      result = applyOps(graph, ops);
    } catch (e) {
      if (e instanceof OpError)
        throw httpError(
          e.code === 'conflict' ? 409 : 400,
          e.code === 'conflict' ? 'conflict' : 'bad_request',
          `Op ${e.opIndex} rejected: ${e.code}`,
          { opIndex: e.opIndex, reason: e.code },
        );
      throw e;
    }
    // A node.create may revive a tombstoned id (undo of delete): make sure it is this board's.
    const created = ops
      .filter((o) => o.type === 'node.create')
      .map((o) => (o as Extract<GraphOp, { type: 'node.create' }>).node.id);
    if (created.length) {
      const foreign = await tx.execute(
        sql`SELECT 1 FROM board_nodes WHERE id IN (${sql.join(
          created.map((i) => sql`${i}`),
          sql`, `,
        )}) AND board_id <> ${boardId}`,
      );
      if (foreign.rows.length) throw httpError(409, 'conflict', 'Node id belongs to another board');
    }
    // Upload versions: write the node first (old version pointer), insert the version, then point
    // the node at it — satisfies both the FK and the "current version belongs to node" trigger.
    const deferred = uploadVersionTargets(graph, ops);
    await persistDiff(tx, boardId, workspaceId, userId, graph, result.graph, result.touched, deferred);
    await createUploadVersions(tx, boardId, workspaceId, userId, result.graph, ops);
    for (const [nodeId, versionId] of deferred) {
      await tx
        .update(boardNodes)
        .set({ currentVersionId: versionId })
        .where(and(eq(boardNodes.id, nodeId), eq(boardNodes.boardId, boardId)));
    }
    const seq = Number(row.seq) + 1;
    await tx.update(boards).set({ seq }).where(eq(boards.id, boardId));
    await tx.insert(boardOps).values({ boardId, seq, opId, actorId: userId, ops });
    return { seq, duplicate: false };
  });
}

/**
 * Input nodes (photo, upload3d, audio) get a version per attached file so history, previews and
 * cache keys work the same as for generated outputs. The client picks the version id (UUIDv7)
 * and sends it with the settings change; the server verifies the asset is in this workspace.
 */
function uploadVersionTargets(graph: Graph, ops: GraphOp[]): Map<string, string> {
  const m = new Map<string, string>();
  const created = new Map(
    ops
      .filter((o) => o.type === 'node.create')
      .map((o) => [
        (o as Extract<GraphOp, { type: 'node.create' }>).node.id,
        (o as Extract<GraphOp, { type: 'node.create' }>).node.kind,
      ]),
  );
  for (const op of ops) {
    if (op.type !== 'node.update' || !op.patch.currentVersionId) continue;
    const kind = graph.nodes.get(op.id)?.kind ?? created.get(op.id);
    if (op.patch.copyOfVersionId || (kind && ['photo', 'upload3d', 'audio'].includes(kind)))
      m.set(op.id, op.patch.currentVersionId);
  }
  return m;
}

async function createUploadVersions(
  tx: Db,
  boardId: string,
  workspaceId: string,
  userId: string,
  graph: Graph,
  ops: GraphOp[],
) {
  const copied = new Set(
    ops.flatMap((o) => (o.type === 'node.update' && o.patch.copyOfVersionId ? [o.id] : [])),
  );
  let hashes: Map<string, string> | null = null;
  for (const op of ops) {
    if (op.type !== 'node.update' || !op.patch.currentVersionId) continue;
    const node = graph.nodes.get(op.id);
    if (node && op.patch.copyOfVersionId) {
      // A copy whose inputs are all pasted copies too mirrors the original chain, so it is as
      // fresh as the original: store the hash of its new inputs. A copy wired to anything else
      // keeps the original hash and shows as stale if its inputs differ.
      const incoming = [...graph.edges.values()].filter((e) => e.target === node.id);
      let freshHash: string | undefined;
      if (incoming.length && incoming.every((e) => copied.has(e.source))) {
        hashes ??= await computeInputHashes(graph);
        freshHash = hashes.get(node.id);
      }
      await copyVersion(tx, boardId, workspaceId, userId, node.id, op.patch.currentVersionId, {
        sourceId: op.patch.copyOfVersionId,
        freshHash,
      });
      continue;
    }
    if (!node || !['photo', 'upload3d', 'audio'].includes(node.kind)) continue;
    // Undo of a delete points the revived node back at one of its own versions.
    const own = await tx.query.nodeVersions.findFirst({
      where: (t, { eq }) => eq(t.id, op.patch.currentVersionId!),
    });
    if (own?.nodeId === node.id) continue;
    const assetId = op.patch.settings?.assetId as string | undefined;
    if (!assetId) throw httpError(400, 'bad_request', 'Upload versions need settings.assetId');
    const asset = await tx.query.assets.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.id, assetId), eq(t.workspaceId, workspaceId), eq(t.status, 'ready')),
    });
    if (!asset) throw httpError(400, 'bad_request', 'Unknown asset');
    if (own) throw httpError(400, 'bad_request', 'Version belongs to another node');
    const max = await tx.execute<{ n: number }>(
      sql`SELECT coalesce(max(version_no), 0)::int AS n FROM node_versions WHERE node_id = ${node.id}`,
    );
    await tx.insert(nodeVersions).values({
      id: op.patch.currentVersionId,
      nodeId: node.id,
      boardId,
      workspaceId,
      versionNo: (max.rows[0]?.n ?? 0) + 1,
      source: 'upload',
      outputAssetId: asset.id,
      createdBy: userId,
    });
    await tx
      .insert(nodeVersionOutputs)
      .values({ versionId: op.patch.currentVersionId, assetId: asset.id, role: 'primary', position: 0 });
  }
}

/**
 * Copy/paste and duplicate: a new version on the pasted node that points at the same output
 * assets (immutable, content-addressed) and keeps params, gates and input hash. The source may be
 * on another board of the same workspace (paste across boards).
 */
async function copyVersion(
  tx: Db,
  boardId: string,
  workspaceId: string,
  userId: string,
  nodeId: string,
  versionId: string,
  { sourceId, freshHash }: { sourceId: string; freshHash?: string },
) {
  const existing = await tx.query.nodeVersions.findFirst({ where: (t, { eq }) => eq(t.id, versionId) });
  if (existing) return; // retried batch
  const src = await tx.query.nodeVersions.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, sourceId), eq(t.workspaceId, workspaceId)),
  });
  if (!src) throw httpError(400, 'bad_request', 'Unknown source version');
  const outputs = await tx.query.nodeVersionOutputs.findMany({
    where: (t, { eq }) => eq(t.versionId, sourceId),
  });
  const max = await tx.execute<{ n: number }>(
    sql`SELECT coalesce(max(version_no), 0)::int AS n FROM node_versions WHERE node_id = ${nodeId}`,
  );
  await tx.insert(nodeVersions).values({
    id: versionId,
    nodeId,
    boardId,
    workspaceId,
    versionNo: (max.rows[0]?.n ?? 0) + 1,
    source: 'copy',
    outputAssetId: src.outputAssetId,
    params: src.params,
    gates: src.gates,
    inputHash: freshHash ?? src.inputHash,
    createdBy: userId,
  });
  if (outputs.length) await tx.insert(nodeVersionOutputs).values(outputs.map((o) => ({ ...o, versionId })));
}

export { sha256Hex };
