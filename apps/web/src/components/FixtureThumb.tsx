import type { ProductFixtureId } from '@annie3d/contracts';

const POSTERS: Record<ProductFixtureId, string> = {
  'serum-bottle': 'serum-bottle.webp',
  headphones: 'headphones.webp',
  'smart-speaker': 'smart-speaker.webp',
};

/** Static WebP poster for a fixture; never a WebGL context (only the Studio owns one). */
export function FixtureThumb({
  fixtureId,
  alt = '',
  className,
  sizes,
}: {
  fixtureId: ProductFixtureId;
  alt?: string;
  className?: string;
  sizes?: string;
}) {
  const src = `${import.meta.env.BASE_URL}fixtures/posters/${POSTERS[fixtureId]}`;
  return (
    <img
      src={src}
      alt={alt}
      width={640}
      height={480}
      loading="lazy"
      decoding="async"
      className={className}
      sizes={sizes}
    />
  );
}
