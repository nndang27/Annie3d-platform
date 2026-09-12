import {
  NODE_CATEGORIES,
  NODE_KINDS,
  type NodeCategory,
  type NodeKind,
  type PortType,
} from '@3dads/contracts';
import {
  AudioLines,
  Box,
  Check,
  Clapperboard,
  Download,
  FileText,
  Image,
  ImagePlus,
  LayoutTemplate,
  MessageSquare,
  Scaling,
  SearchCheck,
  Sparkles,
  Type,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';

export const NODE_ICON: Record<NodeKind, typeof Box> = {
  reference: Upload,
  brief: FileText,
  text: Type,
  comment: MessageSquare,
  'image-gen': ImagePlus,
  'image-edit': Wand2,
  'image-upscale': Scaling,
  'video-gen': Video,
  tts: AudioLines,
  reconstruct: Box,
  scene: Sparkles,
  animation: Clapperboard,
  'ad-variants': LayoutTemplate,
  review: SearchCheck,
  export: Download,
};

export const PORT_ICON: Record<PortType, typeof Box> = {
  image: Image,
  text: Type,
  video: Video,
  model3d: Box,
  scene: Sparkles,
  audio: AudioLines,
  approval: Check,
};

/** Palette order: inputs first, then media, then 3D and outputs. Comment is added from the context menu/toolbar. */
export const PALETTE_KINDS: NodeKind[] = (Object.keys(NODE_KINDS) as NodeKind[]).filter(
  (k) => k !== 'comment',
);

export const CATEGORIES: NodeCategory[] = NODE_CATEGORIES;

/** Bottom toolbar "add" group (≤ 9 like Flows). */
export const TOOLBAR_KINDS: NodeKind[] = [
  'reference',
  'text',
  'image-gen',
  'video-gen',
  'reconstruct',
  'scene',
  'animation',
  'ad-variants',
  'export',
];

const USAGE_KEY = '3dads.nodeUsage';

export function recordNodeUsage(kind: NodeKind): void {
  try {
    const m = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as Record<string, number>;
    m[kind] = (m[kind] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function mostUsedKinds(n = 5): NodeKind[] {
  let m: Record<string, number> = {};
  try {
    m = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}');
  } catch {
    /* ignore */
  }
  const defaults: NodeKind[] = ['image-gen', 'video-gen', 'reconstruct', 'scene', 'reference'];
  const ranked = PALETTE_KINDS.filter((k) => m[k]).sort((a, b) => (m[b] ?? 0) - (m[a] ?? 0));
  return [...new Set([...ranked, ...defaults])].slice(0, n);
}

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
export const MOD = isMac() ? '⌘' : 'Ctrl';
