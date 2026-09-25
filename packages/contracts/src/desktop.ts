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
  /** Files the OS asked the app to open (double-click on `.annie3d`, drag on the dock icon). */
  onOpenFile(cb: (file: { name: string; bytes: Uint8Array }) => void): () => void;
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
