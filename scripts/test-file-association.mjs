// Installs the packaged app the way a user would and double-clicks (asks the OS to open) a
// .annie3d file, then checks that the app started with that file. Runs on the Desktop workflow's
// Windows, Linux and macOS machines after `electron-builder` (apps/desktop/release).
//   Windows: the NSIS installer, silently (per user); the file is opened with `start`.
//   Linux:   the .deb (installs the MIME type and the .desktop entry); `xdg-open` under Xvfb.
//   macOS:   the .app from the zip, registered with Launch Services; `open`.
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const release = new URL('../apps/desktop/release/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const dir = mkdtempSync(join(tmpdir(), 'annie3d-assoc-'));
const file = join(dir, 'Association test.annie3d');
const report = join(dir, 'report.jsonl');
const manifest = {
  format: 'annie3d',
  version: 2,
  exportedAt: new Date().toISOString(),
  title: 'Association test',
  nodes: [
    {
      id: crypto.randomUUID(),
      kind: 'text',
      x: 0,
      y: 0,
      label: null,
      settings: { text: 'Opened by the OS' },
    },
  ],
  edges: [],
  outputs: [],
};
writeFileSync(file, zipSync({ 'annie3d.json': strToU8(JSON.stringify(manifest)) }));
const env = { ...process.env, ANNIE3D_REPORT_FILE: report, ANNIE3D_USER_DATA: join(dir, 'data') };
const sh = (cmd) => {
  console.log(`$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', env });
  console.log((r.stdout + r.stderr).trim());
  return r.stdout.trim();
};
const find = (re) => readdirSync(release).find((f) => re.test(f));

if (process.platform === 'win32') {
  const exe = find(/\.exe$/);
  sh(`"${join(release, exe)}" /S`);
  // A one-click installer may start the app: stop it, so the file reaches a fresh start.
  sh('taskkill /IM "Annie 3D.exe" /F');
  sh('reg query HKCU\\Software\\Classes\\.annie3d /ve');
  sh('cmd /c assoc .annie3d');
  sh(`cmd /c start "" "${file}"`);
} else if (process.platform === 'linux') {
  sh(`sudo apt-get install -y "${join(release, find(/\.deb$/))}"`);
  const type = sh(`xdg-mime query filetype "${file}"`);
  const app = sh(`xdg-mime query default ${type}`);
  if (type !== 'application/vnd.annie3d+zip') throw new Error(`the OS sees the file as ${type}`);
  if (!/annie3d/.test(app)) throw new Error(`no app for ${type}: ${app}`);
  execSync(`nohup xdg-open "${file}" >/dev/null 2>&1 &`, { env, shell: '/bin/bash' });
} else {
  sh(`ditto -x -k "${join(release, find(/-mac-universal\.zip$|-mac-.*\.zip$/))}" /Applications`);
  sh(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/Annie 3D.app"',
  );
  sh(`mdls -name kMDItemContentType "${file}"`);
  const vars = ['ANNIE3D_REPORT_FILE', 'ANNIE3D_USER_DATA'].map((k) => `--env ${k}="${env[k]}"`).join(' ');
  sh(`open ${vars} "${file}"`);
}

// The app reports each file the OS hands it (docs.ts, ANNIE3D_REPORT_FILE).
const until = Date.now() + 90_000;
while (Date.now() < until) {
  const lines = existsSync(report) ? readFileSync(report, 'utf8').trim().split('\n').filter(Boolean) : [];
  const opened = lines.map((l) => JSON.parse(l).opened);
  if (opened.some((p) => p.toLowerCase() === file.toLowerCase())) {
    console.log(`OK: the OS opened ${file} in Annie 3D`);
    process.exit(0);
  }
  execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)']);
}
console.error('FAILED: Annie 3D did not report the file within 90 s');
process.exit(1);
