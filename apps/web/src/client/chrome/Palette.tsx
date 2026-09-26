import {
  NODE_DEFS,
  type NodeKind,
  PORT_TYPES,
  type PortType,
  STARTERS,
  type StarterId,
} from '@annie3d/contracts';
import type { MessageKey } from '@annie3d/i18n';
import { LayoutTemplate } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { createNodeAt, insertStarter } from '../canvas/actions';
import { KIND_ICON } from '../canvas/kindIcons';
import { useT } from '../i18n';
import { useUi } from '../store/ui';
import { Popover } from './Popover';

const GROUPS: { id: string; label: MessageKey }[] = [
  { id: 'input', label: 'category.input' },
  { id: 'build', label: 'category.build' },
  { id: 'stage', label: 'category.stage' },
  { id: 'output', label: 'category.output' },
  { id: 'note', label: 'category.note' },
  { id: 'starters', label: 'palette.starters' },
];
const isPortType = (v: string | undefined): v is PortType =>
  (PORT_TYPES as readonly string[]).includes(v ?? '');

type Item =
  | { type: 'node'; kind: NodeKind; label: string; group: string }
  | { type: 'starter'; id: StarterId; label: string; group: string };

/**
 * Add-node palette (⌘K, N, right-click, or a wire dropped on empty canvas).
 * When opened from a wire, only nodes with a port accepting that type are listed.
 */
export function Palette() {
  const palette = useUi((s) => s.palette);
  const close = useCallback(() => useUi.setState({ palette: null }), []);
  if (!palette) return null;
  return <PaletteBody key={`${palette.x},${palette.y}`} p={palette} onClose={close} />;
}

function PaletteBody({
  p,
  onClose,
}: {
  p: NonNullable<ReturnType<typeof useUi.getState>['palette']>;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const items = useMemo(() => {
    const list: Item[] = Object.values(NODE_DEFS)
      .filter(
        (d) => !p.accepts || d.inputs.some((i) => (i.accepts as readonly string[]).includes(p.accepts!)),
      )
      .map((d) => ({ type: 'node', kind: d.kind, label: t(`node.${d.kind}`), group: d.category }));
    if (!p.accepts)
      for (const id of STARTERS)
        list.push({
          type: 'starter',
          id,
          label: t('palette.starter', { title: t(`starter.${id}.title`) }),
          group: 'starters',
        });
    const needle = q.trim().toLocaleLowerCase(t.tag);
    return needle ? list.filter((i) => i.label.toLocaleLowerCase(t.tag).includes(needle)) : list;
  }, [p.accepts, q, t]);
  const pick = (i: Item | undefined) => {
    if (!i) return;
    if (i.type === 'node') createNodeAt(i.kind, p.flowX, p.flowY, p.fromNodeId);
    else insertStarter(i.id, { x: p.flowX, y: p.flowY });
    onClose();
  };
  let idx = -1;
  return (
    <Popover x={p.x} y={p.y} onClose={onClose} label={t('palette.label')} testId="palette">
      <input
        type="search"
        // biome-ignore lint/a11y/noAutofocus: the palette is opened on purpose and typing filters it immediately.
        autoFocus
        placeholder={isPortType(p.accepts) ? t(`palette.accepts.${p.accepts}`) : t('palette.search')}
        value={q}
        aria-label={t('palette.searchLabel')}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          if (e.key === 'Enter') pick(items[active]);
        }}
      />
      <div role="listbox" aria-label={t('palette.list')} style={{ maxHeight: 360, overflow: 'auto' }}>
        {GROUPS.map((g) => {
          const inGroup = items.filter((i) => i.group === g.id);
          if (!inGroup.length) return null;
          return (
            <div key={g.id}>
              <div className="group">{t(g.label)}</div>
              {inGroup.map((i) => {
                idx = items.indexOf(i);
                const my = idx;
                const Icon = i.type === 'node' ? KIND_ICON[i.kind] : LayoutTemplate;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={my === active}
                    key={i.type === 'node' ? i.kind : i.id}
                    onMouseEnter={() => setActive(my)}
                    onClick={() => pick(i)}
                    data-testid={`palette-${i.type === 'node' ? i.kind : i.id}`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {i.label}
                    {i.type === 'node' && <span className="meta">{t(`engine.${i.kind}`)}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
        {!items.length && <div className="group">{t('palette.noMatch', { query: q })}</div>}
      </div>
    </Popover>
  );
}
