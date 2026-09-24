import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * Files the OS asks us to open (`.annie3d` double-click, drop on the dock icon, "Open with").
 * They can arrive before the page exists, so they wait here until the page subscribes.
 */
const MAX = 80 * 1024 * 1024;
const queue: string[] = [];
let deliver: ((file: { name: string; bytes: Uint8Array }) => void) | null = null;

export function isBoardFile(p: string) {
  return p.toLowerCase().endsWith('.annie3d');
}

export function openPath(p: string) {
  if (!isBoardFile(p)) return;
  if (deliver) void send(p);
  else queue.push(p);
}

export function setDeliver(fn: typeof deliver) {
  deliver = fn;
  while (fn && queue.length) void send(queue.shift()!);
}

async function send(p: string) {
  try {
    if ((await stat(p)).size > MAX) return;
    deliver?.({ name: basename(p), bytes: new Uint8Array(await readFile(p)) });
  } catch {
    /* unreadable file: ignore */
  }
}
