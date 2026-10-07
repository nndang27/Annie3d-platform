/**
 * Where the product lives. annie3d.app since 2026-10-07; the workers.dev address it had before
 * still answers: installed desktop apps keep it (their local data lives on that origin) and old
 * links keep working. A browser page opened there moves to the new address (`movedTo`).
 */
export const CANONICAL_ORIGIN = 'https://annie3d.app';
export const LEGACY_ORIGINS = ['https://annie3d.nndang2701.workers.dev'] as const;

/** The same page on the canonical address, or null when this page stays where it is. */
export function movedTo(
  loc: { origin: string; pathname: string; search: string; hash: string },
  inDesktopApp: boolean,
) {
  if (inDesktopApp || !(LEGACY_ORIGINS as readonly string[]).includes(loc.origin)) return null;
  return `${CANONICAL_ORIGIN}${loc.pathname}${loc.search}${loc.hash}`;
}
