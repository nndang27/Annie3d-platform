import {
  BoardFileManifest,
  type BoardFileOutput,
  centralDirectory,
  type EngineOutput,
  type EngineVariant,
  entryDataOffset,
  extForMime,
  FILE_REF_SETTINGS,
  type GraphOp,
  generateKeyBetween,
  localHeader,
  NODE_DEFS,
  newId,
  nextZKey,
  type ReadRange,
  readManifestText,
  readZipIndex,
  type WrittenEntry,
  type ZipEntry,
  ZipError,
} from '@annie3d/contracts';
import { nodeVersions } from '@annie3d/db';
import { eq, inArray } from 'drizzle-orm';
import { inflateSync } from 'fflate';
import type { Env } from '../env';
import { httpError } from '../lib/http';
import { applyBatch, computeInputHashes, loadBoard, loadGraph, versionDtos } from './boards';
import { persistVersion } from './runner';

type Db = Parameters<typeof loadBoard>[0];

/**
 * A board file to import, read by range: request bytes already in memory (small files) or an
 * object in R2 (large files the browser uploaded there first), streamed straight into the
 * workspace's content-addressed store without ever being held whole in memory.
 */
export interface FileSource {
  size: number;
  read: ReadRange;
  stream(offset: number, length: number): Promise<ReadableStream<Uint8Array>>;
}

export function memorySource(b: Uint8Array): FileSource {
  return {
    size: b.length,
    read: async (o, l) => {
      if (o + l > b.length) throw new ZipError('The file is damaged');
      return b.subarray(o, o + l);
    },
    stream: async (o, l) => new Response(b.subarray(o, o + l)).body!,
  };
}

export function r2Source(bucket: R2Bucket, key: string, size: number): FileSource {
  const get = async (offset: number, length: number) => {
    const obj = await bucket.get(key, { range: { offset, length } });
    if (!obj) throw new ZipError('The uploaded file is gone');
    return obj;
  };
  return {
    size,
    read: async (o, l) => (l ? new Uint8Array(await (await get(o, l)).arrayBuffer()) : new Uint8Array()),
    stream: async (o, l) => (await get(o, l)).body,
  };
}

const hexOf = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Copies a stream into a writable chunk by chunk. workerd cannot `pipeTo` from a stream made in
 * JavaScript (bytes in memory, a tee) into its own streams, so the copy is done here.
 */
async function pump(s: ReadableStream<Uint8Array>, w: WritableStream<Uint8Array>) {
  const r = s.getReader();
  const out = w.getWriter();
  for (let c = await r.read(); !c.done; c = await r.read()) await out.write(c.value);
  await out.close();
}

/** SHA-256 of a stream, computed natively while it flows (Workers DigestStream). */
async function digestOf(s: ReadableStream<Uint8Array>) {
  const d = new crypto.DigestStream('SHA-256');
  await pump(s, d);
  return hexOf(await d.digest);
}

/** Writes a stream of known length to R2 (a length is required for streamed puts). */
async function putStream(
  bucket: R2Bucket,
  key: string,
  s: ReadableStream<Uint8Array>,
  length: number,
  mime: string,
) {
  const { readable, writable } = new FixedLengthStream(length);
  await Promise.all([bucket.put(key, readable, { httpMetadata: { contentType: mime } }), pump(s, writable)]);
}

/**
 * Content-addressed storage of one file (the same key scheme as runner.artifactStore): skipped
 * when the workspace already has these bytes. The name's SHA-256 (the file names its assets by
 * content) is only a claim: the bytes are hashed while they are written, and a mismatch deletes
 * the object and fails the import. Files without a claim (older guest uploads) are hashed first.
 */
async function storeEntry(
  env: Env,
  prefix: string,
  src: FileSource,
  e: ZipEntry,
  meta: { mime: string; tag: string; claim: string | null },
) {
  const at = await entryDataOffset(src.read, e);
  const ext = extForMime(meta.mime);
  const sha = meta.claim ?? (await digestOf(await src.stream(at, e.size)));
  const key = `${prefix}${sha}${meta.tag}.${ext}`;
  if (!(await env.ARTIFACTS.head(key))) {
    const [toStore, toHash] = (await src.stream(at, e.size)).tee();
    const [, actual] = await Promise.all([
      putStream(env.ARTIFACTS, key, toStore, e.size, meta.mime),
      digestOf(toHash),
    ]);
    if (actual !== sha) {
      await env.ARTIFACTS.delete(key);
      throw httpError(400, 'bad_request', `${e.name} does not match its checksum`);
    }
  }
  return { storageKey: key, byteSize: e.size, sha256: sha };
}

/** A stored ZIP rebuilt from its members (an Export bundle kept as a member list in the file). */
async function storeBundle(
  env: Env,
  prefix: string,
  src: FileSource,
  entries: Map<string, ZipEntry>,
  members: NonNullable<BoardFileOutput['bundle']>,
) {
  const parts: { e: ZipEntry; at: number; header: Uint8Array; w: WrittenEntry }[] = [];
  let offset = 0;
  for (const m of members) {
    const e = entries.get(m.path);
    if (!e) throw httpError(400, 'bad_request', `Missing ${m.path}`);
    const w = { name: m.name, method: 0 as const, crc32: e.crc32, compressedSize: e.size, size: e.size };
    const header = localHeader(w);
    parts.push({ e, at: await entryDataOffset(src.read, e), header, w: { ...w, headerOffset: offset } });
    offset += header.length + e.size;
  }
  const cd = centralDirectory(
    parts.map((p) => p.w),
    offset,
    '',
  );
  const length = offset + cd.length;
  const stream = () => {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    void (async () => {
      const w = writable.getWriter();
      try {
        for (const p of parts) {
          await w.write(p.header);
          const r = (await src.stream(p.at, p.e.size)).getReader();
          for (let c = await r.read(); !c.done; c = await r.read()) await w.write(c.value);
        }
        await w.write(cd);
        await w.close();
      } catch (err) {
        await w.abort(err);
      }
    })();
    return readable;
  };
  // Two passes over the members: the key needs the hash before the bytes are written.
  const sha = await digestOf(stream());
  const key = `${prefix}${sha}-file.zip`;
  if (!(await env.ARTIFACTS.head(key)))
    await putStream(env.ARTIFACTS, key, stream(), length, 'application/zip');
  return { storageKey: key, byteSize: length, sha256: sha };
}

const claimOf = (f: { sha256?: string; path: string }) =>
  f.sha256 ?? /^assets\/([0-9a-f]{64})(?:-[a-z]+)?\.[a-z0-9]+$/.exec(f.path)?.[1] ?? null;

/**
 * Imports a `.annie3d` file into a board (signed-in). Nodes get new ids placed with their
 * top-left at (x, y); each node's result becomes an "upload" version, so previews, exports and
 * runs work as if it had been made on this board. Nodes marked stale keep their result without
 * an input hash, so the next run redoes them.
 */
export async function importBoardFile(
  env: Env,
  db: Db,
  who: { workspaceId: string; userId: string },
  boardId: string,
  src: FileSource,
  at: { x: number; y: number },
) {
  const { workspaceId, userId } = who;
  let entries: Map<string, ZipEntry>;
  let m: BoardFileManifest;
  try {
    entries = await readZipIndex(src.read, src.size);
    const text = await readManifestText(src.read, entries, (d, size) =>
      inflateSync(d, { out: new Uint8Array(size) }),
    );
    const parsed = BoardFileManifest.safeParse(JSON.parse(text));
    if (!parsed.success) throw new ZipError('Not an Annie 3D file (or a newer version)');
    m = parsed.data;
  } catch (e) {
    if (e instanceof ZipError || e instanceof SyntaxError)
      throw httpError(400, 'bad_request', e instanceof ZipError ? e.message : 'Not an Annie 3D file');
    throw e;
  }
  if (!m.nodes.length) throw httpError(400, 'bad_request', 'The file has no nodes');
  await loadBoard(db, workspaceId, boardId);

  // 1. Nodes and wires with fresh ids, placed with their top-left at (x, y).
  const minX = Math.min(...m.nodes.map((n) => n.x));
  const minY = Math.min(...m.nodes.map((n) => n.y));
  const ids = new Map(m.nodes.map((n) => [n.id, newId()]));
  let z = nextZKey((await loadGraph(db, boardId)).graph);
  const create: GraphOp[] = m.nodes.map((n) => {
    const settings = { ...n.settings };
    for (const k of FILE_REF_SETTINGS) if (k in settings) settings[k] = null;
    const zKey = z;
    z = generateKeyBetween(z, null);
    return {
      type: 'node.create',
      node: {
        id: ids.get(n.id)!,
        kind: n.kind,
        x: Math.round(at.x + n.x - minX),
        y: Math.round(at.y + n.y - minY),
        label: n.label,
        settings,
        zKey,
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

  // 2. Results: store the files (streamed, deduplicated by content), one version per node.
  const prefix = `${env.R2_KEY_PREFIX}ws/${workspaceId}/cas/`;
  const kindOf = new Map(m.nodes.map((n) => [ids.get(n.id)!, n.kind]));
  const created: { nodeId: string; versionId: string }[] = [];
  for (const group of m.outputs) {
    const nodeId = ids.get(group.nodeId);
    if (!nodeId) continue;
    const outputs: EngineOutput[] = [];
    for (const f of group.files) {
      const stored = f.bundle
        ? await storeBundle(env, prefix, src, entries, f.bundle)
        : await (async () => {
            const e = entries.get(f.path);
            if (!e) throw httpError(400, 'bad_request', `Missing ${f.path}`);
            return storeEntry(env, prefix, src, e, { mime: f.mime, tag: `-${f.kind}`, claim: claimOf(f) });
          })();
      const variants: EngineVariant[] = [];
      for (const v of f.variants) {
        const e = entries.get(v.path);
        if (!e) continue;
        const put = await storeEntry(env, prefix, src, e, { mime: v.mime, tag: '', claim: null });
        variants.push({
          variant: v.variant,
          storageKey: put.storageKey,
          byteSize: put.byteSize,
          mime: v.mime,
          width: v.width ?? undefined,
          height: v.height ?? undefined,
        });
      }
      outputs.push({
        ...stored,
        kind: f.kind,
        mime: f.mime,
        role: f.role,
        width: f.width ?? undefined,
        height: f.height ?? undefined,
        durationMs: f.durationMs ?? undefined,
        triangleCount: f.triangleCount ?? undefined,
        variants,
      });
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
    const input = NODE_DEFS[kindOf.get(nodeId)!].category === 'input';
    return {
      type: 'node.update',
      id: nodeId,
      patch: {
        currentVersionId: versionId,
        // Input nodes also name their file in settings (like an upload).
        ...(input ? { settings: { assetId: byId.get(versionId)?.outputAssetId ?? null } } : {}),
      },
    };
  });
  const res = point.length
    ? await applyBatch(db, workspaceId, userId, boardId, newId(), point)
    : { seq: 0, duplicate: false };

  // 3. Results are as fresh as their inputs, except where the file says they are out of date.
  const stale = new Set(m.nodes.filter((n) => n.stale).map((n) => ids.get(n.id)));
  const { graph } = await loadGraph(db, boardId);
  const hashes = await computeInputHashes(graph);
  for (const { nodeId, versionId } of created) {
    const h = hashes.get(nodeId);
    if (h && !stale.has(nodeId))
      await db.update(nodeVersions).set({ inputHash: h }).where(eq(nodeVersions.id, versionId));
  }
  return {
    seq: res.seq,
    ops: [...create, ...point],
    nodeIds: [...ids.values()],
    versions: await versionDtos(
      db,
      env,
      created.map((v) => v.versionId),
    ),
  };
}
