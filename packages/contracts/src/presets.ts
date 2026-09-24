/** Look presets for the Stage node. Kits are curated assets (docs/MVP_VERTICAL_WORKFLOWS.md §8). */
export const LOOK_PRESETS = [
  { id: 'studio-light', label: 'Studio light', vertical: 'any' },
  { id: 'dark-lab', label: 'Dark lab', vertical: 'electronics' },
  { id: 'stone-water', label: 'Stone & water', vertical: 'jewelry' },
  { id: 'velvet', label: 'Velvet', vertical: 'jewelry' },
  { id: 'splash-pastel', label: 'Splash, pastel', vertical: 'beauty' },
  { id: 'podium-botanical', label: 'Podium & botanicals', vertical: 'beauty' },
] as const;
export type LookPresetId = (typeof LOOK_PRESETS)[number]['id'];

/** Motion presets for the Ad video node. */
export const MOTION_PRESETS = [
  { id: 'turntable', label: 'Turntable', vertical: 'any' },
  { id: 'hero-orbit', label: 'Hero orbit', vertical: 'any' },
  { id: 'teardown-reveal', label: 'Teardown reveal', vertical: 'electronics' },
  { id: 'stone-water', label: 'Stone & water', vertical: 'jewelry' },
  { id: 'splash-hero', label: 'Splash hero', vertical: 'beauty' },
] as const;
export type MotionPresetId = (typeof MOTION_PRESETS)[number]['id'];

export const ASPECTS = ['1:1', '4:5', '9:16', '16:9'] as const;
export type Aspect = (typeof ASPECTS)[number];

/**
 * GLB export presets with hard limits.
 * Google Swirl: DV360 "Guidelines for 3D Swirl creatives" (GLB only, ≤ 3 MB, 30k–40k polygons,
 * animated). Google Merchant: Merchant Center `virtual_model_link` (glTF/GLB, recommended 10 MB,
 * max 15 MB). Web: our own budget for the share viewer and Shopify-style product pages.
 */
export const GLB_PRESETS = {
  web: {
    label: 'Web / store',
    maxBytes: 10 * 1024 * 1024,
    maxTriangles: 150_000,
    maxTexture: 2048,
    requiresAnimation: false,
  },
  google_merchant: {
    label: 'Google Merchant',
    maxBytes: 15 * 1024 * 1024,
    maxTriangles: 500_000,
    maxTexture: 4096,
    requiresAnimation: false,
  },
  google_swirl: {
    label: 'Google Swirl',
    maxBytes: 3 * 1024 * 1024,
    maxTriangles: 40_000,
    maxTexture: 2048,
    requiresAnimation: true,
  },
} as const;
export type GlbPresetId = keyof typeof GLB_PRESETS;
