export type NodeKind =
  | 'reference'
  | 'brief'
  | 'text'
  | 'comment'
  | 'image-gen'
  | 'image-edit'
  | 'image-upscale'
  | 'video-gen'
  | 'tts'
  | 'reconstruct'
  | 'scene'
  | 'animation'
  | 'ad-variants'
  | 'review'
  | 'export';

/** Media-typed ports. Any node may accept image, text, video or 3D inputs; required ones are marked. */
export type PortType = 'image' | 'text' | 'video' | 'model3d' | 'scene' | 'audio' | 'approval';

export interface PortSpec {
  id: string;
  type: PortType;
  label: string;
  required?: boolean;
}

export type NodeCategory = 'Input' | 'Image' | 'Video' | 'Audio' | '3D' | 'Output';

export interface NodeSettingField {
  key: string;
  label: string;
  options: string[];
  default: string;
}

export interface NodeKindSpec {
  kind: NodeKind;
  title: string;
  category: NodeCategory;
  description: string;
  /** Shown top-right of the node, like a model name. Honest: everything is a demo engine. */
  engine: string;
  engines: string[];
  inputs: PortSpec[];
  output?: PortSpec;
  /** Whether the mock engine executes it (inputs/notes are not executed). */
  executable: boolean;
  /** Illustrative credits consumed when executed. */
  credits: number;
  /** Footer settings chips. */
  settings: NodeSettingField[];
  placeholder: string;
}

const ASPECTS = ['16:9', '1:1', '4:5', '9:16'];
const RES = ['1K', '2K'];
const DUR = ['4s', '6s', '8s', '10s'];

/** Optional generic inputs every generative node accepts (any media in). */
const anyIn = (exclude: PortType[] = []): PortSpec[] =>
  (
    [
      { id: 'in-image', type: 'image', label: 'Image' },
      { id: 'in-text', type: 'text', label: 'Text' },
      { id: 'in-video', type: 'video', label: 'Video' },
      { id: 'in-model3d', type: 'model3d', label: '3D model' },
    ] as PortSpec[]
  ).filter((p) => !exclude.includes(p.type));

export const NODE_KINDS: Record<NodeKind, NodeKindSpec> = {
  reference: {
    kind: 'reference',
    title: 'Product reference',
    category: 'Input',
    description: 'The uploaded image or catalog fixture that anchors the product.',
    engine: 'Upload',
    engines: ['Upload'],
    inputs: [],
    output: { id: 'image', type: 'image', label: 'Reference' },
    executable: false,
    credits: 0,
    settings: [],
    placeholder: 'Upload a product image or pick a catalog fixture.',
  },
  brief: {
    kind: 'brief',
    title: 'Creative brief',
    category: 'Input',
    description: 'Goal, audience, tone and formats for the campaign, as text.',
    engine: 'Text',
    engines: ['Text'],
    inputs: [],
    output: { id: 'brief', type: 'text', label: 'Brief' },
    executable: false,
    credits: 0,
    settings: [],
    placeholder: 'Describe the campaign goal, audience and tone.',
  },
  text: {
    kind: 'text',
    title: 'Text',
    category: 'Input',
    description: 'A text block other nodes can read as a prompt or caption.',
    engine: 'Text',
    engines: ['Text'],
    inputs: [],
    output: { id: 'text', type: 'text', label: 'Text' },
    executable: false,
    credits: 0,
    settings: [],
    placeholder: 'Write text to feed into other nodes…',
  },
  comment: {
    kind: 'comment',
    title: 'Comment',
    category: 'Input',
    description: 'A note on the canvas. Not part of execution.',
    engine: 'Note',
    engines: ['Note'],
    inputs: [],
    executable: false,
    credits: 0,
    settings: [],
    placeholder: 'Leave a note for your team…',
  },
  'image-gen': {
    kind: 'image-gen',
    title: 'Image generation',
    category: 'Image',
    description:
      'Generates a product image from a prompt and optional references. Demo output is a labelled fixture render.',
    engine: 'Demo image engine',
    engines: ['Demo image engine'],
    inputs: anyIn(),
    output: { id: 'image', type: 'image', label: 'Image' },
    executable: true,
    credits: 1,
    settings: [
      { key: 'aspect', label: 'Aspect', options: ASPECTS, default: '1:1' },
      { key: 'resolution', label: 'Resolution', options: RES, default: '1K' },
    ],
    placeholder: 'Describe the image to generate…',
  },
  'image-edit': {
    kind: 'image-edit',
    title: 'Edit image',
    category: 'Image',
    description: 'Edits an input image according to the prompt.',
    engine: 'Demo image engine',
    engines: ['Demo image engine'],
    inputs: [{ id: 'image', type: 'image', label: 'Image', required: true }, ...anyIn(['image'])],
    output: { id: 'image', type: 'image', label: 'Image' },
    executable: true,
    credits: 1,
    settings: [{ key: 'resolution', label: 'Resolution', options: RES, default: '1K' }],
    placeholder: 'Describe the edit, e.g. “replace the background with a sunset”…',
  },
  'image-upscale': {
    kind: 'image-upscale',
    title: 'Image upscale',
    category: 'Image',
    description: 'Upscales an input image.',
    engine: 'Demo image engine',
    engines: ['Demo image engine'],
    inputs: [{ id: 'image', type: 'image', label: 'Image', required: true }],
    output: { id: 'image', type: 'image', label: 'Image' },
    executable: true,
    credits: 1,
    settings: [{ key: 'resolution', label: 'Resolution', options: ['2K', '4K'], default: '2K' }],
    placeholder: 'Optional notes for the upscale…',
  },
  'video-gen': {
    kind: 'video-gen',
    title: 'Video generation',
    category: 'Video',
    description:
      'Generates a clip from a prompt, with optional image, text, video or 3D references. Demo delivers a labelled sample clip.',
    engine: 'Demo video engine',
    engines: ['Demo video engine'],
    inputs: anyIn(),
    output: { id: 'video', type: 'video', label: 'Video' },
    executable: true,
    credits: 2,
    settings: [
      { key: 'aspect', label: 'Aspect', options: ASPECTS, default: '16:9' },
      { key: 'resolution', label: 'Resolution', options: ['720p', '1080p'], default: '1080p' },
      { key: 'duration', label: 'Duration', options: DUR, default: '6s' },
    ],
    placeholder: 'Describe the shot, camera move and mood…',
  },
  tts: {
    kind: 'tts',
    title: 'Text to speech',
    category: 'Audio',
    description: 'Voice-over from text. Demo output is a synthetic tone, not speech.',
    engine: 'Demo voice engine',
    engines: ['Demo voice engine'],
    inputs: [{ id: 'text', type: 'text', label: 'Text' }],
    output: { id: 'audio', type: 'audio', label: 'Audio' },
    executable: true,
    credits: 1,
    settings: [{ key: 'voice', label: 'Voice', options: ['Mark', 'Ana', 'Linh'], default: 'Mark' }],
    placeholder: 'Type the line to be spoken…',
  },
  reconstruct: {
    kind: 'reconstruct',
    title: 'Build 3D model',
    category: '3D',
    description:
      'Produces the product model. In the demo this is a labelled fixture, not a reconstruction of the image.',
    engine: 'Demo 3D engine',
    engines: ['Demo 3D engine'],
    inputs: [
      { id: 'image', type: 'image', label: 'Reference', required: true },
      ...anyIn(['image', 'model3d']),
    ],
    output: { id: 'model', type: 'model3d', label: 'Model' },
    executable: true,
    credits: 2,
    settings: [
      { key: 'detail', label: 'Detail', options: ['draft', 'standard', 'high'], default: 'standard' },
    ],
    placeholder: 'Notes for the model build (materials, parts to keep separate)…',
  },
  scene: {
    kind: 'scene',
    title: 'Compose scene',
    category: '3D',
    description: 'Background, material, lighting, camera and placement around the model.',
    engine: 'Demo 3D engine',
    engines: ['Demo 3D engine'],
    inputs: [
      { id: 'model', type: 'model3d', label: 'Model', required: true },
      { id: 'brief', type: 'text', label: 'Brief' },
      ...anyIn(['text', 'model3d']),
    ],
    output: { id: 'scene', type: 'scene', label: 'Scene' },
    executable: true,
    credits: 1,
    settings: [
      {
        key: 'background',
        label: 'Background',
        options: ['studio-white', 'cool-gray', 'charcoal', 'brand'],
        default: 'studio-white',
      },
      {
        key: 'light',
        label: 'Light',
        options: ['studio-soft', 'dramatic', 'daylight'],
        default: 'studio-soft',
      },
    ],
    placeholder: 'Describe the scene: backdrop, lighting, mood…',
  },
  animation: {
    kind: 'animation',
    title: 'Animate 3D',
    category: '3D',
    description: 'Turntable, orbit sweep or dolly presets with a duration.',
    engine: 'Demo 3D engine',
    engines: ['Demo 3D engine'],
    inputs: [{ id: 'scene', type: 'scene', label: 'Scene', required: true }, ...anyIn(['model3d'])],
    output: { id: 'clip', type: 'video', label: 'Clip' },
    executable: true,
    credits: 2,
    settings: [
      {
        key: 'preset',
        label: 'Preset',
        options: ['turntable', 'orbit-sweep', 'dolly-in'],
        default: 'turntable',
      },
      { key: 'durationSec', label: 'Duration', options: ['4', '6', '8', '10'], default: '6' },
    ],
    placeholder: 'Describe the camera move…',
  },
  'ad-variants': {
    kind: 'ad-variants',
    title: 'Ad variants',
    category: 'Output',
    description: 'Headline, CTA, brand colour and layout across aspect ratios.',
    engine: 'Demo layout engine',
    engines: ['Demo layout engine'],
    inputs: [
      { id: 'clip', type: 'video', label: 'Clip' },
      { id: 'brief', type: 'text', label: 'Brief' },
      { id: 'in-image', type: 'image', label: 'Image' },
      { id: 'in-scene', type: 'scene', label: 'Scene' },
    ],
    output: { id: 'variants', type: 'image', label: 'Variants' },
    executable: true,
    credits: 1,
    settings: [
      {
        key: 'layout',
        label: 'Layout',
        options: ['text-left', 'text-bottom', 'centered'],
        default: 'text-left',
      },
    ],
    placeholder: 'Headline, CTA and tone for the variants…',
  },
  review: {
    kind: 'review',
    title: 'Review',
    category: 'Output',
    description: 'Compare variants and accept the output to use.',
    engine: 'You',
    engines: ['You'],
    inputs: [
      { id: 'variants', type: 'image', label: 'Images' },
      { id: 'in-video', type: 'video', label: 'Video' },
      { id: 'in-scene', type: 'scene', label: 'Scene' },
      { id: 'in-model3d', type: 'model3d', label: '3D model' },
    ],
    output: { id: 'approval', type: 'approval', label: 'Accepted' },
    executable: false,
    credits: 0,
    settings: [],
    placeholder: 'Notes for reviewers…',
  },
  export: {
    kind: 'export',
    title: 'Export',
    category: 'Output',
    description: 'Render presets for the accepted output.',
    engine: 'Demo render queue',
    engines: ['Demo render queue'],
    inputs: [
      { id: 'approval', type: 'approval', label: 'Accepted' },
      { id: 'in-image', type: 'image', label: 'Image' },
      { id: 'in-video', type: 'video', label: 'Video' },
      { id: 'in-scene', type: 'scene', label: 'Scene' },
    ],
    executable: true,
    credits: 1,
    settings: [{ key: 'format', label: 'Format', options: ['json', 'png', 'mp4'], default: 'json' }],
    placeholder: 'Delivery notes…',
  },
};

export const NODE_CATEGORIES: NodeCategory[] = ['Input', 'Image', 'Video', 'Audio', '3D', 'Output'];

export type NodeSettings = Record<string, string | number | boolean>;

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  title: string;
  position: { x: number; y: number };
  settings: NodeSettings;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface WorkflowDoc {
  id: string;
  projectId: string;
  revision: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: number;
}

export function portTypeOf(node: WorkflowNode, portId: string, dir: 'in' | 'out'): PortType | undefined {
  const spec = NODE_KINDS[node.kind];
  if (dir === 'out') return spec.output?.id === portId ? spec.output.type : undefined;
  return spec.inputs.find((p) => p.id === portId)?.type;
}

export interface ConnectionCheck {
  ok: boolean;
  reason?: string;
}

/** Validates a connection: matching port types, no self loops, no duplicate target input, no cycles. */
export function checkConnection(doc: WorkflowDoc, edge: Omit<WorkflowEdge, 'id'>): ConnectionCheck {
  if (edge.source === edge.target) return { ok: false, reason: 'A node cannot feed itself.' };
  const source = doc.nodes.find((n) => n.id === edge.source);
  const target = doc.nodes.find((n) => n.id === edge.target);
  if (!source || !target) return { ok: false, reason: 'Unknown node.' };
  const outType = portTypeOf(source, edge.sourcePort, 'out');
  const inType = portTypeOf(target, edge.targetPort, 'in');
  if (!outType || !inType) return { ok: false, reason: 'Unknown port.' };
  if (outType !== inType)
    return { ok: false, reason: `Cannot connect ${PORT_LABEL[outType]} to a ${PORT_LABEL[inType]} input.` };
  if (doc.edges.some((e) => e.target === edge.target && e.targetPort === edge.targetPort))
    return { ok: false, reason: 'That input already has a connection. Disconnect it first.' };
  if (reaches(doc, edge.target, edge.source)) return { ok: false, reason: 'That would create a loop.' };
  return { ok: true };
}

export const PORT_LABEL: Record<PortType, string> = {
  image: 'image',
  text: 'text',
  video: 'video',
  model3d: '3D model',
  scene: 'scene',
  audio: 'audio',
  approval: 'accepted output',
};

function reaches(doc: WorkflowDoc, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === to) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const e of doc.edges) if (e.source === n) stack.push(e.target);
  }
  return false;
}

/** Topological order of nodes (Kahn). Nodes in cycles are appended last. */
export function topologicalOrder(doc: WorkflowDoc): WorkflowNode[] {
  const indeg = new Map<string, number>();
  for (const n of doc.nodes) indeg.set(n.id, 0);
  for (const e of doc.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = doc.nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .sort((a, b) => a.position.x - b.position.x);
  const out: WorkflowNode[] = [];
  const done = new Set<string>();
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    done.add(n.id);
    for (const e of doc.edges) {
      if (e.source !== n.id) continue;
      const d = (indeg.get(e.target) ?? 1) - 1;
      indeg.set(e.target, d);
      if (d === 0) queue.push(doc.nodes.find((x) => x.id === e.target)!);
    }
  }
  for (const n of doc.nodes) if (!done.has(n.id)) out.push(n);
  return out;
}

/** Steps that a run executes: executable nodes, with their missing required inputs. */
export function executableSteps(doc: WorkflowDoc): { node: WorkflowNode; missing: string[] }[] {
  return topologicalOrder(doc)
    .filter((n) => NODE_KINDS[n.kind].executable)
    .map((node) => {
      const spec = NODE_KINDS[node.kind];
      const missing = spec.inputs
        .filter((p) => p.required && !doc.edges.some((e) => e.target === node.id && e.targetPort === p.id))
        .map((p) => p.label);
      return { node, missing };
    });
}

/** Upstream nodes feeding a node, with the port they land on. */
export function upstreamOf(doc: WorkflowDoc, nodeId: string): { node: WorkflowNode; port: PortSpec }[] {
  const target = doc.nodes.find((n) => n.id === nodeId);
  if (!target) return [];
  const spec = NODE_KINDS[target.kind];
  return doc.edges
    .filter((e) => e.target === nodeId)
    .map((e) => ({
      node: doc.nodes.find((n) => n.id === e.source)!,
      port: spec.inputs.find((p) => p.id === e.targetPort)!,
    }))
    .filter((x) => x.node && x.port);
}
