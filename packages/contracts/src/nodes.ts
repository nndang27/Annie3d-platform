import { z } from 'zod';
import type { InputPortDef, OutputPortDef } from './ports';
import { ASPECTS, GLB_PRESETS, LOOK_PRESETS, MOTION_PRESETS } from './presets';

const lookIds = LOOK_PRESETS.map((p) => p.id) as [string, ...string[]];
const motionIds = MOTION_PRESETS.map((p) => p.id) as [string, ...string[]];
const glbIds = Object.keys(GLB_PRESETS) as [string, ...string[]];

const assetRef = z.string().uuid().nullable().default(null);

/** Settings per node kind. Every schema has defaults so `parse({})` yields a valid node. */
export const NodeSettings = {
  photo: z.object({ assetId: assetRef }),
  text: z.object({
    role: z.enum(['brief', 'headline', 'prompt', 'cta']).default('prompt'),
    text: z.string().max(4000).default(''),
  }),
  upload3d: z.object({ assetId: assetRef }),
  audio: z.object({ assetId: assetRef }),
  model3d: z.object({
    prompt: z.string().max(2000).default(''),
    builder: z.enum(['auto', 'code', 'generative']).default('auto'),
    detail: z.enum(['draft', 'standard', 'high']).default('standard'),
  }),
  stage: z.object({
    prompt: z.string().max(2000).default(''),
    look: z.enum(lookIds).default('studio-light'),
    background: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default('#f4f4f2'),
  }),
  packshot: z.object({
    angles: z.enum(['four', 'custom']).default('four'),
    size: z.enum(['1k', '2k']).default('1k'),
    camera: z
      .object({
        position: z.tuple([z.number(), z.number(), z.number()]),
        target: z.tuple([z.number(), z.number(), z.number()]),
        fov: z.number().min(10).max(90),
      })
      .nullable()
      .default(null),
  }),
  adVideo: z.object({
    prompt: z.string().max(2000).default(''),
    motion: z.enum(motionIds).default('turntable'),
    aspect: z.enum(ASPECTS).default('9:16'),
    durationSec: z.union([z.literal(6), z.literal(10), z.literal(15)]).default(10),
  }),
  export: z.object({
    glbPreset: z.enum(glbIds).default('web'),
    includeMp4: z.boolean().default(true),
    includePng: z.boolean().default(true),
  }),
  note: z.object({ text: z.string().max(4000).default('') }),
} as const;

export type NodeKind = keyof typeof NodeSettings;
export const NODE_KINDS = Object.keys(NodeSettings) as NodeKind[];
export const NodeKindSchema = z.enum(NODE_KINDS as [NodeKind, ...NodeKind[]]);
export type SettingsOf<K extends NodeKind> = z.infer<(typeof NodeSettings)[K]>;

export interface NodeKindDef {
  kind: NodeKind;
  label: string;
  /** Category drives palette grouping. */
  category: 'input' | 'build' | 'stage' | 'output' | 'note';
  inputs: readonly InputPortDef[];
  output: OutputPortDef | null;
  /** Whether the node runs an engine (and therefore costs credits and has versions). */
  runnable: boolean;
  engine: string;
  /** Shortcut in the bottom toolbar. */
  toolbar: boolean;
}

export const NODE_DEFS: Record<NodeKind, NodeKindDef> = {
  photo: {
    kind: 'photo',
    label: 'Photo',
    category: 'input',
    inputs: [],
    output: { id: 'out', label: 'Image', type: 'image' },
    runnable: false,
    engine: 'Upload',
    toolbar: true,
  },
  text: {
    kind: 'text',
    label: 'Text',
    category: 'input',
    inputs: [],
    output: { id: 'out', label: 'Text', type: 'text' },
    runnable: false,
    engine: 'Text',
    toolbar: true,
  },
  upload3d: {
    kind: 'upload3d',
    label: 'Upload 3D',
    category: 'input',
    inputs: [],
    output: { id: 'out', label: '3D model', type: 'model3d' },
    runnable: false,
    engine: 'Upload',
    toolbar: false,
  },
  audio: {
    kind: 'audio',
    label: 'Music',
    category: 'input',
    inputs: [],
    output: { id: 'out', label: 'Audio', type: 'audio' },
    runnable: false,
    engine: 'Upload',
    toolbar: false,
  },
  model3d: {
    kind: 'model3d',
    label: '3D model',
    category: 'build',
    inputs: [
      { id: 'images', label: 'Photos', accepts: ['image'], max: 4 },
      { id: 'prompt', label: 'Description', accepts: ['text'] },
    ],
    output: { id: 'out', label: '3D model', type: 'model3d' },
    runnable: true,
    engine: 'Builder',
    toolbar: true,
  },
  stage: {
    kind: 'stage',
    label: 'Stage',
    category: 'stage',
    inputs: [
      { id: 'model', label: '3D model', accepts: ['model3d'], required: true },
      { id: 'prompt', label: 'Direction', accepts: ['text'] },
      { id: 'style', label: 'Style reference', accepts: ['image'] },
    ],
    output: { id: 'out', label: 'Scene', type: 'scene' },
    runnable: true,
    engine: 'Scene director',
    toolbar: true,
  },
  packshot: {
    kind: 'packshot',
    label: 'Packshot',
    category: 'output',
    inputs: [{ id: 'subject', label: 'Model or scene', accepts: ['model3d', 'scene'], required: true }],
    output: { id: 'out', label: 'Images', type: 'image' },
    runnable: true,
    engine: 'Renderer',
    toolbar: true,
  },
  adVideo: {
    kind: 'adVideo',
    label: 'Ad video',
    category: 'output',
    inputs: [
      { id: 'subject', label: 'Scene or model', accepts: ['scene', 'model3d'], required: true },
      { id: 'headline', label: 'Headline', accepts: ['text'] },
      { id: 'logo', label: 'Logo', accepts: ['image'] },
      { id: 'music', label: 'Music', accepts: ['audio'] },
    ],
    output: { id: 'out', label: 'Video', type: 'video' },
    runnable: true,
    engine: 'Renderer',
    toolbar: true,
  },
  export: {
    kind: 'export',
    label: 'Export',
    category: 'output',
    inputs: [
      {
        id: 'items',
        label: 'Outputs',
        accepts: ['model3d', 'scene', 'video', 'image'],
        required: true,
        max: 8,
      },
    ],
    output: { id: 'out', label: 'Files', type: 'file' },
    runnable: true,
    engine: 'Packager',
    toolbar: true,
  },
  note: {
    kind: 'note',
    label: 'Note',
    category: 'note',
    inputs: [],
    output: null,
    runnable: false,
    engine: 'Note',
    toolbar: false,
  },
};

export function defaultSettings<K extends NodeKind>(kind: K): SettingsOf<K> {
  return NodeSettings[kind].parse({}) as SettingsOf<K>;
}

export function parseSettings<K extends NodeKind>(kind: K, raw: unknown): SettingsOf<K> {
  return NodeSettings[kind].parse(raw ?? {}) as SettingsOf<K>;
}
