// Share the local app over a public URL without deploying: builds (development config, dev
// Neon branch), serves it with `vite preview` on :4173 and exposes it through a Cloudflare quick
// tunnel (https://try.cloudflare.com, no account). The tunnel keeps running between shares, so
// re-running `pnpm share` after a change rebuilds and keeps the same link.
//   pnpm share            build + (re)start preview + reuse or start the tunnel
//   pnpm share --no-build restart preview on the existing build
//   pnpm share:stop       stop preview and tunnel
// The preview build, not the dev server, is shared: the dev server would also serve source and
// local files (such as .dev.vars) to anyone with the link.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';

process.chdir(new URL('..', import.meta.url).pathname);
const DIR = '.share';
mkdirSync(DIR, { recursive: true });
const PORT = 4173;
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const readPid = (name) => {
  try {
    return Number(readFileSync(`${DIR}/${name}.pid`, 'utf8'));
  } catch {
    return 0;
  }
};
const stop = (name) => {
  const pid = readPid(name);
  if (pid && alive(pid)) {
    try {
      process.kill(-pid, 'SIGTERM'); // the whole detached group (pnpm → vite → workerd)
    } catch {
      process.kill(pid, 'SIGTERM');
    }
  }
};
const freePort = () => {
  try {
    const pids = execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`).toString().trim();
    if (pids) execSync(`kill ${pids.split('\n').join(' ')}`);
  } catch {
    /* nothing listening */
  }
};
const detached = (name, cmd, args) => {
  const log = openSync(`${DIR}/${name}.log`, 'w');
  const child = spawn(cmd, args, { detached: true, stdio: ['ignore', log, log] });
  child.unref();
  writeFileSync(`${DIR}/${name}.pid`, String(child.pid));
  return child.pid;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv.includes('--stop')) {
  stop('preview');
  stop('tunnel');
  freePort();
  console.log('share stopped');
  process.exit(0);
}

if (!process.argv.includes('--no-build')) {
  console.log('building…');
  execSync('pnpm build', { stdio: 'inherit' });
}

stop('preview');
freePort();
detached('preview', 'node', ['scripts/dev.mjs', '--preview']);
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`http://localhost:${PORT}/api/health`);
    if (r.ok) break;
  } catch {
    /* starting */
  }
  await sleep(1000);
}

let url = existsSync(`${DIR}/url`) ? readFileSync(`${DIR}/url`, 'utf8').trim() : '';
if (!url || !alive(readPid('tunnel'))) {
  detached('tunnel', 'cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`]);
  url = '';
  for (let i = 0; i < 60 && !url; i++) {
    await sleep(1000);
    url =
      readFileSync(`${DIR}/tunnel.log`, 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] ?? '';
  }
  if (!url) throw new Error(`no tunnel URL; see ${DIR}/tunnel.log`);
  writeFileSync(`${DIR}/url`, url);
}
// The quick tunnel's DNS name can take a few seconds to resolve after it is created.
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${url}/api/health`);
    if (r.ok) break;
  } catch {
    /* propagating */
  }
  await sleep(2000);
}
console.log(`\nShared at ${url}\n(logs in ${DIR}/; stop with: pnpm share:stop)`);
