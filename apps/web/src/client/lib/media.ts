import type { AssetDto } from '@annie3d/contracts';

/**
 * Pick the smallest image that is still sharp at the node's on-screen size
 * (Miro LoD image caches; tldraw asset resolution by stepped screen scale × DPR).
 */
export function pickImage(a: AssetDto | undefined, cssWidth: number, zoom: number): string | null {
  if (!a) return null;
  const need = cssWidth * zoom * (globalThis.devicePixelRatio || 1);
  if (need <= 256 && a.urls.thumb) return a.urls.thumb;
  return a.urls.poster ?? a.urls.thumb ?? (a.kind === 'image' ? a.urls.original : null);
}
