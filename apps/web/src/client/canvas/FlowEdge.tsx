import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo, useRef, useState } from 'react';
import { dispatch } from '../store/board';

/**
 * Soft wire in the source port's pastel colour (ElevenLabs flow edges). Hovering or selecting it
 * shows a round delete button at its midpoint. The button is drawn inside the wire's own SVG group,
 * so moving onto it keeps the wire hovered (a separate HTML layer flickered in Firefox, which does
 * not fire pointerenter for an element that appears under a still cursor).
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
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const type = (data as { type?: string } | undefined)?.type ?? 'file';
  const active = hover || selected;
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
          <circle r={13} />
          <path d="M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5" />
        </g>
      )}
    </g>
  );
});
