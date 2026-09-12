import { Kbd } from '@3dads/ui';
import { useEffect, useRef } from 'react';
import { MOD } from './nodeMeta';

export interface CtxItem {
  label: string;
  kbd?: string;
  onSelect: () => void;
  disabledReason?: string;
  sep?: boolean;
}

/** Right-click menu on the canvas background (image 2). */
export function CanvasContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: CtxItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('.menu-item')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 260);
  return (
    <div
      ref={ref}
      className="menu ctx-menu"
      role="menu"
      aria-label="Canvas actions"
      style={{ left, top }}
      data-testid="canvas-context-menu"
    >
      {items.map((it) => (
        <div key={it.label}>
          {it.sep ? <div className="menu-sep" role="separator" /> : null}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            aria-disabled={it.disabledReason ? true : undefined}
            title={it.disabledReason}
            style={{ color: it.disabledReason ? 'var(--text-muted)' : undefined }}
            onClick={() => {
              if (it.disabledReason) return;
              onClose();
              it.onSelect();
            }}
          >
            <span>{it.label}</span>
            {it.kbd ? <Kbd>{it.kbd.replace('MOD', MOD)}</Kbd> : null}
          </button>
        </div>
      ))}
    </div>
  );
}
