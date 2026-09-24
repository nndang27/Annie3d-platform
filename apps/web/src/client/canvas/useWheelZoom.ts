import { useReactFlow } from '@xyflow/react';
import { type RefObject, useEffect } from 'react';
import { MAX_ZOOM, MIN_ZOOM } from '../lib/zoom';

/**
 * Miro-style wheel handling:
 * - a mouse wheel zooms around the cursor, eased over a few frames;
 * - trackpad two-finger scroll still pans (React Flow panOnScroll);
 * - pinch (ctrlKey wheel) zooms, handled by React Flow.
 * A mouse wheel is recognised the way tldraw/Excalidraw do it: line-based deltas, or large
 * integer vertical steps with no horizontal component. Listener is non-passive and in the
 * capture phase so React Flow's own wheel handler does not also pan.
 */
export function useWheelZoom(host: RefObject<HTMLElement | null>) {
  const rf = useReactFlow();
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let target: { zoom: number; px: number; py: number } | null = null;
    let raf = 0;
    const tick = () => {
      raf = 0;
      if (!target) return;
      const { x, y, zoom } = rf.getViewport();
      const next = zoom + (target.zoom - zoom) * 0.35;
      const done = Math.abs(target.zoom - next) < 0.0005;
      const z = done ? target.zoom : next;
      // Keep the board point under the cursor fixed.
      const k = z / zoom;
      rf.setViewport({ x: target.px - (target.px - x) * k, y: target.py - (target.py - y) * k, zoom: z });
      if (done) target = null;
      else raf = requestAnimationFrame(tick);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // pinch / ⌘-wheel: React Flow zooms
      if ((e.target as Element | null)?.closest('.nowheel')) return;
      const mouse =
        e.deltaMode === 1 || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50);
      if (!mouse) return; // trackpad: let React Flow pan
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const lines = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const from = target?.zoom ?? rf.getZoom();
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * Math.exp(-lines * 0.0015)));
      target = { zoom, px: e.clientX - rect.left, py: e.clientY - rect.top };
      if (!raf) raf = requestAnimationFrame(tick);
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
      cancelAnimationFrame(raf);
    };
  }, [host, rf]);
}
