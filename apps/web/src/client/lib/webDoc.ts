import {
  BOARD_FILE_MANIFEST,
  type BoardFileOutput,
  type DocPayload,
  entryDataOffset,
  readManifestText,
  readZipIndex,
  type ZipEntry,
} from '@annie3d/contracts';
import { inflateSync } from 'fflate';
import { t } from '../i18n';
import { kvDelete, kvGet, kvPut } from '../store/persist';
import { blobRange, payloadBlob, zipBlob } from './boardFile';
import { type DocHost, useDoc } from './doc';

/**
 * Board files on the website, where the File System Access API exists (Chrome and Edge; Safari
 * and Firefox do not have it and download a copy instead). Open picks a file and shows it in
 * this tab without reloading (`?file=<key>`; Back returns to the board). The handle is also kept
 * in IndexedDB, so reloading the tab keeps the file. Not a new tab: the picker uses up the click
 * that would allow one. Save writes the same file back.
 * The browser writes to a temporary file and swaps it in when the write closes, so a failed save
 * leaves the old file whole. Assets are slices of the file: nothing is loaded until shown.
 */

/** File types for the browser's file pickers, named in the current language. */
const TYPES = (): { description: string; accept: Record<string, string[]> }[] => [
  { description: t('file.typeDescription'), accept: { 'application/vnd.annie3d+zip': ['.annie3d'] } },
];
const handleKey = (key: string) => `handle:${key}`;
const draftKey = (key: string) => `draft:${key}`;

type Picker = Window & {
  showOpenFilePicker(o: object): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(o: object): Promise<FileSystemFileHandle>;
};
type Permitted = FileSystemFileHandle & {
  queryPermission(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};
const picker = () => window as unknown as Picker;

/**
 * ⌘O on the website: the picked file opens in this tab. The board left behind is already saved
 * (cloud boards sync, guest boards stay in the browser); a file with unsaved edits asks first.
 */
export async function openFileInTab() {
  try {
    const [handle] = await picker().showOpenFilePicker({ types: TYPES(), multiple: false });
    if (!handle) return;
    const key = crypto.randomUUID();
    await kvPut(handleKey(key), handle);
    history.pushState(null, '', `/?file=${key}`);
    // Back leaves the file: reload onto the board (a file with unsaved edits asks first).
    addEventListener('popstate', () => location.reload(), { once: true });
    const { loadDocument } = await import('./doc');
    await loadDocument({ key, handle });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e;
  }
}

async function write(handle: FileSystemFileHandle, blob: Blob) {
  const h = handle as Permitted;
  if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted')
    if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted')
      throw new Error(t('file.writeDenied'));
  const w = await handle.createWritable();
  await w.write(blob);
  await w.close();
}

/** ⌘S on a cloud or guest board: save a copy as a new file. */
export async function saveCopyAs(p: DocPayload, suggestedName: string) {
  const handle = await picker().showSaveFilePicker({ suggestedName, types: TYPES() });
  await write(handle, payloadBlob(p));
  return { name: handle.name };
}

/** After a reload the browser may ask before the file can be read again (a click is needed). */
export async function requestAccess(key: string) {
  const h = await kvGet<Permitted>(handleKey(key));
  return !!h && (await h.requestPermission({ mode: 'read' })) === 'granted';
}

export async function webDocHost(key: string, picked?: FileSystemFileHandle): Promise<DocHost> {
  let handle = (picked as Permitted | undefined) ?? (await kvGet<Permitted>(handleKey(key)));
  if (!handle) throw new Error(t('file.notOpenHere'));
  if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
    useDoc.setState({ needsPermission: handle.name });
    throw new Error(t('file.allowAccess', { name: handle.name }));
  }
  let file: File;
  let entries = new Map<string, ZipEntry>();
  const offsets = new Map<string, number>();
  /** URLs handed out for this file's assets (they move when the file is rewritten). */
  const shown = new Map<string, { url: string; mime: string; bundle?: BoardFileOutput['bundle'] }>();
  const index = async () => {
    file = await handle!.getFile();
    const read = blobRange(file);
    entries = await readZipIndex(read, file.size);
    offsets.clear();
    for (const e of entries.values())
      if (e.name !== BOARD_FILE_MANIFEST) offsets.set(e.name, await entryDataOffset(read, e));
    return read;
  };
  const slice = (path: string, mime = 'application/octet-stream') => {
    const e = entries.get(path);
    const at = offsets.get(path);
    return e && at !== undefined ? { blob: file.slice(at, at + e.size, mime), crc32: e.crc32 } : null;
  };
  const bundleBlob = (members: NonNullable<BoardFileOutput['bundle']>) => {
    const parts = members.map((m) => ({ m, s: slice(m.path) }));
    if (parts.some((p) => !p.s)) return null;
    return zipBlob(parts.map(({ m, s }) => ({ name: m.name, blob: s!.blob, crc32: s!.crc32 })));
  };
  const show = (path: string, blob: Blob, mime: string, bundle?: BoardFileOutput['bundle']) => {
    const url = URL.createObjectURL(blob);
    shown.set(path, { url, mime, bundle });
    return { url, size: blob.size };
  };
  let unload: ((e: BeforeUnloadEvent) => void) | null = null;

  return {
    prefix: null,
    async read() {
      const read = await index();
      const draft = await kvGet<{ manifest: string; files: { path: string; bytes: Uint8Array }[] }>(
        draftKey(key),
      );
      const drafted = new Map(draft?.files.map((f) => [f.path, f.bytes]));
      const manifest =
        draft?.manifest ??
        (await readManifestText(read, entries, (d, size) => inflateSync(d, { out: new Uint8Array(size) })));
      return {
        name: handle!.name,
        path: handle!.name,
        manifest,
        draft: !!draft,
        assets: new Set(offsets.keys()),
        async fileOf(path, mime) {
          const bytes = drafted.get(path);
          if (bytes) return show(path, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }), mime);
          const s = slice(path, mime);
          return s ? show(path, s.blob, mime) : null;
        },
        async bundleOf(f) {
          const b = bundleBlob(f.bundle!);
          return b ? show(f.path, b, 'application/zip', f.bundle) : null;
        },
      };
    },
    async save(payload, as, suggestedName) {
      let target: Permitted = handle!;
      if (as) target = (await picker().showSaveFilePicker({ suggestedName, types: TYPES() })) as Permitted;
      await write(
        target,
        payloadBlob(payload, (p) => slice(p)),
      );
      if (target !== handle) {
        handle = target;
        await kvPut(handleKey(key), handle);
      }
      // The file was replaced: slices of the old one can no longer be read. New slices, new URLs.
      await index();
      const moved = new Map<string, string>();
      for (const [path, s] of shown) {
        const blob = s.bundle ? bundleBlob(s.bundle) : slice(path, s.mime)?.blob;
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        moved.set(s.url, url);
        shown.set(path, { ...s, url });
      }
      await kvDelete(draftKey(key));
      return { name: handle.name, path: handle.name, moved };
    },
    async pack(payload) {
      const blob = payloadBlob(payload, (p) => slice(p));
      return { size: blob.size, slice: async (o, l) => blob.slice(o, o + l) };
    },
    async stash(payload) {
      await kvPut(draftKey(key), {
        manifest: payload.manifest,
        files: payload.files.filter((f) => f.bytes),
      });
    },
    setDirty(dirty, name) {
      document.title = dirty ? t('file.windowTitleUnsaved', { name }) : t('file.windowTitle', { name });
      if (dirty && !unload) {
        unload = (e) => e.preventDefault();
        window.addEventListener('beforeunload', unload);
      } else if (!dirty && unload) {
        window.removeEventListener('beforeunload', unload);
        unload = null;
      }
    },
    close: () => window.close(),
  };
}
