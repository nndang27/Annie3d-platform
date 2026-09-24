import { NODE_KINDS, type NodeCategory, type NodeKind } from '@annie3d/contracts';
import { Kbd } from '@annie3d/ui';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, mostUsedKinds, NODE_ICON, PALETTE_KINDS } from './nodeMeta';

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  run: () => void;
}

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  /** 'nodes' = add-node palette (image 3); 'actions' = quick actions (⌘K). */
  mode: 'nodes' | 'actions';
  onPick: (kind: NodeKind) => void;
  actions?: PaletteAction[];
}

/** Searchable add-node palette anchored at the click position. */
export function NodePalette({ x, y, onClose, mode, onPick, actions = [] }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<NodeCategory | 'all'>('all');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (mode === 'actions') {
      const list = actions.filter(
        (a) => !needle || `${a.label} ${a.hint ?? ''}`.toLowerCase().includes(needle),
      );
      return [
        {
          group: 'Actions',
          entries: list.map((a) => ({ id: a.id, label: a.label, sub: a.hint, icon: a.icon, run: a.run })),
        },
      ];
    }
    const match = (k: NodeKind) => {
      const s = NODE_KINDS[k];
      if (cat !== 'all' && s.category !== cat) return false;
      return (
        !needle || `${s.title} ${s.description} ${s.engine} ${s.category}`.toLowerCase().includes(needle)
      );
    };
    const entry = (k: NodeKind) => {
      const s = NODE_KINDS[k];
      const Icon = NODE_ICON[k];
      return {
        id: k as string,
        label: s.title,
        sub: s.engine,
        icon: <Icon size={16} aria-hidden="true" />,
        run: () => onPick(k),
      };
    };
    const groups: { group: string; entries: ReturnType<typeof entry>[] }[] = [];
    if (!needle && cat === 'all')
      groups.push({
        group: 'Most used',
        entries: mostUsedKinds().map((k) => ({ ...entry(k), id: `most-used-${k}` })),
      });
    for (const c of CATEGORIES) {
      const ks = PALETTE_KINDS.filter((k) => NODE_KINDS[k].category === c && match(k));
      if (ks.length) groups.push({ group: c, entries: ks.map(entry) });
    }
    return groups;
  }, [q, cat, mode, actions, onPick]);
  const flat = items.flatMap((g) => g.entries);
  useEffect(() => setActive(0), [q, cat]);

  const left = Math.min(x, window.innerWidth - 360);
  const top = Math.min(y, window.innerHeight - 480);
  return (
    <div
      ref={box}
      className="palette"
      style={{ left, top }}
      role="dialog"
      aria-label={mode === 'nodes' ? 'Add node' : 'Quick actions'}
      data-testid={mode === 'nodes' ? 'node-palette' : 'quick-actions'}
    >
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={mode === 'nodes' ? 'Search nodes, engines…' : 'Search actions…'}
        aria-label={mode === 'nodes' ? 'Search nodes' : 'Search actions'}
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-activedescendant={flat[active] ? `pal-${flat[active].id}` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(flat.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            flat[active]?.run();
            onClose();
          } else if (e.key === 'Escape') onClose();
        }}
      />
      {mode === 'nodes' ? (
        <div className="palette-chips" role="group" aria-label="Category">
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      ) : null}
      <div className="palette-list" id="palette-list" role="listbox" aria-label="Results">
        {flat.length === 0 ? <div className="palette-group">Nothing matches “{q}”.</div> : null}
        {items.map((g) => (
          <div key={g.group}>
            <div className="palette-group">{g.group}</div>
            {g.entries.map((it) => {
              const idx = flat.indexOf(it);
              return (
                <button
                  key={`${g.group}-${it.id}`}
                  type="button"
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={idx === active}
                  className="palette-item"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                  data-testid={`palette-${it.id}`}
                >
                  <span className="ico">{it.icon}</span>
                  <span>{it.label}</span>
                  {it.sub ? <span className="sub">{it.sub}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {mode === 'nodes' ? (
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <Kbd>↑↓</Kbd> navigate · <Kbd>↩</Kbd> add · <Kbd>Esc</Kbd> close
        </div>
      ) : null}
    </div>
  );
}
