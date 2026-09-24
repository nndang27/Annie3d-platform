/**
 * Fixture pack used by the example board (F1) and the run simulator (P5).
 * Files live in the PUBLIC bucket at fixtures/<version>/<product>/<file> (see upload.mjs).
 */
import manifest from './out/manifest.json' with { type: 'json' };

export const FIXTURE_VERSION = 'v1';
export type FixtureProduct = 'serum' | 'headphones' | 'ring';
export const FIXTURE_FOR_STARTER = {
  'splash-hero': 'serum',
  'teardown-reveal': 'headphones',
  'stone-water': 'ring',
} as const;
export const FIXTURE_MANIFEST = manifest as {
  version: number;
  products: Record<
    FixtureProduct,
    {
      vertical: string;
      triangles: number;
      headline: string;
      files: Record<string, { bytes: number; sha256: string }>;
    }
  >;
};

export interface FixtureAsset {
  id: string;
  kind: 'image' | 'model3d' | 'video' | 'audio';
  mime: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  triangleCount: number | null;
  status: 'ready';
  urls: { original: string | null; poster: string | null; thumb: string | null; turntable: string | null };
  createdAt: string;
  /** Source key inside the PUBLIC bucket. */
  key: string;
}

/** Deterministic UUID (version 8, RFC 9562 custom) from a content hash, so fixture ids are stable. */
export function uuidFromHash(hex: string): string {
  const h = hex.slice(0, 32).split('');
  h[12] = '8';
  h[16] = ((Number.parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const CREATED = '2026-09-24T00:00:00.000Z';
const PACKSHOTS = ['three_quarter', 'front', 'top', 'detail'] as const;

function file(product: FixtureProduct, name: string) {
  const f = FIXTURE_MANIFEST.products[product].files[name];
  if (!f) throw new Error(`fixture ${product}/${name} missing from manifest`);
  return f;
}

export function fixtureAsset(
  base: string,
  product: FixtureProduct,
  name: string,
  kind: FixtureAsset['kind'],
  mime: string,
  extra: Partial<Pick<FixtureAsset, 'width' | 'height' | 'durationMs' | 'triangleCount'>> & {
    poster?: string;
    thumb?: string;
    turntable?: string;
  } = {},
): FixtureAsset {
  const f = file(product, name);
  const url = (n?: string) => (n ? `${base}/api/public/fixtures/${FIXTURE_VERSION}/${product}/${n}` : null);
  return {
    id: uuidFromHash(f.sha256),
    kind,
    mime,
    byteSize: f.bytes,
    sha256: f.sha256,
    width: extra.width ?? null,
    height: extra.height ?? null,
    durationMs: extra.durationMs ?? null,
    triangleCount: extra.triangleCount ?? null,
    status: 'ready',
    urls: {
      original: url(name),
      poster: url(extra.poster),
      thumb: url(extra.thumb),
      turntable: url(extra.turntable),
    },
    createdAt: CREATED,
    key: `fixtures/${FIXTURE_VERSION}/${product}/${name}`,
  };
}

/** The outputs a node of `kind` produces for `product` in the simulator and the example board. */
export function fixtureOutputs(base: string, product: FixtureProduct, kind: string): FixtureAsset[] {
  const tri = FIXTURE_MANIFEST.products[product].triangles;
  switch (kind) {
    case 'photo':
      return [
        fixtureAsset(base, product, 'photo.png', 'image', 'image/png', {
          width: 1024,
          height: 1024,
          poster: 'photo_512.webp',
          thumb: 'photo_thumb_256.webp',
        }),
      ];
    case 'model3d':
    case 'upload3d':
      return [
        fixtureAsset(base, product, 'model.glb', 'model3d', 'model/gltf-binary', {
          triangleCount: tri,
          poster: 'model_poster_1024.webp',
          thumb: 'model_thumb_256.webp',
          turntable: 'turntable.mp4',
        }),
      ];
    case 'packshot':
      return PACKSHOTS.map((p) =>
        fixtureAsset(base, product, `packshot_${p}.png`, 'image', 'image/png', {
          width: 1024,
          height: 1024,
          poster: `packshot_${p}_512.webp`,
          thumb: `packshot_${p}_thumb_256.webp`,
        }),
      );
    case 'stage':
      return [
        fixtureAsset(base, product, 'stage.png', 'image', 'image/png', {
          width: 1024,
          height: 1024,
          poster: 'stage_poster_1024.webp',
          thumb: 'stage_thumb_256.webp',
        }),
      ];
    case 'adVideo':
      return [
        fixtureAsset(base, product, 'ad_9x16.mp4', 'video', 'video/mp4', {
          width: 540,
          height: 960,
          durationMs: 10_000,
          poster: 'ad_poster_540.webp',
        }),
      ];
    case 'audio':
      return [fixtureAsset(base, product, 'music.m4a', 'audio', 'audio/mp4', { durationMs: 10_000 })];
    default:
      return [];
  }
}

/** Every uploadable file with its key and MIME type (used by upload.mjs). */
export function fixtureFiles(product: FixtureProduct): { name: string; key: string }[] {
  return Object.keys(FIXTURE_MANIFEST.products[product].files).map((name) => ({
    name,
    key: `fixtures/${FIXTURE_VERSION}/${product}/${name}`,
  }));
}
