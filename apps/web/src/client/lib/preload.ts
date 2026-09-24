import { type ComponentType, createElement, lazy, useState } from 'react';

/**
 * Heavy overlays (the 3D editor and the simulator ship three.js, ~700 KB) load on demand, and
 * start loading on intent: hovering a node that opens one (Remix `prefetch="intent"`, Next.js
 * prefetch on hover). Each chunk is imported once; a failed load is forgotten so a click retries.
 *
 * `React.lazy` suspends on its first render even when the module has already loaded, and React
 * then holds the fallback for its throttle window (FALLBACK_THROTTLE_MS, ~300 ms): measured click
 * → editor constructor 322 ms on the first open vs 20 ms later. So once the module is in, the
 * overlay renders it directly (the react-lazy-with-preload pattern). The choice is fixed when the
 * overlay mounts, so it never remounts (a remount would recreate the WebGL context).
 */
function preloadable<P extends object>(importer: () => Promise<{ default: ComponentType<P> }>) {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  let loaded: ComponentType<P> | null = null;
  const load = () => {
    pending ??= importer().then(
      (m) => {
        loaded = m.default;
        return m;
      },
      (e) => {
        pending = null;
        throw e;
      },
    );
    return pending;
  };
  const Lazy = lazy(load);
  function Component(props: P) {
    const [Resolved] = useState<ComponentType<P>>(() => loaded ?? Lazy);
    return createElement(Resolved, props);
  }
  return { load, Component };
}

export const editorOverlay = preloadable(() => import('../editor/EditorOverlay'));
export const simulatorOverlay = preloadable(() => import('../sim/SimulatorOverlay'));

const fetched = new Set<string>();
/** Warms the HTTP cache for an immutable asset; the 3D loaders then fetch the same URL. */
export function prefetchAsset(url: string | null | undefined) {
  if (!url || fetched.has(url)) return;
  fetched.add(url);
  fetch(url, { priority: 'low' } as RequestInit)
    .then((r) => r.arrayBuffer())
    .catch(() => fetched.delete(url));
}

/**
 * Opening a 3D model is the board's main action, so once the board is ready and the browser is
 * idle, load the editor (and three.js) at low priority when the board has a model to open: over
 * a 10 Mbps link the ~700 KB chunk otherwise took ~450 ms on the first open. Skipped when the
 * user asked the browser to save data.
 */
export function preloadEditorWhenIdle(hasModel: () => boolean) {
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  const run = () => {
    if (hasModel()) void editorOverlay.load();
  };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 2000);
}
