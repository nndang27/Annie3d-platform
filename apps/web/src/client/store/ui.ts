import { create } from 'zustand';

export type Lod = 'full' | 'medium' | 'compact';

export interface UiState {
  /** Level of detail from the SETTLED zoom (tldraw getEfficientZoomLevel: LOD never changes mid-gesture). */
  lod: Lod;
  zoom: number;
  selected: ReadonlySet<string>;
  /** The one node allowed to play its turntable clip (only one video plays at a time). */
  playingNodeId: string | null;
  tool: 'select' | 'hand';
  palette: null | {
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    accepts?: string;
    fromNodeId?: string;
  };
  contextMenu: null | { x: number; y: number; flowX: number; flowY: number; nodeId?: string };
  agentOpen: boolean;
  editingNodeId: string | null;
  /** Nodes the first paint should frame (the example's first line); null frames everything. */
  initialFit: string[] | null;
  toasts: { id: number; text: string; tone: 'info' | 'error' }[];
  signInPrompt: null | { reason: 'run' | 'share' | 'save'; nodeId?: string };
  /** Top-level dialogs (share, export, billing, reel); rendered lazily. */
  dialog:
    | null
    | { type: 'share' }
    | { type: 'export'; nodeId?: string }
    | { type: 'billing' }
    | { type: 'reel' }
    | { type: 'run'; nodeId: string | null; scope: string };
}

export const useUi = create<UiState>()(() => ({
  lod: 'full',
  zoom: 0.8,
  selected: new Set(),
  playingNodeId: null,
  tool: 'select',
  palette: null,
  contextMenu: null,
  agentOpen: true,
  editingNodeId: null,
  initialFit: null,
  toasts: [],
  signInPrompt: null,
  dialog: null,
}));

export function lodFor(zoom: number): Lod {
  return zoom >= 0.6 ? 'full' : zoom >= 0.3 ? 'medium' : 'compact';
}

let toastId = 0;
export function toast(text: string, tone: 'info' | 'error' = 'info') {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
}
