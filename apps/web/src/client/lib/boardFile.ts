import {
  type AssetDto,
  BOARD_FILE_DIRECT_MAX_BYTES,
  BOARD_FILE_EXT,
  BOARD_FILE_MANIFEST,
  BOARD_FILE_MAX_BYTES,
  BOARD_FILE_MIME,
  type BoardFileManifest,
  type BoardFileOutput,
  centralDirectory,
  crc32,
  type DocPayload,
  type EdgeRecord,
  entryDataOffset,
  extForMime,
  FILE_REF_SETTINGS,
  type GraphOp,
  generateKeyBetween,
  listZip,
  localHeader,
  BoardFileManifest as ManifestSchema,
  NODE_DEFS,
  type NodeRecord,
  type NodeVersionDto,
  newId,
  type ReadRange,
  readBytes,
  readManifestText,
  readZipIndex,
  VARIANTS,
  type WrittenEntry,
  type ZipEntry,
  ZipError,
} from '@annie3d/contracts';
import { deflateSync, inflateSync } from 'fflate';
import { ApiError } from '../api/client';
import { insertPayload } from '../canvas/clipboard';
import { applyRemote, type LocalBoard, upsertVersions, useBoard } from '../store/board';
import { saveGuestFile } from '../store/persist';
import { toast, useUi } from '../store/ui';
import { timed } from './perf';

/*
 * `.annie3d` board files (format: packages/contracts/src/boardFile.ts, ZIP: zip.ts).
 *
 * Reading never loads a whole file: the ZIP index is read from the end of the File (Blob.slice)
 * and each stored asset becomes a slice of it, so the browser keeps it on disk until shown.
 * Writing streams assets as parts of a Blob (the browser may back it with disk), and an Export
 * node's ZIP, which holds copies of the board's own files, is written as its member list.
 */

type Variant = (typeof VARIANTS)[number];
const URL_VARIANT: Record<'poster' | 'thumb' | 'turntable', Variant> = {
  poster: 'poster_512',
  thumb: 'thumb_256',
  turntable: 'turntable_mp4',
};
const VARIANT_KEY = (v: string): 'poster' | 'thumb' | 'turntable' =>
  v.startsWith('poster') ? 'poster' : v === 'thumb_256' ? 'thumb' : 'turntable';

/** Which stored variant a preview URL is (from `?variant=` or a fixture file name). */
function variantOf(key: keyof typeof URL_VARIANT, url: string): Variant {
  const q = new URL(url, location.href).searchParams.get('variant');
  if (q && (VARIANTS as readonly string[]).includes(q)) return q as Variant;
  if (key === 'poster' && url.includes('1024')) return 'poster_1024';
  return URL_VARIANT[key];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'board';
export const fileNameFor = (title: string) => `${slug(title)}${BOARD_FILE_EXT}`;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (b: Uint8Array) =>
  hex(await crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>));
/** The content hash a file name claims (`assets/<sha256>[-variant].<ext>`). */
export const shaOfPath = (p: string) =>
  /^assets\/([0-9a-f]{64})(?:-[a-z]+)?\.[a-z0-9]+$/.exec(p)?.[1] ?? null;
const inflate = (d: Uint8Array, size: number) => inflateSync(d, { out: new Uint8Array(size) });

// ------------------------------------------------------------------ reading

export const blobRange =
  (b: Blob): ReadRange =>
  async (o, l) =>
    new Uint8Array(await b.slice(o, o + l).arrayBuffer());

/** Export bundles of loaded files: output id → member paths and names (kept for the next save). */
const bundles = new Map<string, NonNullable<BoardFileOutput['bundle']>>();
/** Assets whose bytes are a path of the open desktop document (copied from disk on save). */
const docPaths = new Map<string, string>();

/**
 * A board from a manifest. `fileOf(path)` gives each asset a URL (a Blob slice, or the desktop
 * document's `/__doc/` path); `bundleOf(file)` does the same for an Export bundle.
 */
export async function boardFromManifest(
  m: BoardFileManifest,
  fileOf: (path: string, mime: string) => Promise<{ url: string; size: number } | null>,
  bundleOf: (f: BoardFileOutput) => Promise<{ url: string; size: number } | null>,
): Promise<LocalBoard> {
  const versions: NodeVersionDto[] = [];
  const current = new Map<string, NodeVersionDto>();
  for (const g of m.outputs) {
    const outs: AssetDto[] = [];
    for (const f of g.files) {
      const main = f.bundle ? await bundleOf(f) : await fileOf(f.path, f.mime);
      if (!main) continue;
      const id = newId();
      if (f.bundle) bundles.set(id, f.bundle);
      else docPaths.set(main.url, f.path);
      const urls: AssetDto['urls'] = { original: main.url, poster: null, thumb: null, turntable: null };
      for (const v of f.variants) {
        const vf = await fileOf(v.path, v.mime);
        if (!vf) continue;
        docPaths.set(vf.url, v.path);
        urls[VARIANT_KEY(v.variant)] = vf.url;
      }
      if (f.kind === 'image') {
        urls.poster ??= urls.original;
        urls.thumb ??= urls.original;
      }
      outs.push({
        id,
        kind: f.kind,
        mime: f.mime,
        byteSize: main.size,
        sha256: f.sha256 ?? shaOfPath(f.path) ?? '',
        width: f.width ?? null,
        height: f.height ?? null,
        durationMs: f.durationMs ?? null,
        triangleCount: f.triangleCount ?? null,
        status: 'ready',
        urls,
        createdAt: new Date().toISOString(),
      });
    }
    if (!outs.length) continue;
    const v: NodeVersionDto = {
      id: newId(),
      nodeId: g.nodeId,
      versionNo: 1,
      source: 'upload',
      runId: null,
      parentVersionId: null,
      outputAssetId: outs[0]!.id,
      outputs: outs,
      params: {},
      gates: [],
      createdAt: new Date().toISOString(),
    };
    versions.push(v);
    current.set(g.nodeId, v);
  }
  let z = 'a0';
  const nodes: NodeRecord[] = m.nodes.map(({ stale: _stale, ...n }) => {
    const settings = { ...n.settings };
    for (const k of FILE_REF_SETTINGS) if (k in settings) settings[k] = null;
    const v = current.get(n.id);
    // Input nodes name their file in settings (like an upload).
    if (v && NODE_DEFS[n.kind].category === 'input') settings.assetId = v.outputs[0]!.id;
    const zKey = z;
    z = generateKeyBetween(z, null);
    return { ...n, settings, zKey, version: 1, currentVersionId: v?.id ?? null };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges: EdgeRecord[] = m.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ ...e, sourcePort: 'out' }));
  const stale = m.nodes.filter((n) => n.stale && current.has(n.id)).map((n) => n.id);
  return {
    title: m.title,
    nodes,
    edges,
    versions,
    stale,
  };
}

export function parseManifest(text: string): BoardFileManifest {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ZipError('Not an Annie 3D file');
  }
  const r = ManifestSchema.safeParse(json);
  if (!r.success) throw new ZipError('Not an Annie 3D file (or a newer version)');
  return r.data;
}

/** A stored ZIP made of `members` (Blobs, not read): headers + members + central directory. */
function zipBlob(members: { name: string; blob: Blob; crc32: number }[], type = 'application/zip'): Blob {
  const parts: BlobPart[] = [];
  const written: WrittenEntry[] = [];
  let offset = 0;
  for (const m of members) {
    const e = {
      name: m.name,
      method: 0 as const,
      crc32: m.crc32,
      compressedSize: m.blob.size,
      size: m.blob.size,
    };
    const h = localHeader(e);
    written.push({ ...e, headerOffset: offset });
    parts.push(h as Uint8Array<ArrayBuffer>, m.blob);
    offset += h.length + m.blob.size;
  }
  parts.push(centralDirectory(written, offset, '') as Uint8Array<ArrayBuffer>);
  return new Blob(parts, { type });
}

/** A board file (a File or Blob) as a local board whose assets are slices of it. */
async function localBoardFromBlob(file: Blob): Promise<LocalBoard> {
  const read = blobRange(file);
  const entries = await readZipIndex(read, file.size);
  const m = parseManifest(await readManifestText(read, entries, inflate));
  const slice = async (e: ZipEntry, mime: string) => {
    const at = await entryDataOffset(read, e);
    return file.slice(at, at + e.size, mime);
  };
  const make = async (blob: Blob) => ({ url: URL.createObjectURL(blob), size: blob.size });
  return boardFromManifest(
    m,
    async (path, mime) => {
      const e = entries.get(path);
      return e ? make(await slice(e, mime)) : null;
    },
    async (f) => {
      const members = [];
      for (const b of f.bundle!) {
        const e = entries.get(b.path);
        if (!e) return null;
        members.push({ name: b.name, blob: await slice(e, 'application/octet-stream'), crc32: e.crc32 });
      }
      return make(zipBlob(members));
    },
  );
}

/**
 * Open a `.annie3d` file into the current board at `at` (flow coordinates). Signed-in boards
 * send it to the server (through R2 when large); guest and desktop file boards keep it local.
 */
export async function importBoardFile(file: File, at: { x: number; y: number }) {
  if (file.size > BOARD_FILE_MAX_BYTES) return toast('Board files up to 2 GB can be opened', 'error');
  try {
    await timed('file.import', async () => {
      const { mode, boardId } = useBoard.getState();
      if (mode === 'remote' && boardId) {
        const body = await uploadBoardFile(
          boardId,
          { size: file.size, slice: async (o, l) => file.slice(o, o + l) },
          at,
        );
        upsertVersions(body.versions);
        applyRemote(body.ops, body.seq, { undoable: true });
        useUi.setState({ selected: new Set(body.nodeIds) });
      } else {
        const b = await localBoardFromBlob(file);
        if (!b.nodes.length) throw new ZipError('The file has no nodes');
        // Guests keep files in the browser (by asset id); they come back after a reload.
        if (mode === 'guest')
          for (const v of b.versions)
            for (const o of v.outputs)
              for (const [k, u] of Object.entries(o.urls))
                if (u && (k === 'original' || u !== o.urls.original))
                  await saveGuestFile(
                    k === 'original' ? o.id : `${o.id}:${k}`,
                    await (await fetch(u)).blob(),
                  );
        insertPayload(
          {
            mark: 'annie3d/nodes@1',
            mode: useBoard.getState().mode,
            nodes: b.nodes,
            edges: b.edges.map(({ id: _id, ...e }) => ({ ...e, id: newId() })),
            versions: b.versions,
            stale: b.stale ?? [],
          },
          at,
        );
      }
    });
    toast(`Opened ${file.name}`);
  } catch (e) {
    toast(e instanceof ApiError || e instanceof Error ? e.message : 'Could not open the file', 'error');
  }
}

/** A file to upload, read in parts (a File, or the desktop's temporary pack by range). */
export interface UploadSource {
  size: number;
  slice(offset: number, length: number): Promise<Blob>;
}

type ImportResult = { seq: number; ops: GraphOp[]; nodeIds: string[]; versions: NodeVersionDto[] };

/**
 * Sends a board file to the server: in the request body up to 80 MB, else to R2 in 16 MB parts
 * (the Worker then reads it by range, so size is not limited by request or memory limits).
 */
export async function uploadBoardFile(
  boardId: string,
  src: UploadSource,
  at: { x: number; y: number },
): Promise<ImportResult> {
  const q = `x=${Math.round(at.x)}&y=${Math.round(at.y)}`;
  const json = async (r: Response) => {
    const body = await r.json().catch(() => null);
    if (!r.ok)
      throw new ApiError(
        r.status,
        body?.error?.code ?? 'internal',
        body?.error?.message ?? 'Could not open the file',
      );
    return body;
  };
  if (src.size <= BOARD_FILE_DIRECT_MAX_BYTES)
    return json(
      await fetch(`/api/boards/${boardId}/import?${q}`, {
        method: 'POST',
        headers: { 'content-type': BOARD_FILE_MIME },
        body: await src.slice(0, src.size),
        credentials: 'same-origin',
      }),
    );
  const up = (await json(
    await fetch(`/api/boards/${boardId}/import-upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ byteSize: src.size }),
      credentials: 'same-origin',
    }),
  )) as { uploadId: string; partSize: number; parts: { partNumber: number; url: string }[] };
  const parts: { partNumber: number; etag: string }[] = [];
  // Three parts in flight: enough to fill most uplinks without holding more than 48 MB.
  let next = 0;
  const worker = async () => {
    while (next < up.parts.length) {
      const p = up.parts[next++]!;
      const start = (p.partNumber - 1) * up.partSize;
      const body = await src.slice(start, Math.min(up.partSize, src.size - start));
      const r = await fetch(p.url, { method: 'PUT', body });
      if (!r.ok) throw new Error(`Upload part ${p.partNumber} failed (${r.status})`);
      parts.push({ partNumber: p.partNumber, etag: r.headers.get('etag') ?? '' });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return json(
    await fetch(`/api/boards/${boardId}/import-upload/complete?${q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uploadId: up.uploadId, parts }),
      credentials: 'same-origin',
    }),
  );
}

// ------------------------------------------------------------------ writing

/**
 * The current board as a board file payload: the manifest and one entry per asset. With `doc`
 * (a desktop document), assets the document already holds are named, not read: the shell
 * copies them from disk. Everything else is fetched here.
 */
export async function buildPayload(doc?: { id: string; assets: Set<string> }): Promise<DocPayload> {
  const { graph, versions, title, stale } = useBoard.getState();
  const files = new Map<string, Uint8Array | undefined>();
  const pathBySha = new Map<string, string>();
  const docPrefix = doc ? `/__doc/${doc.id}/` : null;
  const keep = (path: string, bytes?: Uint8Array) => {
    if (!files.has(path)) files.set(path, bytes);
    const sha = shaOfPath(path);
    if (sha && !path.includes('-', 'assets/'.length + 64)) pathBySha.set(sha, path);
    return path;
  };
  /** Adds one file; `name(sha)` names it by content. */
  const add = async (url: string, name: (sha: string) => string, sha: string | null) => {
    if (doc) {
      const p =
        docPaths.get(url) ??
        (url.startsWith(docPrefix!) ? decodeURIComponent(url.slice(docPrefix!.length)) : null);
      if (p && doc.assets.has(p)) return keep(p);
      // A server copy of a file the document holds (same content, same name).
      if (sha && doc.assets.has(name(sha))) return keep(name(sha));
    }
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`Could not read a result (${r.status})`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    return keep(name(sha || (await sha256(bytes))), bytes);
  };
  const outputs: BoardFileManifest['outputs'] = [];
  // ZIPs are looked at last, once every other file is known: an Export node's ZIP holds copies
  // of files that come later (its own web GLB is its second output).
  const zips: {
    out: BoardFileOutput[];
    at: number;
    o: AssetDto;
    meta: Omit<BoardFileOutput, 'path' | 'variants'>;
  }[] = [];
  for (const n of graph.nodes.values()) {
    const v = n.currentVersionId ? versions.get(n.currentVersionId) : undefined;
    if (!v?.outputs.length) continue;
    const out: BoardFileOutput[] = [];
    for (const [i, o] of v.outputs.entries()) {
      if (!o.urls.original) continue;
      const ext = extForMime(o.mime);
      const role = n.kind === 'packshot' ? 'packshot' : i === 0 ? 'primary' : 'extra';
      const meta = {
        kind: o.kind,
        mime: o.mime,
        role,
        width: o.width,
        height: o.height,
        durationMs: o.durationMs,
        triangleCount: o.triangleCount,
      } as const;
      if (o.mime === 'application/zip') {
        zips.push({ out, at: out.length, o, meta });
        out.push({ ...meta, path: 'assets/pending.zip', variants: [] }); // filled in below
        continue;
      }
      const main = await add(o.urls.original, (sha) => `assets/${sha}.${ext}`, o.sha256 || null);
      const sha = shaOfPath(main);
      const variants: BoardFileOutput['variants'] = [];
      for (const key of ['poster', 'thumb', 'turntable'] as const) {
        const u = o.urls[key];
        if (!u || u === o.urls.original) continue;
        const mime = key === 'turntable' ? 'video/mp4' : 'image/webp';
        const path = await add(u, () => `assets/${sha ?? o.id}-${key}.${extForMime(mime)}`, null);
        variants.push({ variant: variantOf(key, u), path, mime });
      }
      out.push({ ...meta, path: main, ...(sha ? { sha256: sha } : {}), variants });
    }
    if (out.length) outputs.push({ nodeId: n.id, files: out });
  }
  for (const { out, at, o, meta } of zips) {
    const recipe = bundles.get(o.id) ?? (await asBundle(o.urls.original!, pathBySha));
    if (recipe) {
      for (const m of recipe) keep(m.path);
      out[at] = { ...meta, path: `assets/${o.sha256 || o.id}.zip`, bundle: recipe, variants: [] };
    } else {
      const main = await add(o.urls.original!, (sha) => `assets/${sha}.zip`, o.sha256 || null);
      const sha = shaOfPath(main);
      out[at] = { ...meta, path: main, ...(sha ? { sha256: sha } : {}), variants: [] };
    }
  }
  const manifest: BoardFileManifest = {
    format: 'annie3d',
    version: 2,
    exportedAt: new Date().toISOString(),
    title,
    nodes: [...graph.nodes.values()].map(({ id, kind, x, y, label, settings }) => ({
      id,
      kind,
      x,
      y,
      label,
      settings,
      ...(stale.has(id) ? { stale: true } : {}),
    })),
    edges: [...graph.edges.values()].map(({ id, source, target, targetPort }) => ({
      id,
      source,
      target,
      targetPort,
    })),
    outputs,
  };
  return {
    manifest: JSON.stringify(manifest),
    files: [...files].map(([path, bytes]) => (bytes ? { path, bytes } : { path })),
  };
}

/**
 * An Export ZIP whose members are all files of this board, by content: kept as its member list.
 * The ZIP is read by range and each member hashed (SHA-256), so a rebuilt ZIP holds the same bytes.
 */
async function asBundle(
  url: string,
  pathBySha: Map<string, string>,
): Promise<BoardFileOutput['bundle'] | null> {
  try {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const read = readBytes(bytes);
    const members: NonNullable<BoardFileOutput['bundle']> = [];
    for (const e of await listZip(read, bytes.length)) {
      if (e.method !== 0 || e.compressedSize !== e.size) return null;
      const at = await entryDataOffset(read, e);
      const path = pathBySha.get(await sha256(bytes.subarray(at, at + e.size)));
      if (!path) return null;
      members.push({ name: e.name, path });
    }
    return members.length ? members : null;
  } catch {
    return null; // not a plain stored ZIP: kept as it is
  }
}

/** A payload (every asset with bytes) as a board file Blob: stored assets, deflated manifest. */
export function payloadBlob(p: DocPayload): Blob {
  const parts: BlobPart[] = [];
  const written: WrittenEntry[] = [];
  let offset = 0;
  const add = (name: string, method: 0 | 8, data: Uint8Array, raw: Uint8Array) => {
    const e = { name, method, crc32: crc32(raw), compressedSize: data.length, size: raw.length };
    const h = localHeader(e);
    written.push({ ...e, headerOffset: offset });
    parts.push(h as Uint8Array<ArrayBuffer>, data as Uint8Array<ArrayBuffer>);
    offset += h.length + data.length;
  };
  const raw = new TextEncoder().encode(p.manifest);
  add(BOARD_FILE_MANIFEST, 8, deflateSync(raw), raw);
  for (const f of p.files) {
    if (!f.bytes) throw new Error(`Missing ${f.path}`);
    add(f.path, 0, f.bytes, f.bytes);
  }
  parts.push(centralDirectory(written, offset) as Uint8Array<ArrayBuffer>);
  return new Blob(parts, { type: BOARD_FILE_MIME });
}

/** Website: download the whole canvas as `<title>.annie3d`. */
export async function downloadBoardFile() {
  const { graph, title } = useBoard.getState();
  if (!graph.nodes.size) return toast('The board is empty');
  await timed('file.export', async () => {
    const blob = payloadBlob(await buildPayload());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileNameFor(title);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  });
}

// ------------------------------------------------------------------ picker

/** Where opened files land: the centre of the canvas view (set by the canvas). */
let viewCentre: () => { x: number; y: number } = () => ({ x: 0, y: 0 });
export function setViewCentre(fn: () => { x: number; y: number }) {
  viewCentre = fn;
}
export const currentViewCentre = () => viewCentre();

/** Pick a `.annie3d` file and import it into this board. */
export function openBoardFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `${BOARD_FILE_EXT},${BOARD_FILE_MIME},application/zip`;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void importBoardFile(f, viewCentre());
  };
  input.click();
}

export const isBoardFile = (f: File) => f.name.toLowerCase().endsWith(BOARD_FILE_EXT);
