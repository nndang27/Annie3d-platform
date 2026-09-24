/**
 * Where the app points. Production by default; `ANNIE3D_ORIGIN` points a build at another site
 * (a `pnpm share` link, a local preview), and `ANNIE3D_DEV_URL` loads a live dev server with hot
 * reload instead of the stored web pack (development only).
 */
export const ORIGIN = new URL(process.env.ANNIE3D_ORIGIN ?? 'https://annie3d.nndang2701.workers.dev').origin;
export const DEV_URL = process.env.ANNIE3D_DEV_URL || null;
/** Unsigned web packs are accepted only when explicitly allowed (local development). */
export const ALLOW_UNSIGNED = process.env.ANNIE3D_ALLOW_UNSIGNED === '1';
/** Paths the Worker answers itself (never served from the local pack). Mirrors wrangler `run_worker_first`. */
export const WORKER_FIRST = /^\/(api|s|billing|desktop)(\/|$)/;
/** Pages allowed inside the app window besides our origin (Google sign-in). */
export const INLINE_HOSTS = new Set(['accounts.google.com']);
