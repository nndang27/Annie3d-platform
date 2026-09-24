/**
 * Zoom limits and button steps (Miro/Figma style): the wheel and pinch zoom freely between the
 * limits; +/− jump to the next preset level. Below 25% nodes stop being readable, so the canvas
 * never goes there (user feedback 2026-09-24: no tiny "summary" view).
 */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
// Miro's +/− steps (measured 2026-09-24: 20, 33, 50, 75, 100, 150, 200%), starting at our 25% floor.
export const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2] as const;

/** Next preset strictly above/below `from` (small epsilon so 0.999 counts as 1). */
export function stepZoom(from: number, dir: 1 | -1): number {
  const e = 0.01;
  if (dir > 0) return ZOOM_LEVELS.find((z) => z > from + e) ?? MAX_ZOOM;
  return [...ZOOM_LEVELS].reverse().find((z) => z < from - e) ?? MIN_ZOOM;
}

/** Minimal slice of the React Flow instance used here. */
interface Zoomable {
  getZoom(): number;
  zoomTo(z: number, o?: { duration?: number }): Promise<boolean>;
}

// Pending target: rapid clicks/keys step from where the animation is going, not from the
// mid-animation zoom (five fast clicks used to move 54% → 43%, E2E 2026-09-24).
let target: number | null = null;

/** Animated step to the next preset level around the viewport centre (+/− buttons and keys). */
export function zoomStep(rf: Zoomable, dir: 1 | -1) {
  const next = stepZoom(target ?? rf.getZoom(), dir);
  target = next;
  void rf.zoomTo(next, { duration: 300 }).then(() => {
    if (target === next) target = null;
  });
}

export function zoomToLevel(rf: Zoomable, z: number) {
  target = null;
  void rf.zoomTo(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), { duration: 300 });
}
