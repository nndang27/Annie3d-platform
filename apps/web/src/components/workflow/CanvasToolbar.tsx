import { NODE_KINDS, type NodeKind } from '@3dads/contracts';
import { Button } from '@3dads/ui';
import { Hand, MessageSquare, MousePointer2 } from 'lucide-react';
import { NODE_ICON, TOOLBAR_KINDS } from './nodeMeta';

export type CanvasMode = 'select' | 'hand' | 'comment';

/** Bottom toolbar: mode group (3) + add-node group (≤ 9), like Flows. */
export function CanvasToolbar({
  mode,
  onMode,
  onAdd,
  readOnly,
}: {
  mode: CanvasMode;
  onMode: (m: CanvasMode) => void;
  onAdd: (k: NodeKind) => void;
  readOnly: boolean;
}) {
  return (
    <div className="flow-toolbar" role="toolbar" aria-label="Canvas tools" data-testid="canvas-toolbar">
      <div className="flow-pill" role="radiogroup" aria-label="Pointer mode">
        <Button
          variant="tertiary"
          icon
          aria-label="Select (V)"
          role="radio"
          aria-checked={mode === 'select'}
          aria-pressed={mode === 'select'}
          onClick={() => onMode('select')}
          data-testid="mode-select"
        >
          <MousePointer2 size={18} aria-hidden="true" />
        </Button>
        <Button
          variant="tertiary"
          icon
          aria-label="Hand / pan (H)"
          role="radio"
          aria-checked={mode === 'hand'}
          aria-pressed={mode === 'hand'}
          onClick={() => onMode('hand')}
          data-testid="mode-hand"
        >
          <Hand size={18} aria-hidden="true" />
        </Button>
        <Button
          variant="tertiary"
          icon
          aria-label="Comment (C)"
          role="radio"
          aria-checked={mode === 'comment'}
          aria-pressed={mode === 'comment'}
          onClick={() => onMode('comment')}
          data-testid="mode-comment"
        >
          <MessageSquare size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="flow-pill" role="group" aria-label="Add node">
        {TOOLBAR_KINDS.map((k) => {
          const Icon = NODE_ICON[k];
          return (
            <Button
              key={k}
              variant="tertiary"
              icon
              aria-label={`Add ${NODE_KINDS[k].title}`}
              title={NODE_KINDS[k].title}
              onClick={() => onAdd(k)}
              disabledReason={readOnly ? 'Editors only.' : undefined}
              data-testid={`tool-${k}`}
            >
              <Icon size={18} aria-hidden="true" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
