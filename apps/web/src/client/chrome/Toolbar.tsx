import { NODE_DEFS, type NodeKind } from '@annie3d/contracts';
import { useReactFlow } from '@xyflow/react';
import { Hand, MessageSquare, MousePointer2, Plus, Redo2, Undo2 } from 'lucide-react';
import { createNodeAt } from '../canvas/actions';
import { KIND_ICON } from '../canvas/kindIcons';
import { redo, undo, useBoard } from '../store/board';
import { useUi } from '../store/ui';

const QUICK: NodeKind[] = (Object.keys(NODE_DEFS) as NodeKind[]).filter((k) => NODE_DEFS[k].toolbar);

export function Toolbar() {
  const tool = useUi((s) => s.tool);
  const agentOpen = useUi((s) => s.agentOpen);
  const canUndo = useBoard((s) => s.undoStack.length > 0);
  const canRedo = useBoard((s) => s.redoStack.length > 0);
  const rf = useReactFlow();
  const addAtCenter = (kind: NodeKind) => {
    const p = rf.screenToFlowPosition({ x: innerWidth / 2 - 150, y: innerHeight / 2 - 120 });
    // Nudge so repeated clicks do not stack exactly on top of each other.
    const n = useBoard.getState().graph.nodes.size;
    createNodeAt(kind, p.x + (n % 5) * 24, p.y + (n % 5) * 24);
  };
  const openPaletteAtCenter = () => {
    const f = rf.screenToFlowPosition({ x: innerWidth / 2 - 150, y: innerHeight / 2 - 120 });
    useUi.setState({ palette: { x: innerWidth / 2 - 130, y: innerHeight - 440, flowX: f.x, flowY: f.y } });
  };
  return (
    <nav className="toolbar pill" aria-label="Canvas tools">
      <button
        type="button"
        aria-label="Select (V)"
        aria-pressed={tool === 'select'}
        onClick={() => useUi.setState({ tool: 'select' })}
      >
        <MousePointer2 aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Hand (H)"
        aria-pressed={tool === 'hand'}
        onClick={() => useUi.setState({ tool: 'hand' })}
      >
        <Hand aria-hidden="true" />
      </button>
      <span className="sep" />
      {/* Each kind shows the icon its nodes carry (not a colour to decode). */}
      {QUICK.map((k) => {
        const Icon = KIND_ICON[k];
        return (
          <button
            type="button"
            key={k}
            className="quick-add"
            onClick={() => addAtCenter(k)}
            title={`Add ${NODE_DEFS[k].label}`}
            aria-label={`Add ${NODE_DEFS[k].label}`}
            data-testid={`add-${k}`}
          >
            <Icon aria-hidden="true" />
            <span className="hide-md">{NODE_DEFS[k].label}</span>
          </button>
        );
      })}
      <button
        type="button"
        aria-label="More nodes (N)"
        onClick={openPaletteAtCenter}
        data-testid="more-nodes"
      >
        <Plus aria-hidden="true" />
      </button>
      <span className="sep" />
      <button type="button" aria-label="Undo (⌘Z)" disabled={!canUndo} onClick={undo} data-testid="undo">
        <Undo2 aria-hidden="true" />
      </button>
      <button type="button" aria-label="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo} data-testid="redo">
        <Redo2 aria-hidden="true" />
      </button>
      <span className="sep" />
      <button
        type="button"
        aria-label="Ask Annie"
        aria-pressed={agentOpen}
        onClick={() => useUi.setState({ agentOpen: !agentOpen })}
        data-testid="toggle-agent"
      >
        <MessageSquare aria-hidden="true" />
        <span className="hide-md">Ask Annie</span>
      </button>
    </nav>
  );
}
