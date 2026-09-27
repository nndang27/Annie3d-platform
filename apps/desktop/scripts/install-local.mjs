// Builds Annie 3D from this machine's source as a local app and installs it (default
// /Applications/Annie 3D.app): Dock icon, .annie3d files and annie3d:// links open it. The app runs
// the web app and the studio from their dev servers (always the latest code) and offers an update
// when the shell's own sources change (src/main/local.ts).
//
// Usage: node apps/desktop/scripts/install-local.mjs [--target <app path>] [--open] [--wait-pid <pid>]
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellSourceHash } from './local-source.mjs';

const DESKTOP = fileURLToPath(new URL('..', import.meta.url));
const ROOT = resolve(DESKTOP, '../../../..');
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const TARGET = option('--target') ?? '/Applications/Annie 3D.app';
const LOGS = join(homedir(), 'Library/Logs/Annie 3D');
mkdirSync(LOGS, { recursive: true });
const LOG = join(LOGS, 'install-local.log');

const log = (line) => {
  appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`);
  console.log(line);
};
const run = (cmd, argv, cwd = DESKTOP) => {
  log(`$ ${cmd} ${argv.join(' ')}`);
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', env: process.env });
  appendFileSync(LOG, (r.stdout ?? '') + (r.stderr ?? ''));
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}); see ${LOG}`);
};
const which = (bin) => spawnSync('which', [bin], { encoding: 'utf8' }).stdout.trim();
const notify = (text) =>
  spawnSync('osascript', ['-e', `display notification ${JSON.stringify(text)} with title "Annie 3D"`]);

async function waitForExit(pid) {
  for (let i = 0; i < 200; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

try {
  const pid = Number(option('--wait-pid'));
  if (pid) await waitForExit(pid);
  if (pid) notify('Updating Annie 3D from the latest source…');

  // Fingerprint first, so it describes exactly the sources that are built next.
  const sourceHash = shellSourceHash(DESKTOP);
  run(process.execPath, ['build.mjs']);
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  run(join(DESKTOP, 'node_modules/.bin/electron-builder'), [
    '--mac',
    `--${arch}`,
    '--dir',
    '--publish',
    'never',
    // A higher build number than any installed release, so macOS prefers this app for .annie3d.
    `-c.buildVersion=${Math.floor(Date.now() / 1000)}`,
  ]);
  const built = join(DESKTOP, 'release', arch === 'arm64' ? 'mac-arm64' : 'mac', 'Annie 3D.app');
  if (!existsSync(built)) throw new Error(`Build output not found: ${built}`);

  writeFileSync(
    join(built, 'Contents/Resources/local.json'),
    `${JSON.stringify(
      {
        root: ROOT,
        webUrl: 'http://localhost:5173',
        studioUrl: 'http://localhost:3002',
        path: process.env.PATH,
        node: process.execPath,
        bun: which('bun') || join(homedir(), '.bun/bin/bun'),
        sourceHash,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  // The added file changes the bundle: seal it again (ad-hoc; no developer identity yet).
  run('codesign', ['--force', '--deep', '--sign', '-', built]);

  // Copy next to the target first, so a failed copy never leaves the person without an app.
  const fresh = TARGET.replace(/\.app$/, '.new.app');
  rmSync(fresh, { recursive: true, force: true });
  run('ditto', [built, fresh]);
  rmSync(TARGET, { recursive: true, force: true });
  renameSync(fresh, TARGET);
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
  // Only the installed copy may answer for .annie3d; the build folder's copy has the same app id.
  run(lsregister, ['-u', built]);
  run(lsregister, ['-f', TARGET]);
  log(`installed ${TARGET} (shell ${sourceHash})`);
  if (args.includes('--open')) execFileSync('open', [TARGET]);
} catch (e) {
  log(`FAILED: ${e.message}`);
  notify(`Annie 3D update failed: ${e.message}`);
  // The previous app is untouched until the new one is built; open it again if asked.
  if (args.includes('--open') && existsSync(TARGET)) execFileSync('open', [TARGET]);
  process.exit(1);
}
