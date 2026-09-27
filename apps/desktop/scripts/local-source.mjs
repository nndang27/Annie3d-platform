// One fingerprint of the desktop shell's own sources, shared by the local installer (which bakes it
// into the app) and the running local app (which compares it with the source tree to offer an update).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PARTS = ['src', 'build', 'build.mjs', 'package.json', 'electron-builder.yml', 'scripts'];

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((name) => files(join(path, name)));
}

/** @param {string} desktopDir absolute path of apps/desktop */
export function shellSourceHash(desktopDir) {
  const hash = createHash('sha256');
  for (const part of PARTS) {
    for (const file of files(join(desktopDir, part))) {
      hash.update(relative(desktopDir, file));
      hash.update(readFileSync(file));
    }
  }
  return hash.digest('hex').slice(0, 16);
}
