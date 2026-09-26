import type { NodeKind, PortType } from '@annie3d/contracts';
import {
  AudioLines,
  Box,
  Camera,
  Clapperboard,
  Image as ImageIcon,
  type LucideIcon,
  MonitorSmartphone,
  Music,
  Package,
  StickyNote,
  Type,
  Video,
} from 'lucide-react';

/** One icon per data type: ports and wires are told apart by shape, not by colour. */
export const PORT_ICON: Record<PortType, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  model3d: Box,
  scene: Clapperboard,
  video: Video,
  audio: AudioLines,
  file: Package,
};

/** One icon per node kind: the node header, the toolbar and the palette use the same one. */
export const KIND_ICON: Record<NodeKind, LucideIcon> = {
  photo: ImageIcon,
  text: Type,
  upload3d: Box,
  audio: Music,
  model3d: Box,
  stage: Clapperboard,
  packshot: Camera,
  adVideo: Video,
  export: Package,
  note: StickyNote,
  simulation: MonitorSmartphone,
};
