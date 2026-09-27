import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShellUpdateState } from '@annie3d/contracts/desktop';
import { app } from 'electron';
import { shellSourceHash } from '../../scripts/local-source.mjs';

/**
 * A local build (scripts/install-local.mjs) runs this machine's source: the web app from its dev
 * server and the studio from its own, both started here when they are not running yet. The
 * installer writes `local.json` into the app's resources; without it the app is a normal build.
 * The web app runs from its dev server; the studio from a production build (see ensureStudio).
 */
export type LocalConfig = {
  /** The 3Dads project root. */
  root: string;
  webUrl: string;
  studioUrl: string;
  /** PATH of the shell that installed the app (a Dock launch has almost none). */
  path: string;
  node: string;
  bun: string;
  /** shellSourceHash() of apps/desktop when this app was built. */
  sourceHash: string;
  builtAt: string;
};

function readLocal(): LocalConfig | null {
  try {
    const file = join(process.resourcesPath, 'local.json');
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as LocalConfig) : null;
  } catch {
    return null;
  }
}

export const LOCAL: LocalConfig | null = app.isPackaged ? readLocal() : null;

const PLATFORM = LOCAL ? join(LOCAL.root, 'Production_system/3dads-platform') : '';
const DESKTOP = LOCAL ? join(PLATFORM, 'apps/desktop') : '';
const STUDIO = LOCAL ? join(LOCAL.root, 'Production_system/Pascal_editor') : '';

// ---- the two local servers ----
const children = new Set<ChildProcess>();
const starting = new Map<string, Promise<boolean>>();

async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

function ensure(name: string, url: string, command: string, args: string[], cwd: string): Promise<boolean> {
  const running = starting.get(name);
  if (running) return running;
  const job = (async () => {
    if (await answers(url)) return true;
    const logs = join(app.getPath('userData'), 'logs');
    mkdirSync(logs, { recursive: true });
    const log = createWriteStream(join(logs, `${name}.log`), { flags: 'a' });
    // Its own process group, so quitting stops the whole tree (pnpm → vite, bun → turbo → next).
    const child = spawn(command, args, {
      cwd,
      detached: true,
      env: { ...process.env, PATH: LOCAL?.path ?? process.env.PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.pipe(log);
    child.stderr?.pipe(log);
    children.add(child);
    child.on('exit', () => {
      children.delete(child);
      starting.delete(name);
    });
    for (let i = 0; i < 240; i++) {
      if (await answers(url)) return true;
      if (child.exitCode !== null) return false;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  })();
  starting.set(name, job);
  job.then((ok) => {
    if (!ok) starting.delete(name);
  });
  return job;
}

/** The Annie 3D web app's dev server (Vite + the Worker), from the local source. */
export function ensureWeb(): Promise<boolean> {
  if (!LOCAL) return Promise.resolve(true);
  return ensure('web', LOCAL.webUrl, LOCAL.node, [join(PLATFORM, 'scripts/dev.mjs')], PLATFORM);
}

// The studio runs as a production build (`next start` answers in about a second; the dev server
// needed a package build, five type watchers and a first compile, measured at tens of seconds).
// It is rebuilt only when its source changed since the last build (git state of the studio repo).
const STUDIO_APP = LOCAL ? join(STUDIO, 'apps/editor') : '';
const STUDIO_STAMP = LOCAL ? join(STUDIO_APP, '.next/annie-source') : '';

function studioSource(): string {
  const git = (...args: string[]) =>
    spawnSync('git', ['-C', STUDIO, ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: LOCAL?.path },
    }).stdout ?? '';
  const hash = createHash('sha256');
  hash.update(git('rev-parse', 'HEAD'));
  hash.update(git('diff', 'HEAD'));
  for (const file of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    hash.update(file);
    try {
      hash.update(readFileSync(join(STUDIO, file)));
    } catch {
      /* removed meanwhile */
    }
  }
  return hash.digest('hex').slice(0, 16);
}

function buildStudio(source: string): Promise<boolean> {
  return new Promise((resolve) => {
    const logs = join(app.getPath('userData'), 'logs');
    mkdirSync(logs, { recursive: true });
    const log = createWriteStream(join(logs, 'studio-build.log'), { flags: 'a' });
    const child = spawn(
      LOCAL!.bun,
      ['x', 'turbo', 'run', 'build', '--filter=./apps/editor', '--concurrency=2'],
      {
        cwd: STUDIO,
        env: { ...process.env, PATH: LOCAL?.path },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout?.pipe(log);
    child.stderr?.pipe(log);
    child.on('exit', (code) => {
      if (code === 0) writeFileSync(STUDIO_STAMP, source);
      resolve(code === 0);
    });
  });
}

let studioPhase: 'idle' | 'building' | 'starting' = 'idle';
/** What the studio window says while it waits. */
export const studioWaitText = () =>
  studioPhase === 'building' ? 'the studio (building the latest code, about a minute)' : 'the studio';

let studioJob: Promise<boolean> | null = null;
/** The studio server from the latest local source: built when needed, then started. */
export function ensureStudio(): Promise<boolean> {
  if (!LOCAL) return Promise.resolve(true);
  studioJob ??= (async () => {
    if (await answers(LOCAL.studioUrl)) return true;
    const source = studioSource();
    let stamp = '';
    try {
      stamp = readFileSync(STUDIO_STAMP, 'utf8');
    } catch {
      stamp = '';
    }
    if (stamp !== source) {
      studioPhase = 'building';
      const built = await buildStudio(source);
      if (!built && !existsSync(join(STUDIO_APP, '.next/BUILD_ID'))) return false;
    }
    studioPhase = 'starting';
    const port = new URL(LOCAL.studioUrl).port || '3002';
    return ensure(
      'studio',
      LOCAL.studioUrl,
      LOCAL.node,
      [join(STUDIO, 'node_modules/next/dist/bin/next'), 'start', '-p', port],
      STUDIO_APP,
    );
  })().finally(() => {
    studioPhase = 'idle';
  });
  const job = studioJob;
  job.then((ok) => {
    if (!ok) studioJob = null;
  });
  return job;
}

/** Servers this app started stop with it; servers someone else started keep running. */
export function stopLocalServers() {
  for (const child of children) {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

/** A page shown while a local server starts. */
export function startingPage(what: string) {
  const html = `<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#17191d;color:#f4f1ea;font:15px -apple-system,system-ui,sans-serif"><div style="text-align:center"><div style="opacity:.6;font-size:13px">Annie 3D</div><div style="margin-top:8px">Starting ${what}…</div></div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

// ---- shell updates for a local build ----
/**
 * The page's usual "update" button, for a local build: the shell's sources changed since this app
 * was built → "ready"; applying rebuilds and reinstalls the app, then opens the new one.
 */
export class LocalShellUpdater {
  state: ShellUpdateState = { status: 'idle' };
  constructor(private readonly onState: () => void) {}

  init() {
    void this.check();
    setInterval(() => void this.check(), 60_000);
    app.on('browser-window-focus', () => void this.check());
  }

  async check() {
    if (!LOCAL) return;
    let current: string;
    try {
      current = shellSourceHash(DESKTOP);
    } catch (e) {
      this.set({ status: 'error', message: (e as Error).message });
      return;
    }
    const next: ShellUpdateState =
      current === LOCAL.sourceHash ? { status: 'up-to-date' } : { status: 'ready', version: 'local build' };
    if (next.status !== this.state.status) this.set(next);
  }

  apply() {
    if (!LOCAL || this.state.status !== 'ready') return;
    // The installer waits for this app to quit, replaces it and opens the new build.
    const child = spawn(
      LOCAL.node,
      [join(DESKTOP, 'scripts/install-local.mjs'), '--wait-pid', String(process.pid), '--open'],
      {
        cwd: DESKTOP,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PATH: LOCAL.path },
      },
    );
    child.unref();
    app.quit();
  }

  private set(s: ShellUpdateState) {
    this.state = s;
    this.onState();
  }
}
