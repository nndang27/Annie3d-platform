import { Color } from 'three';

export type BackgroundPreset = 'studio-white' | 'cool-gray' | 'charcoal' | 'brand';
export type LightPreset = 'studio-soft' | 'dramatic' | 'daylight';
export type CameraPreset = 'three-quarter' | 'front' | 'top' | 'detail';
export type AnimationPreset = 'turntable' | 'orbit-sweep' | 'dolly-in';

export function backgroundColor(preset: BackgroundPreset, brandColor: string): Color {
  switch (preset) {
    case 'studio-white':
      return new Color('#f7f8fa');
    case 'cool-gray':
      return new Color('#dfe3e9');
    case 'charcoal':
      return new Color('#363a42');
    case 'brand': {
      const c = new Color(brandColor);
      // soft tint: mix 82% white
      return c.lerp(new Color('#ffffff'), 0.82);
    }
  }
}

export interface LightSetup {
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  keyIntensity: number;
  keyPosition: [number, number, number];
  fillIntensity: number;
  fillPosition: [number, number, number];
  rimIntensity: number;
  rimPosition: [number, number, number];
  envIntensity: number;
  shadowOpacity: number;
}

export const LIGHTS: Record<LightPreset, LightSetup> = {
  'studio-soft': {
    hemiSky: '#ffffff',
    hemiGround: '#cfd4dc',
    hemiIntensity: 1.1,
    keyIntensity: 2.2,
    keyPosition: [2.5, 4, 2.5],
    fillIntensity: 0.9,
    fillPosition: [-3, 2, 2],
    rimIntensity: 0.8,
    rimPosition: [0, 3, -4],
    envIntensity: 0.9,
    shadowOpacity: 0.22,
  },
  dramatic: {
    hemiSky: '#b9c1cc',
    hemiGround: '#2a2d33',
    hemiIntensity: 0.55,
    keyIntensity: 3.6,
    keyPosition: [3.5, 3, 1],
    fillIntensity: 0.25,
    fillPosition: [-3, 1, 2],
    rimIntensity: 3.4,
    rimPosition: [-1, 3, -4],
    envIntensity: 0.7,
    shadowOpacity: 0.4,
  },
  daylight: {
    hemiSky: '#dfe9ff',
    hemiGround: '#e6dccd',
    hemiIntensity: 1.4,
    keyIntensity: 2.8,
    keyPosition: [-2, 5, 3],
    fillIntensity: 0.6,
    fillPosition: [3, 2, 2],
    rimIntensity: 0.4,
    rimPosition: [0, 2, -4],
    envIntensity: 1.1,
    shadowOpacity: 0.3,
  },
};

/** Camera preset: spherical azimuth (deg), elevation (deg), distance multiplier relative to fit distance. */
export const CAMERAS: Record<
  CameraPreset,
  { azimuth: number; elevation: number; distance: number; targetY: number }
> = {
  'three-quarter': { azimuth: 35, elevation: 18, distance: 1, targetY: 0.5 },
  front: { azimuth: 0, elevation: 6, distance: 1, targetY: 0.5 },
  top: { azimuth: 20, elevation: 72, distance: 1.05, targetY: 0.35 },
  detail: { azimuth: 55, elevation: 12, distance: 0.55, targetY: 0.62 },
};
