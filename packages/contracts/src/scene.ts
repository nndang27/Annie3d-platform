import type { AspectRatio } from './identity';

export type ProductFixtureId = 'serum-bottle' | 'headphones' | 'smart-speaker';

export interface ProductFixtureMeta {
  id: ProductFixtureId;
  name: string;
  category: string;
  /** Recorded after build by packages/viewer-3d/scripts/report-fixtures.mjs */
  approxTriangles: number;
  parts: { id: string; label: string }[];
  /** Part that receives the brand/material colour. */
  primaryPart: string;
  defaultColor: string;
}

export type BackgroundPreset = 'studio-white' | 'cool-gray' | 'charcoal' | 'brand';
export type LightPreset = 'studio-soft' | 'dramatic' | 'daylight';
export type CameraPreset = 'three-quarter' | 'front' | 'top' | 'detail';
export type MaterialFinish = 'matte' | 'satin' | 'gloss';
export type AnimationPreset = 'turntable' | 'orbit-sweep' | 'dolly-in';
export type AdLayout = 'text-left' | 'text-bottom' | 'centered';

export interface SceneDoc {
  fixtureId: ProductFixtureId;
  background: BackgroundPreset;
  materialColor: string;
  finish: MaterialFinish;
  light: LightPreset;
  cameraPreset: CameraPreset;
  placement: { x: number; y: number; rotationY: number; scale: number };
  animation: { preset: AnimationPreset; durationSec: number };
}

export interface AdComposition {
  headline: string;
  subheadline: string;
  cta: string;
  brandColor: string;
  layout: AdLayout;
  aspect: AspectRatio;
}

export interface SceneRevision {
  revision: number;
  scene: SceneDoc;
  ad: AdComposition;
  savedAt: number;
  /** Where this revision came from. */
  source: 'template' | 'run' | 'manual' | 'composer';
  note?: string;
}

export const DEFAULT_AD: AdComposition = {
  headline: 'Meet the new formula',
  subheadline: 'Clinically light. Visibly brighter.',
  cta: 'Shop now',
  brandColor: '#2457d6',
  layout: 'text-left',
  aspect: '1:1',
};

export function defaultScene(fixtureId: ProductFixtureId, color: string): SceneDoc {
  return {
    fixtureId,
    background: 'studio-white',
    materialColor: color,
    finish: 'satin',
    light: 'studio-soft',
    cameraPreset: 'three-quarter',
    placement: { x: 0, y: 0, rotationY: 0, scale: 1 },
    animation: { preset: 'turntable', durationSec: 6 },
  };
}
