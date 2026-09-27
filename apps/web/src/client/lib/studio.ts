/**
 * Where the 3D studio lives. It is a separate app (Production_system/Pascal_editor, MIT) on its own
 * origin: `VITE_STUDIO_URL` at build time, the local studio dev server (:3002) in development,
 * and no Studio button in a build that names no studio.
 */
export const STUDIO_URL: string | null =
  import.meta.env.VITE_STUDIO_URL || (import.meta.env.DEV ? 'http://localhost:3002' : null);

/** The studio page, told which board to return to (its back button only accepts our origin). */
export function studioHref(boardId: string | null): string | null {
  if (!STUDIO_URL) return null;
  const from = `${location.origin}${boardId ? `/b/${boardId}` : '/'}`;
  return `${STUDIO_URL.replace(/\/$/, '')}/?from=${encodeURIComponent(from)}`;
}
