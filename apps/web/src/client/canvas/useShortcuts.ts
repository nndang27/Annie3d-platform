import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { redo, undo } from '../store/board';
import { useUi } from '../store/ui';
import { duplicateNodes } from './actions';

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
  );
}

/** Keyboard shortcuts (tldraw/Figma conventions). Delete/Backspace is handled by React Flow. */
export function useShortcuts() {
  const rf = useReactFlow();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        duplicateNodes([...useUi.getState().selected]);
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        useUi.setState({ selected: new Set(rf.getNodes().map((n) => n.id)) });
        return;
      }
      if ((mod && k === 'k') || (!mod && k === 'n')) {
        e.preventDefault();
        const f = rf.screenToFlowPosition({ x: innerWidth / 2 - 150, y: innerHeight / 2 - 120 });
        useUi.setState({ palette: { x: innerWidth / 2 - 130, y: innerHeight / 3, flowX: f.x, flowY: f.y } });
        return;
      }
      if (mod) return;
      if (k === 'v') useUi.setState({ tool: 'select' });
      else if (k === 'h') useUi.setState({ tool: 'hand' });
      else if (k === '1' && e.shiftKey) void rf.fitView({ duration: 250, padding: 0.1 });
      else if (k === 'escape') useUi.setState({ selected: new Set(), palette: null, contextMenu: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rf]);
}
