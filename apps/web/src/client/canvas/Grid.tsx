import { useStore } from '@xyflow/react';
import { memo } from 'react';

/**
 * Miro's board grid, measured on miro.com (2026-09-24, canvas pixel probe at 20–200%):
 * - two line weights, 4 minor cells per major cell;
 * - minor cell = 80 board units below 100% zoom and 20 units from 100% up (it steps ×4 at
 *   each power of 4), so a minor cell is 20–80 px on screen;
 * - minor lines fade in with their on-screen size (≈ 0.2 at 20 px, 0.5 at 40 px, full at 60 px),
 *   majors are always full. When the level steps, every visible line keeps its place and
 *   weight, so zooming never jumps;
 * - colours: background #f2f2f2, lines #e2e2e2.
 */
const MINOR_AT_1X = 20; // board units per minor cell at zoom ≥ 1

export const Grid = memo(function Grid() {
  const [x, y, zoom] = useStore((s) => s.transform);
  const level = Math.floor(Math.log(zoom) / Math.log(4) + 1e-9); // …, -1 (0.25–1), 0 (1–4)
  const minor = MINOR_AT_1X * 4 ** -level * zoom; // on-screen px, 20..80
  const major = minor * 4;
  const alpha = Math.min(1, Math.max(0, (minor - 12) / 48));
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const path = (s: number) => `M ${s} 0 L 0 0 0 ${s}`;
  return (
    <svg
      className="react-flow__background canvas-grid"
      aria-hidden="true"
      data-testid="canvas-grid"
      data-cell={Math.round(minor)}
      data-alpha={alpha.toFixed(2)}
    >
      <defs>
        <pattern
          id="grid-minor"
          width={minor}
          height={minor}
          patternUnits="userSpaceOnUse"
          x={mod(x, minor)}
          y={mod(y, minor)}
        >
          <path d={path(minor)} fill="none" stroke="var(--grid-line)" strokeWidth={1} />
        </pattern>
        <pattern
          id="grid-major"
          width={major}
          height={major}
          patternUnits="userSpaceOnUse"
          x={mod(x, major)}
          y={mod(y, major)}
        >
          <path d={path(major)} fill="none" stroke="var(--grid-line)" strokeWidth={1} />
        </pattern>
      </defs>
      {alpha > 0.01 && <rect width="100%" height="100%" fill="url(#grid-minor)" opacity={alpha} />}
      <rect width="100%" height="100%" fill="url(#grid-major)" />
    </svg>
  );
});
