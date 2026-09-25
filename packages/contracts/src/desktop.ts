/**
 * Desktop app contracts shared by the website build, the Electron shell and the web client.
 *
 * Web pack: the website's built files, as the app stores and serves them. Every deploy publishes
 * `/desktop/manifest.json` next to the site's own files. The app checks it every minute, downloads
 * only files whose sha256 it does not have yet (Vite file names are content-hashed, so unchanged
 * chunks are reused) in the background, and restarts into the new version when the user clicks
 * "Restart to update".
 */
export interface WebPackFile {
  /** Site path without the leading slash, e.g. `assets/index-5_FOD83w.js`. */
  path: string;
  sha256: string;
  size: number;
  /** Feature ids whose code is in this file (see features.ts). */
  features: string[];
}

export interface WebPackManifest {
  format: 'annie3d-webpack';
  version: string;
  /** Milliseconds since epoch; the app never moves to an older build. */
  builtAt: number;
  /** Oldest shell (app) version that can run this web pack. */
  minShell: string;
  features: Record<string, { title: string; surface: 'shared' | 'desktop' }>;
  files: WebPackFile[];
}

/** `/desktop/manifest.json`: the manifest text and its Ed25519 signature (base64). */
export interface SignedWebPack {
  manifest: string;
  signature: string | null;
  keyId: string | null;
}

export type WebUpdateState =
  | { status: 'idle' | 'checking' | 'up-to-date' }
  | { status: 'downloading'; version: string; done: number; total: number }
  | {
      status: 'ready';
      version: string;
      /** Titles of the features whose files changed, desktop-only ones marked. */
      changes: FeatureChange[];
      bytes: number;
      files: number;
    }
  | { status: 'shell-required'; version: string; minShell: string }
  | { status: 'error'; message: string };

export type ShellUpdateState =
  | { status: 'idle' | 'unavailable' | 'checking' | 'up-to-date' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string };

export interface DesktopUpdateState {
  web: WebUpdateState;
  shell: ShellUpdateState;
  /** Web pack version the window is showing. */
  current: string;
  /** Set once after a rollback, until the next successful update. */
  rolledBackFrom: string | null;
}

export interface FeatureChange {
  id: string;
  title: string;
  surface: 'shared' | 'desktop';
}

export interface DesktopInfo {
  shellVersion: string;
  platform: string;
  arch: string;
  webVersion: string;
  /** `dev` loads the live dev server; `pack` serves the stored web pack. */
  mode: 'dev' | 'pack';
}

/** `window.annieDesktop`: the only bridge between the web app and the desktop shell. */
export interface DesktopBridge {
  apiVersion: 1;
  info(): Promise<DesktopInfo>;
  updates: {
    get(): Promise<DesktopUpdateState>;
    check(): Promise<DesktopUpdateState>;
    /** `web` and `shell`: restart the app into the downloaded update. */
    apply(layer: 'web' | 'shell'): Promise<void>;
    onChange(cb: (s: DesktopUpdateState) => void): () => void;
  };
  /** The page is up (board rendered): confirms a fresh web-pack update (else it rolls back). */
  ready(): void;
  /**
   * Files the OS asked the app to open. Shells with `docs` open each file in its own window
   * instead; older shells deliver them here to import into the current board.
   */
  onOpenFile(cb: (file: { name: string; bytes: Uint8Array }) => void): () => void;
  /** Board files as documents (shell 0.3.0+). Absent on older shells. */
  docs?: DocsBridge;
}

/**
 * A `.annie3d` file open in its own window (`?doc=<id>`). The page gets only the manifest; each
 * asset is served from the file on disk at `/__doc/<id>/<path>` (range requests, so video can
 * seek), so a large file never has to fit in the page's memory.
 */
export interface DocFile {
  id: string;
  name: string;
  /** Null until a new document is first saved. */
  path: string | null;
  /** The manifest (annie3d.json) text; null for a new, empty document. */
  manifest: string | null;
  /** Assets the window can load from `/__doc/<id>/<path>`. */
  assets: { path: string; size: number }[];
  /** The manifest and some assets are unsaved edits kept across a reload (sign-in). */
  draft: boolean;
}

/**
 * What to write: the manifest, and per asset either new bytes or nothing (copy the asset of
 * that path from the open document, straight from disk).
 */
export interface DocPayload {
  manifest: string;
  files: { path: string; bytes?: Uint8Array }[];
}

export type DocCommand = 'save' | 'saveAs' | 'saveAndClose' | 'import';

export interface DocsBridge {
  /** The document this window shows. */
  read(id: string): Promise<DocFile | null>;
  /**
   * Writes the document (to a temporary file, then renamed over the target). Asks where first
   * when it has no path yet or `as` is set. Resolves to its name and path, or null if cancelled.
   */
  save(
    id: string,
    payload: DocPayload,
    opts: { as: boolean; suggestedName: string },
  ): Promise<{
    name: string;
    path: string;
  } | null>;
  /** Save a board that is not a file (cloud or guest) as a new file; every asset has bytes. */
  saveCopy(payload: DocPayload, suggestedName: string): Promise<{ name: string; path: string } | null>;
  /** Keep unsaved edits in the app across a reload of this window. */
  stash(id: string, payload: DocPayload): Promise<void>;
  /** The current state as a temporary board file, served at `url` (range requests) for upload. */
  pack(id: string, payload: DocPayload): Promise<{ url: string; size: number }>;
  /** Unsaved changes: the window shows it and asks before closing. */
  setDirty(id: string, dirty: boolean): void;
  /** File > Open: pick files, each opens in its own window. */
  open(): void;
  /** File > New: an empty document in a new window. */
  create(): void;
  /** Close this document's window without asking (after the save the close asked for). */
  close(id: string): void;
  /** Commands from the app menu and the close dialog. */
  onCommand(cb: (c: DocCommand) => void): () => void;
}

/** Compares dotted numeric versions (`1.2.10` > `1.2.9`). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
