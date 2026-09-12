import { type PlatformServices, ServiceError } from '@3dads/contracts';

/**
 * Placeholder for the future harness-backed adapter (see docs/HARNESS_INTEGRATION_CONTRACT.md).
 * It is never selected implicitly: if VITE_SERVICES_MODE=live is set without an implementation,
 * the app shows a configuration error instead of silently falling back to the demo.
 */
export function createLiveServices(): PlatformServices {
  const notConfigured = () => {
    throw new ServiceError(
      'not_configured',
      'Live services are not configured in this build. Set VITE_SERVICES_MODE=demo or provide a live adapter.',
    );
  };
  const fail = new Proxy({}, { get: () => notConfigured }) as never;
  return {
    mode: 'live',
    session: fail,
    projects: fail,
    workflows: fail,
    runs: fail,
    artifacts: fail,
    exports: fail,
    billing: fail,
    workspace: fail,
    connectivity: {
      subscribe: () => () => {},
      state: () => 'offline',
      reconnect: async () => notConfigured(),
    },
  };
}
