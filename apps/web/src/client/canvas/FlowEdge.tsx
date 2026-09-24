import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import { dispatch } from '../store/board';

/**
 * Current along a wire: a bright head with a long tail that thins and fades toward its end
 * (like a light streak), running from the source end to the midpoint, where the delete button
 * already waits. Gentle timing: 720 ms ease-in-out run, then the tail drains in 360 ms.
 */
const RUN_MS = 720;
const DRAIN_MS = 360;
const TAIL = 220; // px of tail behind the head
const SEGMENTS = 18; // the tail is drawn as short segments, each thinner and fainter than the last
/** Streak layers from bottom to top: wide faint glow, blue core, white-hot centre line. */
const LAYER = ['glow', 'core', 'hot'] as const;
const WIDTH = [
  (f: number) => 3 + 9 * f ** 1.3,
  (f: number) => 0.8 + 3.4 * f ** 1.5,
  (f: number) => 1.4 * f ** 2,
];
const ALPHA = [(f: number) => 0.3 * f ** 1.8, (f: number) => f ** 1.2, (f: number) => (f > 0.45 ? f : 0)];
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Soft wire in the source port's pastel colour (ElevenLabs flow edges). Everything is drawn inside
 * the wire's own SVG group, so moving onto the button keeps the wire hovered (an HTML layer
 * flickered in Firefox, which does not fire pointerenter for an element that appears under a
 * still cursor).
 */
export const FlowEdge = memo(function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.35,
  });
  const [hover, setHover] = useState(false);
  /** Head position along the path (px) and tail length (px); null when idle. */
  const [pulse, setPulse] = useState<{ head: number; tail: number } | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const track = useRef<SVGPathElement>(null);
  const type = (data as { type?: string } | undefined)?.type ?? 'file';
  const active = hover || selected;

  useEffect(() => {
    const el = track.current;
    if (!hover || !el) {
      setPulse(null);
      return;
    }
    const half = el.getTotalLength() / 2;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPulse({ head: half, tail: 0 });
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = now - t0;
      if (t < RUN_MS) {
        const head = easeInOut(t / RUN_MS) * half;
        setPulse({ head, tail: Math.min(TAIL, head) });
      } else {
        const d = Math.min(1, (t - RUN_MS) / DRAIN_MS);
        setPulse({ head: half, tail: Math.min(TAIL, half) * (1 - d) ** 2 });
        if (d >= 1) return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hover]);

  // The delete button sits at the midpoint from the first moment; only the light travels.
  const el = track.current;
  const headPt = hover && pulse && el ? el.getPointAtLength(pulse.head) : null;
  const len = el?.getTotalLength() ?? 0;
  const remove = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    dispatch([{ type: 'edge.delete', ids: [id] }]);
  };
  return (
    <g
      className={`wire wire-${type}${active ? ' active' : ''}`}
      onPointerEnter={() => {
        if (leave.current) clearTimeout(leave.current);
        setHover(true);
      }}
      onPointerLeave={() => {
        leave.current = setTimeout(() => setHover(false), 120);
      }}
    >
      <BaseEdge id={id} path={path} interactionWidth={24} />
      <path ref={track} d={path} className="wire-track" />
      {hover && pulse && pulse.tail > 0.5 && (
        <g className="wire-current">
          {/* Glow under the streak, then the streak itself: segment i sits i steps behind the head. */}
          {[0, 1, 2].map((layer) =>
            Array.from({ length: SEGMENTS }, (_, i) => {
              const seg = pulse.tail / SEGMENTS;
              const end = pulse.head - i * seg;
              const f = 1 - i / SEGMENTS; // 1 at the head → 0 at the tail end
              return (
                <path
                  key={`${layer}-${i}`}
                  d={path}
                  className={LAYER[layer]}
                  style={{
                    strokeDasharray: `${seg + 0.6} ${len + seg}`,
                    strokeDashoffset: -(end - seg),
                    strokeWidth: WIDTH[layer]!(f),
                    opacity: ALPHA[layer]!(f),
                  }}
                />
              );
            }),
          )}
          {/* Flat halos instead of a CSS drop-shadow, which re-filters every frame (app.css .wire-current). */}
          {headPt && (
            <>
              <circle className="halo" cx={headPt.x} cy={headPt.y} r={11} opacity={0.14} />
              <circle className="halo" cx={headPt.x} cy={headPt.y} r={7} opacity={0.3} />
              <circle className="head" cx={headPt.x} cy={headPt.y} r={4} />
            </>
          )}
        </g>
      )}
      {active && (
        <g
          className="wire-delete"
          transform={`translate(${labelX} ${labelY})`}
          role="button"
          tabIndex={0}
          aria-label="Remove connection"
          data-testid="edge-delete"
          onClick={remove}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') remove(e);
          }}
        >
          <title>Remove connection</title>
          <circle r={12} />
          <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" />
        </g>
      )}
    </g>
  );
});
