import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { exportBoardFile, openBoardFilePicker } from '../lib/boardFile';
import { zoomStep, zoomToLevel } from '../lib/zoom';
import { redo, undo } from '../store/board';
import { useUi } from '../store/ui';
import { deleteNodes } from './actions';
import { copySelection, duplicateNodes, handlePaste, pasteNodes } from './clipboard';

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
  );
}

function hasTextSelection() {
  const s = window.getSelection();
  return !!s && !s.isCollapsed && s.toString().trim().length > 0;
}

/** Keyboard shortcuts (tldraw/Figma conventions). Delete/Backspace is handled by React Flow. */
export function useShortcuts() {
  const rf = useReactFlow();
  useEffect(() => {
    // Clipboard through the native events: no permission prompt, and the system clipboard carries
    // images and text copied in other apps (tldraw/Excalidraw handle paste the same way).
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, onCanvas: false };
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.onCanvas = !!(e.target as Element | null)?.closest?.('.react-flow__renderer');
    };
    const at = () => rf.screenToFlowPosition({ x: pointer.x, y: pointer.y });
    // Native clipboard events normally follow ⌘C/⌘X/⌘V; when a browser does not fire them
    // (no focusable target, automation), the key handler falls back to the in-app copy.
    let nativeClip = false;
    const fallback = (fn: () => void) => {
      nativeClip = false;
      setTimeout(() => {
        if (!nativeClip) fn();
      }, 60);
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && !e.shiftKey && (k === 'c' || k === 'x') && !hasTextSelection()) {
        fallback(() => {
          if (copySelection() && k === 'x') deleteNodes([...useUi.getState().selected]);
        });
        return;
      }
      if (mod && !e.shiftKey && k === 'v') {
        if (useUi.getState().editingNodeId || document.querySelector('dialog[open]')) return;
        fallback(() => pasteNodes(null, at, pointer.onCanvas));
        return;
      }
      // ⌥P toggles the Performance panel (e.code: Option changes e.key on macOS).
      if (e.altKey && !mod && e.code === 'KeyP') {
        e.preventDefault();
        useUi.setState((s) => ({ perfOpen: !s.perfOpen }));
        return;
      }
      // Board file (draw.io convention): ⌘S downloads the canvas, ⌘O opens a .annie3d file.
      if (mod && !e.shiftKey && (k === 's' || k === 'o')) {
        e.preventDefault();
        if (k === 's') void exportBoardFile();
        else openBoardFilePicker();
        return;
      }
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
      // ⌘+/⌘− (and + / − alone) step through the zoom presets; Shift+0 goes to 100% (Miro).
      if (k === '=' || k === '+' || (k === '-' && !e.shiftKey)) {
        e.preventDefault();
        zoomStep(rf, k === '-' ? -1 : 1);
        return;
      }
      if (e.shiftKey && (k === '0' || k === ')')) {
        e.preventDefault();
        zoomToLevel(rf, 1);
        return;
      }
      if (mod) return;
      if (k === 'v') useUi.setState({ tool: 'select' });
      else if (k === 'h') useUi.setState({ tool: 'hand' });
      else if ((k === '1' || k === '!') && e.shiftKey) void rf.fitView({ duration: 250, padding: 0.1 });
      // Shift+2: zoom to selection (tldraw/Figma convention).
      else if ((k === '2' || k === '@') && e.shiftKey) {
        const ids = [...useUi.getState().selected];
        if (ids.length)
          void rf.fitView({ nodes: ids.map((id) => ({ id })), duration: 250, padding: 0.3, maxZoom: 1 });
      } else if (k === 'escape') useUi.setState({ selected: new Set(), palette: null, contextMenu: null });
    };
    const onCopy = (e: ClipboardEvent) => {
      nativeClip = true;
      if (typing(e.target) || hasTextSelection()) return;
      if (copySelection(e.clipboardData)) e.preventDefault();
    };
    const onCut = (e: ClipboardEvent) => {
      nativeClip = true;
      if (typing(e.target) || hasTextSelection()) return;
      if (!copySelection(e.clipboardData)) return;
      e.preventDefault();
      deleteNodes([...useUi.getState().selected]);
    };
    const onPaste = (e: ClipboardEvent) => {
      nativeClip = true;
      if (typing(e.target) || useUi.getState().editingNodeId || document.querySelector('dialog[open]'))
        return;
      handlePaste(e, at, pointer.onCanvas);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
      window.removeEventListener('paste', onPaste);
    };
  }, [rf]);
}
