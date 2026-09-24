import { type IDBPDatabase, openDB } from 'idb';

/** Local-first storage (Linear sync engine: IndexedDB cache + queued transactions). */
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('annie3d', 1, {
    upgrade(d) {
      d.createObjectStore('outbox'); // key: boardId → PendingBatch[]
      d.createObjectStore('guest'); // key: 'board' → guest board records
      d.createObjectStore('kv');
    },
  });
  return dbp;
}

export interface PendingBatch {
  opId: string;
  ops: unknown[];
}

export async function loadOutbox(boardId: string): Promise<PendingBatch[]> {
  try {
    return ((await (await db()).get('outbox', boardId)) as PendingBatch[] | undefined) ?? [];
  } catch {
    return [];
  }
}
export async function saveOutbox(boardId: string, batches: PendingBatch[]) {
  try {
    await (await db()).put('outbox', batches, boardId);
  } catch {
    /* private mode or quota: the in-memory queue still works for this session */
  }
}
export async function loadGuest<T>(): Promise<T | undefined> {
  try {
    return (await (await db()).get('guest', 'board')) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function saveGuest<T>(value: T) {
  try {
    await (await db()).put('guest', value, 'board');
  } catch {}
}
export async function clearGuest() {
  try {
    await (await db()).delete('guest', 'board');
  } catch {}
}

/**
 * Guest uploads: stored as { type, buffer } because WebKit's IndexedDB cannot store File/Blob
 * reliably (cross-browser matrix, 2026-09-22). Keyed by asset id in the `kv` store.
 */
export async function saveGuestFile(assetId: string, file: Blob) {
  try {
    await (await db()).put('kv', { type: file.type, buffer: await file.arrayBuffer() }, `file:${assetId}`);
  } catch {}
}
export async function loadGuestFileUrl(assetId: string): Promise<string | null> {
  try {
    const v = (await (await db()).get('kv', `file:${assetId}`)) as
      | { type: string; buffer: ArrayBuffer }
      | undefined;
    return v ? URL.createObjectURL(new Blob([v.buffer], { type: v.type })) : null;
  } catch {
    return null;
  }
}
export async function clearGuestFiles() {
  try {
    const d = await db();
    const keys = (await d.getAllKeys('kv')).filter((k) => String(k).startsWith('file:'));
    const tx = d.transaction('kv', 'readwrite');
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  } catch {}
}

/** Blob URLs die with the page: rebuild them from stored bytes when a guest board is reopened. */
export async function rehydrateGuestUrls<
  V extends { outputs: { id: string; urls: Record<string, string | null> }[] },
>(versions: V[]): Promise<V[]> {
  return Promise.all(
    versions.map(async (v) => {
      if (!v.outputs.some((o) => Object.values(o.urls).some((u) => u?.startsWith('blob:')))) return v;
      const outputs = await Promise.all(
        v.outputs.map(async (o) => {
          const url = await loadGuestFileUrl(o.id);
          if (!url) return o;
          // Opened board files keep their own poster/thumb/turntable (`<id>:<key>`); uploads reuse the original.
          const entries = await Promise.all(
            Object.entries(o.urls).map(async ([k, u]) => [
              k,
              u?.startsWith('blob:')
                ? (k !== 'original' && (await loadGuestFileUrl(`${o.id}:${k}`))) || url
                : u,
            ]),
          );
          return { ...o, urls: Object.fromEntries(entries) };
        }),
      );
      return { ...v, outputs };
    }),
  );
}
