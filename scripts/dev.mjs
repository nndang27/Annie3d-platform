// Starts the Vite dev server (SPA + Worker) with local secrets from .dev.vars.
// Hyperdrive in local dev connects directly to the Neon `dev` branch through
// CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING> (Hyperdrive local-development docs).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const raw = process.env.DEV_DATABASE_URL ?? vars.DATABASE_URL_DEV;
// Workers' TCP sockets have no TLS channel binding (SCRAM-PLUS); Hyperdrive terminates TLS to
// Neon in production, so local dev drops the channel_binding parameter.
const u = new URL(raw);
u.searchParams.delete('channel_binding');
const db = u.toString();
const env = { ...process.env, CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: db };
const args = [
  '--filter',
  '@annie3d/web',
  'exec',
  'vite',
  '--port',
  process.env.PORT ?? '5173',
  '--strictPort',
];
const child = spawn('pnpm', args, { env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
