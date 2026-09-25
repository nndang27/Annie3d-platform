import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  compareVersions,
  type SignedWebPack,
  type WebPackManifest,
  type WebUpdateState,
} from '@annie3d/contracts/desktop';
import { app, net } from 'electron';
import { ALLOW_UNSIGNED, ORIGIN } from './config';
import { PACK_KEYS } from './packKey';

/**
 * Web pack store and updater (layer W of docs/DESKTOP_APP_PLAN.md).
 *
 * - Files are stored content-addressed (`userData/webpack/cas/<sha256>`); a version is just its
 *   manifest (`versions/<version>.json`). The pack bundled inside the app is the first version,
 *   read in place, so the first launch works offline.
 * - `check()` fetches `<origin>/desktop/manifest.json`, verifies its Ed25519 signature, downloads
 *   only files whose sha256 is not stored yet (each verified), then reports "ready" with the
 *   features whose files changed.
 * - `stageForRestart()` makes the new version current for the next start, and the shell
 *   restarts (like Chrome, VS Code or the Claude app: "Restart to update"). On that start the
 *   page must call `ready` within 20 s or the previous version comes back (rollback), as Capgo
 *   does for Capacitor. A start that finds an update still unconfirmed (it crashed or was quit
 *   before confirming) rolls back at once.
 */
interface Pointer {
  current: string | null;
  previous: string | null;
  /** The current version has not confirmed (`ready`) yet. */
  pending: boolean;
  /** Set by "Restart to update": the next start is that update's first start. */
  restart?: boolean;
}

const MAX_FILE = 64 * 1024 * 1024;
const CONFIRM_MS = Number(process.env.ANNIE3D_CONFIRM_MS) || 20_000;

export class WebPackStore {
  private readonly root = join(app.getPath('userData'), 'webpack');
  private readonly cas = join(this.root, 'cas');
  private readonly versionsDir = join(this.root, 'versions');
  private readonly pointerFile = join(this.root, 'current.json');
  private active: WebPackManifest | null = null;
  private byPath = new Map<string, string>();
  private bundledBySha = new Map<string, string>();
  private staged: WebPackManifest | null = null;
  private confirmTimer: NodeJS.Timeout | null = null;
  state: WebUpdateState = { status: 'idle' };
  rolledBackFrom: string | null = null;

  constructor(
    private readonly bundledDir: string,
    private readonly onState: () => void,
    private readonly reloadAll: () => void,
  ) {}

  async init() {
    await mkdir(this.cas, { recursive: true });
    await mkdir(this.versionsDir, { recursive: true });
    const b = await this.readManifestFile(join(this.bundledDir, 'desktop/manifest.json'), false);
    for (const f of b?.files ?? []) this.bundledBySha.set(f.sha256, f.path);
    const ptr = await this.pointer();
    let m: WebPackManifest | null = null;
    if (ptr.current && ptr.current !== b?.version) m = await this.loadVersion(ptr.current);
    // A newer app install can bundle a newer pack than the one downloaded earlier.
    if (m && b && b.builtAt > m.builtAt) m = null;
    if (ptr.pending && m && ptr.restart) {
      // First start after "Restart to update": run the new version; it must confirm in time.
      const prev = ptr.previous === b?.version ? b : ptr.previous ? await this.loadVersion(ptr.previous) : b;
      await this.writePointer({ ...ptr, restart: false });
      this.setActive(m);
      if (prev) this.armConfirm(prev, m.version);
      return;
    }
    if (ptr.pending && m) {
      // The app quit before the page confirmed the new version: treat as failed.
      this.rolledBackFrom = m.version;
      m = ptr.previous ? await this.loadVersion(ptr.previous) : null;
      await this.writePointer({ current: m?.version ?? null, previous: null, pending: false });
    }
    this.setActive(m ?? b);
  }

  get version() {
    return this.active?.version ?? 'none';
  }

  /** Response for a site path from the active pack, or null to let it go to the network. */
  async serve(pathname: string, headers: (path: string) => Record<string, string>): Promise<Response | null> {
    if (!this.active) return null;
    const p = decodeURIComponent(pathname).replace(/^\/+/, '');
    const candidates = p === '' ? ['index.html'] : [p, `${p}/index.html`, `${p}.html`];
    let path = candidates.find((c) => this.byPath.has(c));
    // Single-page app: unknown routes get the shell page (same as the Worker's SPA handling);
    // a missing file under /assets is a real 404.
    if (!path) {
      if (p.startsWith('assets/') || /\.[a-z0-9]{2,5}$/i.test(p)) return null;
      path = 'index.html';
    }
    const sha = this.byPath.get(path)!;
    const file = await this.locate(sha);
    if (!file) return null;
    const body = await readFile(file);
    return new Response(body, {
      status: 200,
      headers: { 'content-type': contentType(path), 'cache-control': 'no-cache', ...headers(`/${path}`) },
    });
  }

  /** Reads a text file of the active pack (e.g. `_headers`). */
  async readText(path: string): Promise<string | null> {
    const sha = this.byPath.get(path);
    const file = sha ? await this.locate(sha) : null;
    return file ? readFile(file, 'utf8') : null;
  }

  async check(): Promise<WebUpdateState> {
    if (this.state.status === 'downloading' || this.state.status === 'checking') return this.state;
    // With an update already downloaded, check quietly: the "Restart to update" pill must not
    // blink every minute while the next manifest is fetched.
    const quiet = this.state.status === 'ready';
    if (!quiet) this.set({ status: 'checking' });
    try {
      const res = await net.fetch(`${ORIGIN}/desktop/manifest.json?t=${Date.now()}`, {
        bypassCustomProtocolHandlers: true,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const next = this.parseSigned((await res.json()) as SignedWebPack, true);
      if (!this.active || next.version === this.active.version || next.builtAt <= this.active.builtAt)
        return quiet ? this.state : this.set({ status: 'up-to-date' });
      if (compareVersions(app.getVersion(), next.minShell) < 0)
        return this.set({ status: 'shell-required', version: next.version, minShell: next.minShell });
      if (this.staged?.version === next.version) return this.readyState(next);
      const missing = [];
      for (const f of next.files) if (!(await this.locate(f.sha256))) missing.push(f);
      const total = missing.reduce((a, f) => a + f.size, 0);
      let done = 0;
      this.set({ status: 'downloading', version: next.version, done, total });
      // Four at a time: most deploys change a handful of files.
      for (let i = 0; i < missing.length; i += 4) {
        await Promise.all(
          missing.slice(i, i + 4).map(async (f) => {
            await this.download(f.path, f.sha256, f.size);
            done += f.size;
            this.set({ status: 'downloading', version: next.version, done, total });
          }),
        );
      }
      await writeFile(join(this.versionsDir, `${safe(next.version)}.json`), JSON.stringify(next));
      this.staged = next;
      return this.readyState(next);
    } catch (e) {
      return quiet ? this.state : this.set({ status: 'error', message: (e as Error).message });
    }
  }

  /** Makes the downloaded version current for the next start; the caller then restarts the app. */
  async stageForRestart(): Promise<boolean> {
    const next = this.staged;
    if (!next || !this.active) return false;
    await this.writePointer({
      current: next.version,
      previous: this.active.version,
      pending: true,
      restart: true,
    });
    return true;
  }

  /** The page of `version` must call `ready` in time, or `previous` comes back. */
  private armConfirm(previous: WebPackManifest, version: string) {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = setTimeout(() => void this.rollback(previous, version), CONFIRM_MS);
  }

  /** The page started: a pending update is now final; unreferenced files are cleaned up. */
  async confirm() {
    if (!this.confirmTimer) return;
    clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
    const ptr = await this.pointer();
    await this.writePointer({ ...ptr, pending: false });
    this.rolledBackFrom = null;
    this.onState();
    void this.gc(ptr);
  }

  private async rollback(previous: WebPackManifest, failed: string) {
    this.confirmTimer = null;
    this.rolledBackFrom = failed;
    await this.writePointer({ current: previous.version, previous: null, pending: false });
    this.setActive(previous);
    this.set({ status: 'idle' });
    this.reloadAll();
  }

  /** Features whose files differ between two versions (libraries left out), and their size. */
  private diff(from: WebPackManifest | null, to: WebPackManifest) {
    const have = new Set(from?.files.map((f) => f.sha256));
    const changed = to.files.filter((f) => !have.has(f.sha256));
    const ids = [...new Set(changed.flatMap((f) => f.features))].filter((id) => id !== 'libraries');
    return {
      changes: ids.map((id) => ({
        id,
        title: to.features[id]?.title ?? id,
        surface: to.features[id]?.surface ?? ('shared' as const),
      })),
      bytes: changed.reduce((a, f) => a + f.size, 0),
      files: changed.length,
    };
  }

  private readyState(next: WebPackManifest): WebUpdateState {
    return this.set({
      status: 'ready',
      version: next.version,
      ...this.diff(this.active, next),
    });
  }

  private set(s: WebUpdateState): WebUpdateState {
    const same = JSON.stringify(s) === JSON.stringify(this.state);
    this.state = s;
    if (!same) this.onState(); // a check every minute must not re-render the page when nothing changed
    return s;
  }

  private setActive(m: WebPackManifest | null) {
    this.active = m;
    this.byPath = new Map(m?.files.map((f) => [f.path, f.sha256]));
  }

  private async locate(sha: string): Promise<string | null> {
    const own = join(this.cas, sha);
    if (existsSync(own)) return own;
    const b = this.bundledBySha.get(sha);
    return b ? join(this.bundledDir, b) : null;
  }

  private async download(path: string, sha: string, size: number) {
    if (size > MAX_FILE) throw new Error(`${path} is too large`);
    const res = await net.fetch(`${ORIGIN}/${path}`, { bypassCustomProtocolHandlers: true });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = createHash('sha256').update(buf).digest('hex');
    if (got !== sha) throw new Error(`${path}: checksum mismatch`);
    const tmp = join(this.cas, `${sha}.part`);
    await writeFile(tmp, buf);
    await rename(tmp, join(this.cas, sha));
  }

  private parseSigned(s: SignedWebPack, requireSignature: boolean): WebPackManifest {
    const key = s.keyId ? PACK_KEYS[s.keyId] : undefined;
    if (s.signature && key) {
      const pub = createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' });
      if (!verify(null, Buffer.from(s.manifest), pub, Buffer.from(s.signature, 'base64')))
        throw new Error('web pack signature is invalid');
    } else if (requireSignature && !ALLOW_UNSIGNED) {
      throw new Error('web pack is not signed');
    }
    const m = JSON.parse(s.manifest) as WebPackManifest;
    if (m.format !== 'annie3d-webpack' || !Array.isArray(m.files)) throw new Error('not a web pack');
    for (const f of m.files)
      if (!/^[a-f0-9]{64}$/.test(f.sha256) || f.path.includes('..') || f.path.startsWith('/'))
        throw new Error('bad web pack entry');
    return m;
  }

  private async readManifestFile(file: string, requireSignature: boolean) {
    try {
      return this.parseSigned(JSON.parse(await readFile(file, 'utf8')) as SignedWebPack, requireSignature);
    } catch {
      return null;
    }
  }

  private async loadVersion(v: string): Promise<WebPackManifest | null> {
    try {
      const m = JSON.parse(
        await readFile(join(this.versionsDir, `${safe(v)}.json`), 'utf8'),
      ) as WebPackManifest;
      for (const f of m.files) if (!(await this.locate(f.sha256))) return null;
      return m;
    } catch {
      return null;
    }
  }

  private async pointer(): Promise<Pointer> {
    try {
      return JSON.parse(await readFile(this.pointerFile, 'utf8')) as Pointer;
    } catch {
      return { current: null, previous: null, pending: false };
    }
  }

  private async writePointer(p: Pointer) {
    const tmp = `${this.pointerFile}.tmp`;
    await writeFile(tmp, JSON.stringify(p));
    await rename(tmp, this.pointerFile);
  }

  /** Keep the files of the current and previous versions; drop everything else. */
  private async gc(ptr: Pointer) {
    const keep = new Set<string>();
    for (const v of [ptr.current, ptr.previous]) {
      const m = v ? await this.loadVersion(v) : null;
      for (const f of m?.files ?? []) keep.add(f.sha256);
    }
    const { readdir } = await import('node:fs/promises');
    for (const name of await readdir(this.cas))
      if (!keep.has(name)) await rm(join(this.cas, name), { force: true });
    for (const name of await readdir(this.versionsDir)) {
      const v = name.replace(/\.json$/, '');
      if (v !== safe(ptr.current ?? '') && v !== safe(ptr.previous ?? ''))
        await rm(join(this.versionsDir, name), { force: true });
    }
  }
}

const safe = (v: string) => v.replace(/[^A-Za-z0-9._-]/g, '_');

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  webmanifest: 'application/manifest+json',
};
function contentType(path: string) {
  return TYPES[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';
}
