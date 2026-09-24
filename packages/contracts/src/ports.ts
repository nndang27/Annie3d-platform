import { z } from 'zod';

export const PORT_TYPES = ['image', 'text', 'model3d', 'scene', 'video', 'audio', 'file'] as const;
export const PortType = z.enum(PORT_TYPES);
export type PortType = z.infer<typeof PortType>;

/** Colours match the approved canvas UI (docs/ui/approved-canvas-free-graph.png). */
export const PORT_COLOR: Record<PortType, string> = {
  image: '#378ADD',
  text: '#888780',
  model3d: '#7F77DD',
  scene: '#1D9E75',
  video: '#D85A30',
  audio: '#D4537E',
  file: '#5F5E5A',
};

export interface InputPortDef {
  id: string;
  label: string;
  /** Types this port accepts. A port may accept several (e.g. scene or model3d). */
  accepts: readonly PortType[];
  required?: boolean;
  /** Maximum incoming edges; 1 when omitted. */
  max?: number;
}

export interface OutputPortDef {
  id: 'out';
  label: string;
  type: PortType;
}
