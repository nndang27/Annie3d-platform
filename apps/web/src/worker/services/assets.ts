import type { AssetDto } from '@annie3d/contracts';
import type { assets, assetVariants } from '@annie3d/db';
import type { Env } from '../env';

type AssetRow = typeof assets.$inferSelect;
type VariantRow = typeof assetVariants.$inferSelect;

/**
 * Asset URLs are stable Worker routes, not presigned URLs: content is immutable (addressed by
 * id), so browsers can cache forever (`immutable`) and the canvas never re-downloads posters
 * when a snapshot is refetched.
 */
export function assetDto(env: Env, a: AssetRow, variants: VariantRow[] = [], base = '/api/assets'): AssetDto {
  const url = (variant?: string) =>
    `${env.APP_URL}${base}/${a.id}/content${variant ? `?variant=${variant}` : ''}`;
  const has = (v: string) => variants.some((x) => x.assetId === a.id && x.variant === v);
  return {
    id: a.id,
    kind: a.kind as AssetDto['kind'],
    mime: a.mime,
    byteSize: a.byteSize,
    sha256: a.sha256,
    width: a.width,
    height: a.height,
    durationMs: a.durationMs,
    triangleCount: a.triangleCount,
    status: a.status as AssetDto['status'],
    urls: {
      original: a.status === 'ready' ? url() : null,
      poster: has('poster_1024')
        ? url('poster_1024')
        : a.kind === 'image' && a.status === 'ready'
          ? url()
          : null,
      thumb: has('thumb_256')
        ? url('thumb_256')
        : has('poster_1024')
          ? url('poster_1024')
          : a.kind === 'image' && a.status === 'ready'
            ? url()
            : null,
      turntable: has('turntable_mp4') ? url('turntable_mp4') : null,
    },
    createdAt: a.createdAt.toISOString(),
  };
}

export function bucketOf(env: Env, bucket: string): R2Bucket {
  if (bucket === 'uploads') return env.UPLOADS;
  if (bucket === 'artifacts') return env.ARTIFACTS;
  return env.PUBLIC;
}
