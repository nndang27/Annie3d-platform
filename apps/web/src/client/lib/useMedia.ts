import { useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query (React's external-store hook, so every component reads the
 * same value in the same render and there is no resize listener per component).
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
