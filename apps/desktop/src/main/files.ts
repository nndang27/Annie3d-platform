/**
 * Files the OS asks us to open (`.annie3d` double-click, drop on the dock icon, "Open with").
 * They can arrive before the app is ready, so they wait here; each then opens in its own window.
 */
const queue: string[] = [];
let opener: ((path: string) => void) | null = null;

export function isBoardFile(p: string) {
  return p.toLowerCase().endsWith('.annie3d');
}

export function openPath(p: string) {
  if (!isBoardFile(p)) return;
  if (opener) opener(p);
  else queue.push(p);
}

/** Starts opening files (queued ones first); returns whether any file was waiting. */
export function setOpener(fn: (path: string) => void): boolean {
  opener = fn;
  const had = queue.length > 0;
  while (queue.length) fn(queue.shift()!);
  return had;
}
