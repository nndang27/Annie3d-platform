import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** The bottom toolbar's band: menus that would open under it open above their button instead. */
const BOTTOM_BAND = 76;
const ITEMS =
  '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled), [role="option"]:not(:disabled)';

/**
 * Fixed-position popover and menu, in screen space (not on the zoomed board).
 * - Rendered into <body> (a portal): opened from a node, it must not live inside the board's
 *   transformed viewport, where `position: fixed` follows the transform and the zoom.
 * - Placed under `anchor` (or at x, y), kept inside the viewport, and flipped above the anchor
 *   when it would run under the bottom toolbar.
 * - Closes on Escape, a pointer down outside it, or focus leaving it; the trigger is not
 *   "outside" (its own click toggles the menu).
 * - Keyboard (WAI-ARIA menu pattern): focus starts on the first item; ↑ ↓ Home End move; focus
 *   goes back to the trigger when the menu closes with Escape.
 */
export function Popover({
  x = 0,
  y = 0,
  anchor,
  align = 'start',
  trigger,
  onClose,
  children,
  label,
  testId,
}: {
  x?: number;
  y?: number;
  anchor?: DOMRect;
  align?: 'start' | 'end';
  trigger?: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  label: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor?.left ?? x, top: anchor ? anchor.bottom + 6 : y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const floor = innerHeight - (document.querySelector('.toolbar') ? BOTTOM_BAND : 8);
    let left = anchor ? (align === 'end' ? anchor.right - r.width : anchor.left) : x;
    let top = anchor ? anchor.bottom + 6 : y;
    if (top + r.height > floor) top = anchor ? anchor.top - r.height - 6 : floor - r.height;
    left = Math.max(8, Math.min(left, innerWidth - r.width - 8));
    top = Math.max(8, Math.min(top, innerHeight - r.height - 8));
    setPos({ left, top });
  }, [x, y, anchor, align]);
  // Start on the checked item (a radio menu) or the first one, unless something inside (a search
  // field) already took focus.
  useEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement))
      (
        el.querySelector<HTMLElement>('[aria-checked="true"]') ?? el.querySelector<HTMLElement>(ITEMS)
      )?.focus();
  }, []);
  useEffect(() => {
    const inside = (n: EventTarget | null) =>
      !!n && (ref.current?.contains(n as Node) || trigger?.contains(n as Node));
    const down = (e: PointerEvent) => {
      if (!inside(e.target)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        trigger?.focus();
      }
    };
    // Capture phase so React Flow's pane handlers cannot swallow the event first.
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [onClose, trigger]);
  const move = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    // A search field keeps its own arrow keys (the palette moves its selection itself).
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return createPortal(
    <div
      ref={ref}
      className="popover"
      role="dialog"
      aria-label={label}
      style={pos}
      data-testid={testId}
      onKeyDown={move}
      onBlur={(e) => {
        if (!inPopover(e.relatedTarget, ref.current, trigger)) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Focus moving to the popover, its trigger, or an element around the trigger (WebKit focuses the
 * node around a clicked button, not the button) is not focus leaving: the trigger's click toggles.
 */
const inPopover = (n: EventTarget | null, el: HTMLElement | null, trigger?: HTMLElement | null) =>
  !n ||
  !!el?.contains(n as Node) ||
  !!trigger?.contains(n as Node) ||
  (!!trigger && (n as Node).contains?.(trigger));
