import { type IDBPDatabase, openDB } from 'idb';

const DB_NAME = '3dads-demo';
const DB_VERSION = 1;

export interface DemoStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  putBlob(key: string, blob: Blob): Promise<void>;
  getBlob(key: string): Promise<Blob | undefined>;
  delBlob(key: string): Promise<void>;
  blobKeys(): Promise<string[]>;
  clear(): Promise<void>;
  readonly kind: 'indexeddb' | 'memory';
}

class MemoryStore implements DemoStore {
  readonly kind = 'memory' as const;
  private map = new Map<string, unknown>();
  private blobs = new Map<string, Blob>();
  async get<T>(key: string) {
    return this.map.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    const existing = this.map.get(key) as { savedAt?: number } | undefined;
    const incoming = value as { savedAt?: number };
    if (!(existing?.savedAt && incoming?.savedAt && existing.savedAt > incoming.savedAt))
      this.map.set(key, structuredClone(value));
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async keys() {
    return [...this.map.keys()];
  }
  async putBlob(key: string, blob: Blob) {
    this.blobs.set(key, blob);
  }
  async getBlob(key: string) {
    return this.blobs.get(key);
  }
  async delBlob(key: string) {
    this.blobs.delete(key);
  }
  async blobKeys() {
    return [...this.blobs.keys()];
  }
  async clear() {
    this.map.clear();
    this.blobs.clear();
  }
}

interface StoredBlob {
  type: string;
  buffer: ArrayBuffer;
}

class IdbStore implements DemoStore {
  readonly kind = 'indexeddb' as const;
  constructor(private db: IDBPDatabase) {}
  async get<T>(key: string) {
    return (await this.db.get('state', key)) as T | undefined;
  }
  async set<T>(key: string, value: T) {
    const tx = this.db.transaction('state', 'readwrite');
    const existing = (await tx.store.get(key)) as { savedAt?: number } | undefined;
    const incoming = value as { savedAt?: number };
    // A write from an older page instance must not clobber a newer record.
    const skip = !!(existing?.savedAt && incoming?.savedAt && existing.savedAt > incoming.savedAt);
    if (!skip) await tx.store.put(value, key);
    await tx.done;
  }
  async del(key: string) {
    await this.db.delete('state', key);
  }
  async keys() {
    return (await this.db.getAllKeys('state')).map(String);
  }
  async putBlob(key: string, blob: Blob) {
    // WebKit cannot structured-clone File objects taken from <input type=file>
    // ("Error preparing Blob/File data to be stored in object store"), so store bytes + type.
    const buffer = await blob.arrayBuffer();
    await this.db.put('blobs', { type: blob.type, buffer } satisfies StoredBlob, key);
  }
  async getBlob(key: string) {
    const rec = (await this.db.get('blobs', key)) as StoredBlob | Blob | undefined;
    if (!rec) return undefined;
    if (rec instanceof Blob) return rec;
    return new Blob([rec.buffer], { type: rec.type });
  }
  async delBlob(key: string) {
    await this.db.delete('blobs', key);
  }
  async blobKeys() {
    return (await this.db.getAllKeys('blobs')).map(String);
  }
  async clear() {
    await this.db.clear('state');
    await this.db.clear('blobs');
  }
}

export async function openDemoStore(opts: { memory?: boolean } = {}): Promise<DemoStore> {
  if (opts.memory || typeof indexedDB === 'undefined') return new MemoryStore();
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      },
    });
    return new IdbStore(db);
  } catch {
    return new MemoryStore();
  }
}

export async function deleteDemoDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
