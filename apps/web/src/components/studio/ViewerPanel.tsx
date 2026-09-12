import type { AdComposition, SceneDoc } from '@3dads/contracts';
import { aspectToNumber } from '@3dads/contracts';
import { Button, useReducedMotion } from '@3dads/ui';
import { contrastOn, isWebGLAvailable, type ProductViewer, type ViewerStats } from '@3dads/viewer-3d';
import { Crosshair, Maximize, RotateCcw } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FixtureThumb } from '@/components/FixtureThumb';

export interface ViewerHandle {
  viewer(): ProductViewer | null;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  isPlaying(): boolean;
  time(): number;
}

interface Props {
  scene: SceneDoc;
  ad: AdComposition;
  onSelectPart?: (id: string | null) => void;
  onStats?: (s: ViewerStats) => void;
  onTime?: (t: number, playing: boolean) => void;
  showOverlay?: boolean;
}

/**
 * React boundary around the imperative viewer. Props are diffed into viewer methods; nothing
 * per-frame touches React state. A remount (StrictMode double-invoke included) disposes cleanly.
 */
export const ViewerPanel = forwardRef<ViewerHandle, Props>(function ViewerPanel(
  { scene, ad, onSelectPart, onStats, onTime, showOverlay = true },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<ProductViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'lost'>('loading');
  const reduced = useReducedMotion();
  const cbs = useRef({ onSelectPart, onStats, onTime });
  cbs.current = { onSelectPart, onStats, onTime };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!isWebGLAvailable()) {
      setStatus('unsupported');
      return;
    }
    let disposed = false;
    let viewer: ProductViewer | null = null;
    performance.mark('viewer:import-start');
    const dev = (window as unknown as { __3dads?: { viewers: Set<unknown>; viewerLog?: unknown[] } }).__3dads;
    if (dev && !dev.viewerLog) dev.viewerLog = [];
    dev?.viewerLog?.push({ event: 'mount', t: performance.now() });
    void import('@3dads/viewer-3d')
      .then(({ ProductViewer }) => {
        if (disposed) {
          dev?.viewerLog?.push({ event: 'import-after-dispose', t: performance.now() });
          return;
        }
        performance.mark('viewer:import-end');
        viewer = new ProductViewer(canvas, {
          dprCap: 2,
          reducedMotion: reduced,
          onSelect: (id) => cbs.current.onSelectPart?.(id),
          onStats: (s) => cbs.current.onStats?.(s),
          onTime: (t, p) => cbs.current.onTime?.(t, p),
          onContextLost: () => setStatus('lost'),
          onContextRestored: () => setStatus('ready'),
        });
        viewerRef.current = viewer;
        (window as unknown as { __3dads?: { viewers: Set<unknown> } }).__3dads?.viewers.add(viewer);
        viewer.setScene({ ...scene, brandColor: ad.brandColor });
        performance.mark('viewer:first-scene');
        performance.measure('viewer:import', 'viewer:import-start', 'viewer:import-end');
        performance.measure('viewer:first-useful-frame', 'viewer:import-start', 'viewer:first-scene');
        setStatus('ready');
        dev?.viewerLog?.push({ event: 'ready', t: performance.now() });
      })
      .catch((e: Error) => {
        dev?.viewerLog?.push({ event: 'error', message: e.message, t: performance.now() });
        console.error('viewer init failed', e);
        setStatus('unsupported');
      });
    return () => {
      disposed = true;
      dev?.viewerLog?.push({ event: 'cleanup', t: performance.now(), hadViewer: !!viewer });
      if (viewer) {
        (window as unknown as { __3dads?: { viewers: Set<unknown> } }).__3dads?.viewers.delete(viewer);
        viewer.dispose();
      }
      viewerRef.current = null;
    };
    // Mount-only: the viewer is created once per canvas; props are diffed into it by the effect below.
  }, []);

  useEffect(() => {
    viewerRef.current?.setScene({ ...scene, brandColor: ad.brandColor });
  }, [scene, ad.brandColor]);

  useImperativeHandle(
    ref,
    () => ({
      viewer: () => viewerRef.current,
      play: () => viewerRef.current?.play(),
      pause: () => viewerRef.current?.pause(),
      seek: (s) => viewerRef.current?.seek(s),
      isPlaying: () => viewerRef.current?.isPlaying() ?? false,
      time: () => viewerRef.current?.time() ?? 0,
    }),
    [],
  );

  const aspect = aspectToNumber(ad.aspect);
  const dark = scene.background === 'charcoal';
  const textColor = dark ? '#ffffff' : '#17191d';
  return (
    <div
      className="stage"
      style={{
        aspectRatio: `${aspect}`,
        containerType: 'inline-size',
        maxWidth: ad.aspect === '9:16' ? 380 : ad.aspect === '4:5' ? 520 : 640,
      }}
      data-testid="stage"
      data-aspect={ad.aspect}
    >
      {status === 'unsupported' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            textAlign: 'center',
          }}
          role="status"
          data-testid="webgl-fallback"
        >
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
            <FixtureThumb fixtureId={scene.fixtureId} alt={`Static preview of ${scene.fixtureId}`} />
            <strong>3D preview unavailable in this browser</strong>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              WebGL is disabled or unsupported. You can still edit ad text, colours and settings, and export
              scene JSON. Enable hardware acceleration or use a recent Chrome, Safari or Firefox for the
              interactive view.
            </span>
          </div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`Interactive 3D view of ${scene.fixtureId}. Drag to orbit, scroll to zoom, click a part to select it.`}
          tabIndex={0}
          data-testid="viewer-canvas"
        />
      )}
      {status === 'loading' ? (
        <div
          className="skeleton"
          style={{ position: 'absolute', inset: 0 }}
          aria-label="Loading 3D viewer"
          aria-busy="true"
        />
      ) : null}
      {status === 'lost' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.85)',
          }}
          role="alert"
        >
          <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
            <strong>Graphics context was lost</strong>
            <span style={{ fontSize: '0.875rem' }}>
              Your scene and edits are intact. Waiting for the browser to restore the context…
            </span>
          </div>
        </div>
      ) : null}
      {showOverlay ? (
        <div
          className={`ad-overlay layout-${ad.layout}`}
          style={{ color: textColor }}
          aria-hidden="true"
          data-testid="ad-overlay"
        >
          <div className="ad-headline">{ad.headline}</div>
          <div className="ad-sub">{ad.subheadline}</div>
          <div className="ad-cta" style={{ background: ad.brandColor, color: contrastOn(ad.brandColor) }}>
            {ad.cta}
          </div>
        </div>
      ) : null}
      {status === 'ready' ? (
        <div className="stage-toolbar" role="toolbar" aria-label="Camera">
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Reset camera"
            onClick={() => viewerRef.current?.resetCamera()}
            data-testid="reset-camera"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Fit to object"
            onClick={() => viewerRef.current?.fitToObject()}
            data-testid="fit-object"
          >
            <Maximize size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label="Clear selection"
            onClick={() => viewerRef.current?.select(null)}
          >
            <Crosshair size={16} aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
});
