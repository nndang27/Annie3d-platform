import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Fixed-position popover kept inside the viewport; closes on Escape or outside pointerdown. */
export function Popover({
  x,
  y,
  onClose,
  children,
  label,
  testId,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  label: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
    });
  }, [x, y]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture phase so React Flow's pane handlers cannot swallow the event first.
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="popover" role="dialog" aria-label={label} style={pos} data-testid={testId}>
      {children}
    </div>
  );
}
