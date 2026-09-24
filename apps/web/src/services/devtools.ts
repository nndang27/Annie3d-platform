import type { PlatformServices } from '@annie3d/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { recentDownloads } from '@/lib/download';
import type { MockServices } from './mock/services';

/**
 * Developer/test surface exposed as window.__annie3d. Documented in docs/MOCK_SCENARIOS.md.
 * Not referenced by product screens.
 */
export function installDevtools(services: PlatformServices, queryClient: QueryClient): void {
  if (services.mode !== 'demo') return;
  const s = services as MockServices;
  const api = {
    mode: s.mode,
    setScenario: (id: Parameters<MockServices['dev']['setScenario']>[0]) => {
      s.dev.setScenario(id);
      queryClient.invalidateQueries();
    },
    setLatencyScale: (n: number) => s.dev.setLatencyScale(n),
    getConfig: () => s.dev.getConfig(),
    reset: async (dataset?: 'small' | 'typical' | 'stress') => {
      await s.dev.reset(dataset);
      queryClient.clear();
    },
    reseed: async (dataset: 'small' | 'typical' | 'stress') => {
      await s.dev.reseed(dataset);
      queryClient.invalidateQueries();
    },
    expireSession: () => s.dev.expireSession(),
    clock: { now: () => s.dev.clock.now(), advance: (ms: number) => s.dev.clock.advance(ms) },
    backend: s.dev.backend,
    queryClient,
    pendingTasks: () => s.dev.backend.scheduler.pending(),
    /** Registry for viewer instances so perf tests can read renderer stats. */
    viewers: new Set<unknown>(),
    /** Downloads started by the app; lets tests read the file where the driver cannot observe downloads (WebKit). */
    downloads: recentDownloads,
    marks: () =>
      performance
        .getEntriesByType('measure')
        .map((m) => ({ name: m.name, duration: m.duration, start: m.startTime })),
  };
  (window as unknown as { __annie3d: typeof api }).__annie3d = api;
}
