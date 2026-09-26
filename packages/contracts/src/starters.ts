import { generateKeyBetween } from 'fractional-indexing';
import type { EdgeRecord, NodeRecord } from './graph';
import { newId } from './ids';
import { defaultSettings, type NodeKind } from './nodes';

export const STARTERS = ['teardown-reveal', 'stone-water', 'splash-hero'] as const;
export type StarterId = (typeof STARTERS)[number];

export const STARTER_META: Record<StarterId, { title: string; vertical: string; description: string }> = {
  'teardown-reveal': {
    title: 'Teardown reveal',
    vertical: 'Electronics',
    description: 'The product comes apart layer by layer, holds, then snaps back together.',
  },
  'stone-water': {
    title: 'Stone & water',
    vertical: 'Jewelry',
    description: 'The piece rests on wet stone beside a thin waterfall; slow push-in, glints.',
  },
  'splash-hero': {
    title: 'Splash hero',
    vertical: 'Beauty',
    description: 'The bottle rises through a splash in its own colour and settles on a podium.',
  },
};

interface Spec {
  key: string;
  kind: NodeKind;
  x: number;
  y: number;
  label?: string;
  settings?: Record<string, unknown>;
}

const LOOK: Record<StarterId, string> = {
  'teardown-reveal': 'dark-lab',
  'stone-water': 'stone-water',
  'splash-hero': 'splash-pastel',
};
/** F13: where each Starter's product is previewed first. */
const SIM_FOR: Record<StarterId, 'shop' | 'tiktok' | 'showroom'> = {
  'teardown-reveal': 'showroom',
  'stone-water': 'shop',
  'splash-hero': 'tiktok',
};
const HEADLINE: Record<StarterId, string> = {
  'teardown-reveal': 'Engineered to the last screw',
  'stone-water': 'Made to be noticed',
  'splash-hero': 'Meet the new formula',
};

/**
 * The words a Starter writes into its nodes, in the person's language (the web app passes them
 * from its catalog; the contracts do not depend on i18n). English when left out.
 */
export interface StarterWords {
  /** Label of the photo node ("Product photo"). */
  photo?: string;
  /** Label of the headline Text node ("Headline"). */
  headline?: string;
  /** Label of the Packshot node ("Packshots"). */
  pack?: string;
  /** The sample headline itself. */
  headlineText?: string;
  /** The Simulation node's call to action ("Shop now"). */
  cta?: string;
}

/**
 * Starter graphs are ordinary, editable nodes (approved UI, 2026-09-24): no frame, no lock.
 * Coordinates follow docs/ui/approved-canvas-free-graph.png. Nodes named after their kind have
 * no label, so their name follows the language they are shown in.
 */
export function starterGraph(
  id: StarterId,
  origin = { x: 0, y: 0 },
  words: StarterWords = {},
): { nodes: NodeRecord[]; edges: EdgeRecord[] } {
  const specs: Spec[] = [
    { key: 'photo', kind: 'photo', x: 0, y: 40, label: words.photo ?? 'Product photo' },
    {
      key: 'headline',
      kind: 'text',
      x: 0,
      y: 420,
      label: words.headline ?? 'Headline',
      settings: { role: 'headline', text: words.headlineText ?? HEADLINE[id] },
    },
    {
      key: 'model',
      kind: 'model3d',
      x: 480,
      y: 60,
      settings: { builder: 'auto', detail: 'standard' },
    },
    {
      key: 'pack',
      kind: 'packshot',
      x: 960,
      y: -140,
      label: words.pack ?? 'Packshots',
      settings: { angles: 'four' },
    },
    { key: 'stage', kind: 'stage', x: 960, y: 250, settings: { look: LOOK[id] } },
    {
      key: 'video',
      kind: 'adVideo',
      x: 1440,
      y: 200,
      settings: { motion: id, aspect: '9:16', durationSec: 10 },
    },
    {
      key: 'export',
      kind: 'export',
      x: 1920,
      y: 200,
      settings: { glbPreset: 'web', includeMp4: true, includePng: true },
    },
    {
      key: 'sim',
      kind: 'simulation',
      x: 1440,
      y: 620,
      settings: { environment: SIM_FOR[id], ...(words.cta ? { cta: words.cta } : {}) },
    },
  ];
  const ids = new Map(specs.map((s) => [s.key, newId()]));
  let z: string | null = null;
  const nodes: NodeRecord[] = specs.map((s) => {
    z = generateKeyBetween(z, null);
    return {
      id: ids.get(s.key)!,
      kind: s.kind,
      x: origin.x + s.x,
      y: origin.y + s.y,
      label: s.label ?? null,
      settings: { ...defaultSettings(s.kind), ...(s.settings ?? {}) },
      zKey: z,
      version: 1,
      currentVersionId: null,
    };
  });
  const link = (from: string, to: string, port: string): EdgeRecord => ({
    id: newId(),
    source: ids.get(from)!,
    sourcePort: 'out',
    target: ids.get(to)!,
    targetPort: port,
  });
  const edges = [
    link('photo', 'model', 'images'),
    link('model', 'pack', 'subject'),
    link('model', 'stage', 'model'),
    link('stage', 'video', 'subject'),
    link('headline', 'video', 'headline'),
    link('video', 'export', 'items'),
    link('model', 'export', 'items'),
    link('model', 'sim', 'subject'),
    link('headline', 'sim', 'headline'),
  ];
  return { nodes, edges };
}
