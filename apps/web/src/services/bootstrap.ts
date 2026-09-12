import type { PlatformServices } from '@3dads/contracts';

export type ServicesMode = 'demo' | 'live';

export function resolveMode(): ServicesMode {
  const m = import.meta.env.VITE_SERVICES_MODE as string | undefined;
  return m === 'live' ? 'live' : 'demo';
}

/**
 * Explicit adapter selection. The demo adapter is only ever chosen here, never as a fallback
 * when the live adapter fails.
 */
export async function createServices(mode: ServicesMode): Promise<PlatformServices> {
  if (mode === 'live') {
    const { createLiveServices } = await import('./live/services');
    return createLiveServices();
  }
  const { createMockServices } = await import('./mock/services');
  return createMockServices({ sampleMp4Url: `${import.meta.env.BASE_URL}fixtures/sample-render.mp4` });
}
