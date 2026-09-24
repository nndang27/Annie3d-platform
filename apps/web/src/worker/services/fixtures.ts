import {
  applyOps,
  type EngineOutput,
  type Graph,
  type GraphOp,
  NODE_DEFS,
  newId,
  topoOrder,
  upstreamOf,
} from '@annie3d/contracts';
import { assets, assetVariants, type Db, nodeVersionOutputs, nodeVersions } from '@annie3d/db';
import { FIXTURE_MANIFEST, FIXTURE_VERSION, type FixtureProduct, uuidFromHash } from '@annie3d/fixtures';
import { and, eq, inArray } from 'drizzle-orm';
import { gatesFor, produce } from '../engines/simulator';
import { applyBatch, computeInputHashes, loadGraph } from './boards';

const PRODUCTS = Object.keys(FIXTURE_MANIFEST.products) as FixtureProduct[];
/** Fixture photo id (as used by the guest example board) → product. */
const PHOTO_BY_ID = new Map(
  PRODUCTS.map((p) => [uuidFromHash(FIXTURE_MANIFEST.products[p].files['photo.png']!.sha256), p]),
);
const key = (p: FixtureProduct, f: string) => `fixtures/${FIXTURE_VERSION}/${p}/${f}`;

/**
 * An artifact "store" that writes nothing. `readFixture` hands `produce()` the object key itself
 * (as bytes) instead of the file; the store decodes it and answers with the public key and the
 * manifest's size/hash. The simulator's output recipe is reused unchanged.
 */
const keyBytes = async (k: string) => new TextEncoder().encode(k).buffer as ArrayBuffer;
function publicStore(product: FixtureProduct) {
  const files = FIXTURE_MANIFEST.products[product].files;
  const decode = (data: ArrayBuffer | ReadableStream) => new TextDecoder().decode(data as ArrayBuffer);
  const meta = (k: string) => files[k.split('/').pop()!]!;
  return {
    async putFile(data: ArrayBuffer) {
      const k = decode(data);
      return { storageKey: k, byteSize: meta(k).bytes };
    },
    async putArtifact(
      data: ArrayBuffer | ReadableStream,
      m: Omit<EngineOutput, 'storageKey' | 'byteSize' | 'sha256'> & { ext: string },
    ) {
      const k = decode(data);
      const { ext: _e, ...rest } = m;
      return { ...rest, storageKey: k, byteSize: meta(k).bytes, sha256: meta(k).sha256 };
    },
  };
}

function photoOutput(product: FixtureProduct): EngineOutput {
  const f = FIXTURE_MANIFEST.products[product].files;
  const v = (file: string, variant: 'thumb_256' | 'poster_512', w: number) => ({
    variant,
    storageKey: key(product, file),
    mime: 'image/webp',
    byteSize: f[file]!.bytes,
    width: w,
    height: w,
  });
  return {
    storageKey: key(product, 'photo.png'),
    mime: 'image/png',
    byteSize: f['photo.png']!.bytes,
    sha256: f['photo.png']!.sha256,
    kind: 'image',
    role: 'primary',
    width: 1024,
    height: 1024,
    meta: { fixtureProduct: product },
    variants: [v('photo_thumb_256.webp', 'thumb_256', 256), v('photo_512.webp', 'poster_512', 512)],
  };
}

/**
 * Seeds an imported example board with its already-rendered outputs (F1 for signed-in users).
 * - Nothing is copied: assets reference the shared, immutable fixture objects in the PUBLIC
 *   bucket (migration 0002), so seeding costs only database rows.
 * - Everything is computed in memory and written with a handful of bulk statements in one
 *   transaction (the first version wrote row by row: >10 s on first sign-in, E2E 2026-09-24).
 * - Each version stores the input hash it was "made" from, so the board opens fresh and an
 *   unchanged Run is free; edits make downstream nodes stale exactly as after a real run.
 */
export async function seedExample(db: Db, workspaceId: string, userId: string, boardId: string) {
  const { graph } = await loadGraph(db, boardId);
  const productOf = new Map<string, FixtureProduct>();
  for (const n of graph.nodes.values()) {
    const p = n.kind === 'photo' ? PHOTO_BY_ID.get(String(n.settings.assetId ?? '')) : undefined;
    if (p) productOf.set(n.id, p);
  }
  if (!productOf.size) return;

  // 1. Outputs per node, in dependency order (pure computation).
  const planned: {
    nodeId: string;
    outputs: EngineOutput[];
    gates: ReturnType<typeof gatesFor>;
    upload: boolean;
  }[] = [];
  for (const id of topoOrder(graph)) {
    const n = graph.nodes.get(id)!;
    if (n.kind === 'photo' && productOf.has(id)) {
      planned.push({ nodeId: id, outputs: [photoOutput(productOf.get(id)!)], gates: [], upload: true });
      continue;
    }
    if (!NODE_DEFS[n.kind].runnable) continue;
    const product = [...upstreamOf(graph, id)].map((u) => productOf.get(u)).find(Boolean);
    if (!product) continue;
    productOf.set(id, product);
    planned.push({
      nodeId: id,
      outputs: await produce(n.kind, product, publicStore(product), { readFixture: keyBytes }),
      gates: gatesFor(n.kind, product, ''),
      upload: false,
    });
  }

  await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    // 2. Assets: reuse this workspace's rows for the same content, insert the rest in bulk.
    const all = planned.flatMap((p) => p.outputs);
    const shas = [...new Set(all.map((o) => o.sha256))];
    const existing = await tx
      .select({ id: assets.id, sha256: assets.sha256, kind: assets.kind })
      .from(assets)
      .where(
        and(eq(assets.workspaceId, workspaceId), eq(assets.status, 'ready'), inArray(assets.sha256, shas)),
      );
    const idOf = new Map(existing.map((a) => [`${a.sha256}/${a.kind}`, a.id]));
    const newAssets: (typeof assets.$inferInsert)[] = [];
    const newVariants: (typeof assetVariants.$inferInsert)[] = [];
    for (const o of all) {
      const k = `${o.sha256}/${o.kind}`;
      if (idOf.has(k)) continue;
      const id = newId();
      idOf.set(k, id);
      newAssets.push({
        id,
        workspaceId,
        kind: o.kind,
        mime: o.mime,
        byteSize: o.byteSize,
        sha256: o.sha256,
        bucket: 'public',
        storageKey: o.storageKey,
        status: 'ready',
        width: o.width ?? null,
        height: o.height ?? null,
        durationMs: o.durationMs ?? null,
        triangleCount: o.triangleCount ?? null,
        meta: o.meta ?? {},
        createdBy: userId,
      });
      for (const v of o.variants ?? [])
        newVariants.push({
          assetId: id,
          variant: v.variant,
          mime: v.mime,
          byteSize: v.byteSize,
          storageKey: v.storageKey,
          width: v.width ?? null,
          height: v.height ?? null,
        });
    }
    if (newAssets.length) await tx.insert(assets).values(newAssets);
    if (newVariants.length) await tx.insert(assetVariants).values(newVariants).onConflictDoNothing();

    // 3. Versions: point the graph at them in memory, then hash every node against the final graph.
    const ops: GraphOp[] = [];
    let g: Graph = graph;
    const versionOf = new Map<string, string>();
    const assetOf = (o: EngineOutput) => idOf.get(`${o.sha256}/${o.kind}`)!;
    for (const p of planned) {
      const versionId = newId();
      versionOf.set(p.nodeId, versionId);
      const op: GraphOp = p.upload
        ? {
            type: 'node.update',
            id: p.nodeId,
            patch: { settings: { assetId: assetOf(p.outputs[0]!) }, currentVersionId: versionId },
          }
        : { type: 'node.update', id: p.nodeId, patch: { currentVersionId: versionId } };
      g = applyOps(g, [op]).graph;
      ops.push(op);
    }
    const hashes = await computeInputHashes(g);
    await tx.insert(nodeVersions).values(
      planned.map((p) => ({
        id: versionOf.get(p.nodeId)!,
        nodeId: p.nodeId,
        boardId,
        workspaceId,
        versionNo: 1,
        source: p.upload ? 'upload' : 'run',
        outputAssetId: assetOf(p.outputs[0]!),
        params: p.upload ? {} : g.nodes.get(p.nodeId)!.settings,
        gates: p.gates,
        inputHash: p.upload ? null : (hashes.get(p.nodeId) ?? null),
        createdBy: userId,
      })),
    );
    const outputs: (typeof nodeVersionOutputs.$inferInsert)[] = [];
    for (const p of planned) {
      const seen = new Set<string>();
      p.outputs.forEach((o, i) => {
        const assetId = assetOf(o);
        if (seen.has(assetId)) return;
        seen.add(assetId);
        outputs.push({ versionId: versionOf.get(p.nodeId)!, assetId, role: o.role, position: i });
      });
    }
    await tx.insert(nodeVersionOutputs).values(outputs);
    // 4. One op batch records all pointers (nested transaction = savepoint).
    await applyBatch(tx, workspaceId, userId, boardId, newId(), ops);
  });
}
