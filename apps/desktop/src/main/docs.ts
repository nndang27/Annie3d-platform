import { randomUUID } from 'node:crypto';
import { appendFileSync, createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { deflateRawSync, inflateRawSync, crc32 as zcrc32 } from 'node:zlib';
import {
  BOARD_FILE_MANIFEST_NAME,
  BOARD_FILE_MAX_BYTES,
  BOARD_FILE_MAX_MANIFEST,
  BoardFileManifest,
  centralDirectory,
  entryDataOffset,
  crc32 as jscrc32,
  localHeader,
  type ReadRange,
  readManifestText,
  readZipIndex,
  type WrittenEntry,
  ZipError,
} from '@annie3d/contracts';
import type { DocCommand, DocFile, DocPayload } from '@annie3d/contracts/desktop';
import { app, type BrowserWindow, dialog } from 'electron';

/**
 * `.annie3d` files as documents, one window each (draw.io desktop, Sketch): open, edit, Save
 * writes back to the same file, the window marks unsaved changes and asks before closing.
 *
 * Nothing is loaded whole: the ZIP's central directory is read on open, and each asset is
 * served to the page straight from disk by range (`/__doc/<id>/<path>`). Save streams a new
 * file (assets unchanged since open are copied from the old file by range, only new ones come
 * from the page) into a temporary file next to the target, then renames it over the target, so
 * a crash or a full disk never leaves a half-written board.
 */

interface Asset {
  /** Where the bytes are: a range of the document's file, or bytes kept in memory (a stash). */
  offset: number;
  size: number;
  crc32: number;
  bytes?: Uint8Array;
}

interface Doc {
  id: string;
  name: string;
  path: string | null;
  win: BrowserWindow | null;
  dirty: boolean;
  /** Close without asking (after "Don't Save", or after the save the close asked for). */
  closing: boolean;
  assets: Map<string, Asset>;
  /** Export bundles in the manifest: path → member paths (served as a stored ZIP on demand). */
  bundles: Map<string, { name: string; path: string }[]>;
  manifest: string | null;
  draft: boolean;
  pack: { file: string; size: number } | null;
}

const docs = new Map<string, Doc>();

/**
 * Quitting (including "Restart to update"): which files were open, so they can open again
 * after a restart. A dirty document asks first: Cancel stops the quit, Save saves then lets the
 * quit carry on.
 */
const quitting = { active: false, paths: [] as string[], onCancel: () => {} };
export const quitActive = () => quitting.active;
export function beginQuit(onCancel: () => void) {
  if (quitting.active) return;
  Object.assign(quitting, { active: true, paths: [], onCancel });
}
/** Files open when the quit began (closed since, or still open). */
export function quitPaths() {
  const open = [...docs.values()].flatMap((d) => (d.path ? [d.path] : []));
  return [...new Set([...quitting.paths, ...open])];
}
export const isDocWindow = (w: BrowserWindow) => [...docs.values()].some((d) => d.win === w);
const crc = (b: Uint8Array) => (typeof zcrc32 === 'function' ? zcrc32(b) >>> 0 : jscrc32(b));
const inflate = (d: Uint8Array, size: number) => new Uint8Array(inflateRawSync(d, { maxOutputLength: size }));
const fileRange =
  (path: string): ReadRange =>
  async (offset, length) => {
    const fh = await open(path, 'r');
    try {
      const b = new Uint8Array(length);
      const { bytesRead } = await fh.read(b, 0, length, offset);
      if (bytesRead !== length) throw new ZipError('The file is damaged');
      return b;
    } finally {
      await fh.close();
    }
  };

/** Reads a board file's index and manifest (validated: zip.ts refuses zip bombs). */
async function index(path: string) {
  const { size } = await stat(path);
  const read = fileRange(path);
  const entries = await readZipIndex(read, size);
  const manifest = await readManifestText(read, entries, inflate);
  const parsed = BoardFileManifest.safeParse(JSON.parse(manifest));
  if (!parsed.success) throw new ZipError('Not an Annie 3D file (or a newer version)');
  const assets = new Map<string, Asset>();
  for (const e of entries.values())
    if (e.name !== BOARD_FILE_MANIFEST_NAME)
      assets.set(e.name, { offset: await entryDataOffset(read, e), size: e.size, crc32: e.crc32 });
  return { manifest, assets, bundles: bundlesOf(manifest) };
}

function bundlesOf(manifest: string) {
  const out = new Map<string, { name: string; path: string }[]>();
  const m = BoardFileManifest.safeParse(JSON.parse(manifest));
  if (m.success)
    for (const g of m.data.outputs) for (const f of g.files) if (f.bundle) out.set(f.path, f.bundle);
  return out;
}

export function docTitle(d: Pick<Doc, 'name' | 'dirty'>) {
  return `${d.name}${d.dirty && process.platform !== 'darwin' ? ' •' : ''}`;
}

/**
 * Opens a board file (or a new, empty document when `path` is null) in its own window; a file
 * already open just comes to the front. `makeWindow` builds a window for a page path.
 */
export async function openDocument(
  path: string | null,
  makeWindow: (url: string) => BrowserWindow,
): Promise<boolean> {
  if (path) {
    const open = [...docs.values()].find((d) => d.path === path && d.win && !d.win.isDestroyed());
    if (open?.win) {
      if (open.win.isMinimized()) open.win.restore();
      open.win.focus();
      return true;
    }
  }
  const d: Doc = {
    id: randomUUID(),
    name: path ? basename(path) : 'Untitled.annie3d',
    path,
    win: null,
    dirty: false,
    closing: false,
    assets: new Map(),
    bundles: new Map(),
    manifest: null,
    draft: false,
    pack: null,
  };
  if (path) {
    try {
      Object.assign(d, await index(path));
    } catch (e) {
      dialog.showErrorBox(
        `“${basename(path)}” could not be opened`,
        e instanceof ZipError || e instanceof SyntaxError ? e.message : String(e),
      );
      return false;
    }
    app.addRecentDocument(path);
    // Installer tests (scripts/test-file-association.mjs): which file the OS asked us to open.
    if (process.env.ANNIE3D_REPORT_FILE)
      appendFileSync(process.env.ANNIE3D_REPORT_FILE, `${JSON.stringify({ opened: path })}\n`);
  }
  docs.set(d.id, d);
  const win = makeWindow(`/?doc=${d.id}`);
  d.win = win;
  // The window shows the file's name, not the page's title.
  win.on('page-title-updated', (e) => e.preventDefault());
  syncWindow(d);
  win.on('close', (e) => {
    if (!d.dirty || d.closing) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', 'Don’t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save the changes you made to “${d.name}”?`,
      detail: 'Your changes will be lost if you don’t save them.',
    });
    if (choice === 0) command(d, 'saveAndClose');
    else if (choice === 1) {
      d.closing = true;
      win.close();
    } else if (quitting.active) {
      // Cancel: the app stays open.
      quitting.active = false;
      quitting.onCancel();
    }
  });
  win.on('closed', () => {
    if (quitting.active && d.path) quitting.paths.push(d.path);
    docs.delete(d.id);
    if (d.pack) void rm(d.pack.file, { force: true });
  });
  return true;
}

function syncWindow(d: Doc) {
  const w = d.win;
  if (!w || w.isDestroyed()) return;
  w.setTitle(docTitle(d));
  if (process.platform === 'darwin') {
    w.setRepresentedFilename(d.path ?? '');
    w.setDocumentEdited(d.dirty);
  }
}

function command(d: Doc, c: DocCommand) {
  if (d.win && !d.win.isDestroyed()) d.win.webContents.send('docs:command', c);
}

/** Sends a menu command to the focused window's page (documents and ordinary boards alike). */
export function commandFocused(win: BrowserWindow | null, c: DocCommand) {
  if (win && !win.isDestroyed()) win.webContents.send('docs:command', c);
}

const docOf = (id: string, sender: Electron.WebContents) => {
  const d = docs.get(id);
  // A page can only reach the document of its own window.
  if (!d || d.win?.webContents !== sender) throw new Error('No such document');
  return d;
};

export function read(id: string, sender: Electron.WebContents): DocFile {
  const d = docOf(id, sender);
  return {
    id: d.id,
    name: d.name,
    path: d.path,
    manifest: d.manifest,
    assets: [...d.assets].map(([path, a]) => ({ path, size: a.size })),
    draft: d.draft,
  };
}

export function setDirty(id: string, dirty: boolean, sender: Electron.WebContents) {
  const d = docOf(id, sender);
  d.dirty = dirty;
  syncWindow(d);
}

export function close(id: string, sender: Electron.WebContents) {
  const d = docOf(id, sender);
  d.closing = true;
  d.win?.close();
  // Saved on the way out of a quit: carry on quitting (the close had stopped it).
  if (quitting.active) setImmediate(() => app.quit());
}

// ------------------------------------------------------------------ serving assets from disk

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  glb: 'model/gltf-binary',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  zip: 'application/zip',
  json: 'application/json',
};
const typeOf = (p: string) => TYPES[p.split('.').pop() ?? ''] ?? 'application/octet-stream';

/** `/__doc/<id>/<path>`: an asset of an open document, from disk, with range support. */
export async function serve(pathname: string, req: Request): Promise<Response | null> {
  const m = /^\/__doc\/([0-9a-f-]{36})\/(.+)$/.exec(pathname);
  if (!m) return null;
  const d = docs.get(m[1]!);
  if (!d) return new Response('Not found', { status: 404 });
  const p = decodeURIComponent(m[2]!);
  if (p === '__pack' && d.pack)
    return rangeResponse(
      req,
      d.pack.size,
      'application/vnd.annie3d+zip',
      (s, e) => Readable.toWeb(createReadStream(d.pack!.file, { start: s, end: e })) as ReadableStream,
    );
  const bundle = d.bundles.get(p);
  if (bundle) return bundleResponse(d, bundle);
  const a = d.assets.get(p);
  if (!a) return new Response('Not found', { status: 404 });
  return rangeResponse(req, a.size, typeOf(p), (s, e) => assetStream(d, a, s, e));
}

function assetStream(d: Doc, a: Asset, start: number, end: number): ReadableStream {
  if (a.bytes) return new Response(a.bytes.slice(start, end + 1) as Uint8Array<ArrayBuffer>).body!;
  return Readable.toWeb(
    createReadStream(d.path!, { start: a.offset + start, end: a.offset + end }),
  ) as ReadableStream;
}

function rangeResponse(
  req: Request,
  size: number,
  type: string,
  body: (start: number, end: number) => ReadableStream,
) {
  const headers: Record<string, string> = {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  };
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (r && size > 0) {
    const start = r[1] ? Number(r[1]) : Math.max(0, size - Number(r[2]));
    const end = r[1] && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
    if (start > end || start >= size)
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(req.method === 'HEAD' ? null : body(start, end), {
      status: 206,
      headers: {
        ...headers,
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${size}`,
      },
    });
  }
  return new Response(req.method === 'HEAD' || size === 0 ? null : body(0, size - 1), {
    status: 200,
    headers: { ...headers, 'content-length': String(size) },
  });
}

/** An Export bundle rebuilt as a stored ZIP from the members already in the file. */
function bundleResponse(d: Doc, members: { name: string; path: string }[]) {
  const parts: { a: Asset; header: Uint8Array }[] = [];
  const written: WrittenEntry[] = [];
  let offset = 0;
  for (const m of members) {
    const a = d.assets.get(m.path);
    if (!a) return new Response('Not found', { status: 404 });
    const e = { name: m.name, method: 0 as const, crc32: a.crc32, compressedSize: a.size, size: a.size };
    const header = localHeader(e);
    parts.push({ a, header });
    written.push({ ...e, headerOffset: offset });
    offset += header.length + a.size;
  }
  const cd = centralDirectory(written, offset, '');
  const body = new ReadableStream<Uint8Array>({
    async start(ctl) {
      for (const p of parts) {
        ctl.enqueue(p.header);
        const r = assetStream(d, p.a, 0, p.a.size - 1).getReader();
        for (let c = await r.read(); !c.done; c = await r.read()) ctl.enqueue(c.value);
      }
      ctl.enqueue(cd);
      ctl.close();
    },
  });
  return new Response(body, {
    headers: { 'content-type': 'application/zip', 'content-length': String(offset + cd.length) },
  });
}

// ------------------------------------------------------------------ writing

const ASSET_NAME = /^assets\/[A-Za-z0-9._-]{1,120}$/;

/** Checks a payload from the page before anything is written. */
function validate(payload: DocPayload, source: Doc | null) {
  if (typeof payload?.manifest !== 'string' || payload.manifest.length > BOARD_FILE_MAX_MANIFEST)
    throw new ZipError('The board description is too large');
  if (!BoardFileManifest.safeParse(JSON.parse(payload.manifest)).success) throw new ZipError('Invalid board');
  const seen = new Set<string>();
  let total = 0;
  for (const f of payload.files) {
    if (!ASSET_NAME.test(f.path) || seen.has(f.path)) throw new ZipError(`Invalid file ${f.path}`);
    seen.add(f.path);
    const size = f.bytes ? f.bytes.byteLength : source?.assets.get(f.path)?.size;
    if (size === undefined) throw new ZipError(`Missing ${f.path}`);
    total += size;
  }
  if (total > BOARD_FILE_MAX_BYTES) throw new ZipError('The board is larger than 2 GB');
}

async function writeAll(out: WriteStream, chunk: Uint8Array) {
  if (!out.write(chunk)) await new Promise<void>((r) => out.once('drain', () => r()));
}

/**
 * Streams a board file to `target` through a temporary file in the same folder (then renamed):
 * the manifest deflated, every asset stored. Assets without bytes are copied from `source`.
 */
async function writeBoardFile(target: string, payload: DocPayload, source: Doc | null) {
  validate(payload, source);
  const tmp = join(dirname(target), `.${basename(target)}.${randomUUID().slice(0, 8)}.tmp`);
  const out = createWriteStream(tmp);
  const failed = new Promise<never>((_, reject) => out.once('error', reject));
  const entries: WrittenEntry[] = [];
  let offset = 0;
  const add = async (
    name: string,
    method: 0 | 8,
    data: Uint8Array | null,
    meta: { crc32: number; size: number },
    copy?: Asset,
  ) => {
    const e = {
      name,
      method,
      crc32: meta.crc32,
      compressedSize: data?.byteLength ?? meta.size,
      size: meta.size,
    };
    const header = localHeader(e);
    entries.push({ ...e, headerOffset: offset });
    await writeAll(out, header);
    if (data) await writeAll(out, data);
    else if (copy?.bytes) await writeAll(out, copy.bytes);
    else if (copy && source?.path)
      for await (const chunk of createReadStream(source.path, {
        start: copy.offset,
        end: copy.offset + copy.size - 1,
      }))
        await writeAll(out, chunk as Uint8Array);
    offset += header.length + e.compressedSize;
  };
  try {
    const raw = new TextEncoder().encode(payload.manifest);
    await Promise.race([
      (async () => {
        await add(BOARD_FILE_MANIFEST_NAME, 8, new Uint8Array(deflateRawSync(raw)), {
          crc32: crc(raw),
          size: raw.length,
        });
        for (const f of payload.files) {
          if (f.bytes) await add(f.path, 0, f.bytes, { crc32: crc(f.bytes), size: f.bytes.byteLength });
          else {
            const a = source!.assets.get(f.path)!;
            await add(f.path, 0, null, a, a);
          }
        }
        await writeAll(out, centralDirectory(entries, offset));
        await new Promise<void>((r, j) => out.end((err?: Error | null) => (err ? j(err) : r())));
      })(),
      failed,
    ]);
    // Flush to disk before replacing the old file (a rename alone is not durable).
    const fh = await open(tmp, 'r+');
    await fh.sync();
    await fh.close();
    await rename(tmp, target);
  } catch (e) {
    out.destroy();
    await rm(tmp, { force: true });
    throw e;
  }
}

async function askPath(win: BrowserWindow | null, suggestedName: string, near: string | null) {
  const name = suggestedName.toLowerCase().endsWith('.annie3d') ? suggestedName : `${suggestedName}.annie3d`;
  const opts = {
    defaultPath: join(near ? dirname(near) : app.getPath('documents'), name),
    filters: [{ name: 'Annie 3D board', extensions: ['annie3d'] }],
  };
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  return r.canceled || !r.filePath ? null : r.filePath;
}

export async function save(
  id: string,
  payload: DocPayload,
  opts: { as: boolean; suggestedName: string },
  sender: Electron.WebContents,
) {
  const d = docOf(id, sender);
  const target = opts.as || !d.path ? await askPath(d.win, opts.suggestedName || d.name, d.path) : d.path;
  if (!target) return null;
  await writeBoardFile(target, payload, d);
  const fresh = await index(target);
  Object.assign(d, fresh, { path: target, name: basename(target), draft: false, dirty: false });
  syncWindow(d);
  app.addRecentDocument(target);
  return { name: d.name, path: target };
}

export async function saveCopy(payload: DocPayload, suggestedName: string, win: BrowserWindow | null) {
  if (payload.files.some((f) => !f.bytes)) throw new ZipError('Every file needs its bytes');
  const target = await askPath(win, suggestedName, null);
  if (!target) return null;
  await writeBoardFile(target, payload, null);
  app.addRecentDocument(target);
  return { name: basename(target), path: target };
}

/** Unsaved edits kept in memory across a reload: new bytes stay here, the rest in the file. */
export function stash(id: string, payload: DocPayload, sender: Electron.WebContents) {
  const d = docOf(id, sender);
  validate(payload, d);
  const assets = new Map<string, Asset>();
  for (const f of payload.files) {
    if (f.bytes)
      assets.set(f.path, { offset: 0, size: f.bytes.byteLength, crc32: crc(f.bytes), bytes: f.bytes });
    else assets.set(f.path, d.assets.get(f.path)!);
  }
  Object.assign(d, { manifest: payload.manifest, assets, bundles: bundlesOf(payload.manifest), draft: true });
}

/** The current state as a temporary board file, for uploading (served at `/__doc/<id>/__pack`). */
export async function pack(id: string, payload: DocPayload, sender: Electron.WebContents) {
  const d = docOf(id, sender);
  const dir = join(tmpdir(), 'annie3d-packs');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${d.id}.annie3d`);
  await writeBoardFile(file, payload, d);
  d.pack = { file, size: (await stat(file)).size };
  return { url: `/__doc/${d.id}/__pack`, size: d.pack.size };
}
