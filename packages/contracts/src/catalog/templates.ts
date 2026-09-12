import type { AspectRatio } from '../identity';
import type { AdLayout, AnimationPreset, BackgroundPreset, LightPreset, ProductFixtureId } from '../scene';
import type { NodeKind } from '../workflow';

export type TemplateCategory = 'Hero & launch' | 'Feature callouts' | 'Social' | 'Catalog' | 'Comparison';

export interface TemplateNodePreset {
  id: string;
  kind: NodeKind;
  title?: string;
  x: number;
  y: number;
  settings?: Record<string, string | number | boolean>;
}

export interface Template {
  slug: string;
  name: string;
  category: TemplateCategory;
  tags: string[];
  outcome: string;
  suitableFor: string;
  requiredInput: string[];
  deliverable: string[];
  limits: string[];
  fixtureId: ProductFixtureId;
  aspects: AspectRatio[];
  /** Illustrative demo credits for one full run. */
  sampleCredits: number;
  sampleDurationSec: number;
  scene: {
    background: BackgroundPreset;
    light: LightPreset;
    animation: AnimationPreset;
    durationSec: number;
    materialColor?: string;
  };
  ad: { headline: string; subheadline: string; cta: string; layout: AdLayout; brandColor: string };
  nodes: TemplateNodePreset[];
  edges: [string, string, string, string][]; // source, sourcePort, target, targetPort
  /** Poster file under fixtures/posters (rendered by scripts/render-posters.mjs). */
  poster: string;
}

const FULL_FLOW = (aspect: AspectRatio): { nodes: TemplateNodePreset[]; edges: Template['edges'] } => ({
  nodes: [
    { id: 'n-ref', kind: 'reference', x: 0, y: 120 },
    { id: 'n-brief', kind: 'brief', x: 0, y: 360 },
    { id: 'n-model', kind: 'reconstruct', x: 380, y: 120 },
    { id: 'n-scene', kind: 'scene', x: 760, y: 200 },
    { id: 'n-anim', kind: 'animation', x: 1140, y: 200 },
    { id: 'n-ads', kind: 'ad-variants', x: 1520, y: 280, settings: { aspect } },
    { id: 'n-review', kind: 'review', x: 1900, y: 280 },
    { id: 'n-export', kind: 'export', x: 2280, y: 280 },
  ],
  edges: [
    ['n-ref', 'image', 'n-model', 'image'],
    ['n-model', 'model', 'n-scene', 'model'],
    ['n-brief', 'brief', 'n-scene', 'brief'],
    ['n-scene', 'scene', 'n-anim', 'scene'],
    ['n-anim', 'clip', 'n-ads', 'clip'],
    ['n-brief', 'brief', 'n-ads', 'brief'],
    ['n-ads', 'variants', 'n-review', 'variants'],
    ['n-review', 'approval', 'n-export', 'approval'],
  ],
});

const STILL_FLOW: { nodes: TemplateNodePreset[]; edges: Template['edges'] } = {
  nodes: [
    { id: 'n-ref', kind: 'reference', x: 0, y: 120 },
    { id: 'n-brief', kind: 'brief', x: 0, y: 360 },
    { id: 'n-model', kind: 'reconstruct', x: 380, y: 120 },
    { id: 'n-scene', kind: 'scene', x: 760, y: 200 },
    { id: 'n-review', kind: 'review', x: 1140, y: 200 },
  ],
  edges: [
    ['n-ref', 'image', 'n-model', 'image'],
    ['n-model', 'model', 'n-scene', 'model'],
    ['n-brief', 'brief', 'n-scene', 'brief'],
  ],
};

export const TEMPLATES: Template[] = [
  {
    slug: 'turntable-hero-skincare',
    name: 'Turntable hero',
    category: 'Hero & launch',
    tags: ['skincare', 'launch', 'turntable', 'product page'],
    outcome: 'A clean 360° turntable of the product for a launch page or paid social.',
    suitableFor: 'Beauty and skincare brands introducing a new SKU.',
    requiredInput: [
      'One front-facing product image (PNG/JPG, max 12 MB)',
      'Product name and one-line description',
    ],
    deliverable: ['6 s turntable clip (1:1, 4:5)', 'Hero still', 'Editable scene data'],
    limits: [
      'Demo builds a labelled fixture model, not a reconstruction of your image',
      'Single product per scene',
    ],
    fixtureId: 'serum-bottle',
    aspects: ['1:1', '4:5'],
    sampleCredits: 7,
    sampleDurationSec: 6,
    scene: { background: 'studio-white', light: 'studio-soft', animation: 'turntable', durationSec: 6 },
    ad: {
      headline: 'Meet the new formula',
      subheadline: 'Clinically light. Visibly brighter.',
      cta: 'Shop now',
      layout: 'text-left',
      brandColor: '#2457d6',
    },
    ...FULL_FLOW('1:1'),
    poster: 'turntable-hero-skincare.png',
  },
  {
    slug: 'feature-callouts-headphones',
    name: 'Feature callouts',
    category: 'Feature callouts',
    tags: ['electronics', 'features', 'orbit', 'headphones'],
    outcome: 'An orbit sweep that pauses on three product features with short captions.',
    suitableFor: 'Electronics and hardware teams explaining what makes a product different.',
    requiredInput: ['Product image', 'Three feature statements'],
    deliverable: ['8 s orbit clip (1:1, 9:16)', 'Three feature stills'],
    limits: ['Captions are composed from the brief; the demo does not read product specs from the image'],
    fixtureId: 'headphones',
    aspects: ['1:1', '9:16'],
    sampleCredits: 7,
    sampleDurationSec: 8,
    scene: {
      background: 'cool-gray',
      light: 'dramatic',
      animation: 'orbit-sweep',
      durationSec: 8,
      materialColor: '#5b7cff',
    },
    ad: {
      headline: 'Hear every layer',
      subheadline: '40 h battery. Adaptive noise control.',
      cta: 'Pre-order',
      layout: 'text-bottom',
      brandColor: '#17191d',
    },
    ...FULL_FLOW('9:16'),
    poster: 'feature-callouts-headphones.png',
  },
  {
    slug: 'lifestyle-spin-appliance',
    name: 'Lifestyle spin',
    category: 'Hero & launch',
    tags: ['home', 'appliance', 'lifestyle', 'dolly'],
    outcome: 'A slow dolly-in on the product against a warm studio backdrop.',
    suitableFor: 'Home and appliance brands that want a calm, premium feel.',
    requiredInput: ['Product image', 'Campaign key message'],
    deliverable: ['6 s dolly clip (4:5)', 'Still'],
    limits: ['One backdrop preset per run'],
    fixtureId: 'smart-speaker',
    aspects: ['4:5', '1:1'],
    sampleCredits: 7,
    sampleDurationSec: 6,
    scene: { background: 'brand', light: 'daylight', animation: 'dolly-in', durationSec: 6 },
    ad: {
      headline: 'Sound that fills the room',
      subheadline: 'Room-adaptive audio, one tap setup.',
      cta: 'Learn more',
      layout: 'centered',
      brandColor: '#7a8290',
    },
    ...FULL_FLOW('4:5'),
    poster: 'lifestyle-spin-appliance.png',
  },
  {
    slug: 'social-teaser-9-16',
    name: 'Social teaser 9:16',
    category: 'Social',
    tags: ['stories', 'reels', 'vertical', 'teaser'],
    outcome: 'A vertical teaser with a bold headline and a single CTA.',
    suitableFor: 'Performance marketers testing vertical creatives.',
    requiredInput: ['Product image', 'Headline and CTA'],
    deliverable: ['6 s vertical clip (9:16)', 'Vertical still'],
    limits: ['Text safe-areas follow common platform guides; verify per platform'],
    fixtureId: 'serum-bottle',
    aspects: ['9:16'],
    sampleCredits: 7,
    sampleDurationSec: 6,
    scene: {
      background: 'charcoal',
      light: 'dramatic',
      animation: 'turntable',
      durationSec: 6,
      materialColor: '#e3b8c9',
    },
    ad: {
      headline: 'Glow, bottled',
      subheadline: 'New. Limited run.',
      cta: 'Get yours',
      layout: 'text-bottom',
      brandColor: '#b45f9a',
    },
    ...FULL_FLOW('9:16'),
    poster: 'social-teaser-9-16.png',
  },
  {
    slug: 'color-variants-carousel',
    name: 'Colour variants',
    category: 'Catalog',
    tags: ['variants', 'colorways', 'carousel', 'catalog'],
    outcome: 'The same scene rendered in each colourway for a catalog carousel.',
    suitableFor: 'Brands with multiple colourways of one product.',
    requiredInput: ['Product image', 'Colour list'],
    deliverable: ['One still per colourway (1:1)', 'Editable scene data'],
    limits: ['Demo applies the colour to the primary part only'],
    fixtureId: 'headphones',
    aspects: ['1:1'],
    sampleCredits: 4,
    sampleDurationSec: 0,
    scene: { background: 'studio-white', light: 'studio-soft', animation: 'turntable', durationSec: 4 },
    ad: {
      headline: 'Pick your colour',
      subheadline: 'Five finishes, one sound.',
      cta: 'Shop colours',
      layout: 'text-left',
      brandColor: '#2457d6',
    },
    ...STILL_FLOW,
    poster: 'color-variants-carousel.png',
  },
  {
    slug: 'scale-and-dimensions',
    name: 'Scale & dimensions',
    category: 'Feature callouts',
    tags: ['dimensions', 'size', 'catalog', 'trust'],
    outcome: 'A top and front view with measured dimensions overlaid.',
    suitableFor: 'Marketplaces and appliance sellers reducing size-related returns.',
    requiredInput: ['Product image', 'Known dimensions'],
    deliverable: ['Front and top stills (1:1)'],
    limits: ['Dimensions come from your input; the demo does not measure the image'],
    fixtureId: 'smart-speaker',
    aspects: ['1:1', '4:5'],
    sampleCredits: 4,
    sampleDurationSec: 0,
    scene: { background: 'cool-gray', light: 'daylight', animation: 'turntable', durationSec: 4 },
    ad: {
      headline: '14.2 cm tall. Fits anywhere.',
      subheadline: 'Measured at the widest point.',
      cta: 'See specs',
      layout: 'text-bottom',
      brandColor: '#17623b',
    },
    ...STILL_FLOW,
    poster: 'scale-and-dimensions.png',
  },
  {
    slug: 'before-after-comparison',
    name: 'Comparison split',
    category: 'Comparison',
    tags: ['comparison', 'split', 'upgrade'],
    outcome: 'A split composition contrasting two scene finishes of the same product.',
    suitableFor: 'Teams choosing between two creative directions.',
    requiredInput: ['Product image', 'Two finishes or backgrounds'],
    deliverable: ['Split still (1:1)', 'Two scene revisions for review'],
    limits: ['Two directions per run'],
    fixtureId: 'serum-bottle',
    aspects: ['1:1'],
    sampleCredits: 5,
    sampleDurationSec: 0,
    scene: { background: 'studio-white', light: 'studio-soft', animation: 'turntable', durationSec: 4 },
    ad: {
      headline: 'Matte or gloss?',
      subheadline: 'Same formula, two finishes.',
      cta: 'Vote',
      layout: 'centered',
      brandColor: '#2457d6',
    },
    ...STILL_FLOW,
    poster: 'before-after-comparison.png',
  },
  {
    slug: 'unboxing-reveal',
    name: 'Unboxing reveal',
    category: 'Social',
    tags: ['reveal', 'launch', 'social'],
    outcome: 'A dolly-in reveal from a dark backdrop into full studio light.',
    suitableFor: 'Launch-day social posts.',
    requiredInput: ['Product image', 'Launch line'],
    deliverable: ['6 s reveal clip (1:1, 9:16)'],
    limits: ['Light ramp is a preset; custom keyframes are not in the demo'],
    fixtureId: 'headphones',
    aspects: ['1:1', '9:16'],
    sampleCredits: 7,
    sampleDurationSec: 6,
    scene: {
      background: 'charcoal',
      light: 'dramatic',
      animation: 'dolly-in',
      durationSec: 6,
      materialColor: '#c2c7cf',
    },
    ad: {
      headline: 'It’s here.',
      subheadline: 'Launching today.',
      cta: 'Order now',
      layout: 'centered',
      brandColor: '#17191d',
    },
    ...FULL_FLOW('1:1'),
    poster: 'unboxing-reveal.png',
  },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Hero & launch',
  'Feature callouts',
  'Social',
  'Catalog',
  'Comparison',
];

export function findTemplate(slug: string | undefined): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export function searchTemplates(query: string, category?: TemplateCategory | 'all'): Template[] {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) => {
    if (category && category !== 'all' && t.category !== category) return false;
    if (!q) return true;
    return [t.name, t.outcome, t.suitableFor, t.category, ...t.tags].join(' ').toLowerCase().includes(q);
  });
}
