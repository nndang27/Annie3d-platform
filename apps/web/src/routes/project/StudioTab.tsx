import { type Artifact, PRODUCT_FIXTURES } from '@3dads/contracts';
import { Badge, Button, cx, Kbd } from '@3dads/ui';
import type { ViewerStats } from '@3dads/viewer-3d';
import { Download, Redo2, Undo2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FixtureThumb } from '@/components/FixtureThumb';
import { ExportDialog } from '@/components/studio/ExportDialog';
import { SceneControls } from '@/components/studio/SceneControls';
import { Timeline } from '@/components/studio/Timeline';
import { type ViewerHandle, ViewerPanel } from '@/components/studio/ViewerPanel';
import { useServices } from '@/services/context';
import { useInvalidate } from '@/services/queries';
import { selectAd, selectScene, useSceneStore } from '@/stores/sceneStore';
import { useProjectContext } from './context';

interface Props {
  exportPreset: string | null;
  onExportPresetHandled: () => void;
  saveScene: (source?: 'manual' | 'composer', note?: string) => Promise<void>;
}

export const StudioTab = forwardRef<{ play(): void; pause(): void }, Props>(function StudioTab(
  { exportPreset, onExportPresetHandled, saveScene },
  ref,
) {
  const { project, artifacts, canEdit } = useProjectContext();
  const services = useServices();
  const inv = useInvalidate();
  const scene = useSceneStore(selectScene);
  const ad = useSceneStore(selectAd);
  const canUndo = useSceneStore((s) => s.history.past.length > 0);
  const canRedo = useSceneStore((s) => s.history.future.length > 0);
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const viewer = useRef<ViewerHandle>(null);
  const timeSource = useRef({ t: 0, playing: false });
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const statsThrottle = useRef(0);

  useImperativeHandle(
    ref,
    () => ({ play: () => viewer.current?.play(), pause: () => viewer.current?.pause() }),
    [],
  );
  useEffect(() => {
    if (exportPreset) {
      setExportOpen(true);
    }
  }, [exportPreset]);

  // Keyboard shortcuts scoped to the studio: space play/pause, ⌘/Ctrl+Z undo, ⇧⌘Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === ' ' && !typing && target.tagName !== 'BUTTON') {
        e.preventDefault();
        if (viewer.current?.isPlaying()) viewer.current.pause();
        else viewer.current?.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const variants = useMemo(
    () =>
      artifacts
        .filter((a) => a.kind === 'ad-variant' && !a.supersededBy)
        .sort((a, b) => b.createdAt - a.createdAt),
    [artifacts],
  );
  const selectedArtifact = artifacts.find((a) => a.id === project.selectedArtifactId) ?? variants[0];
  const fixture = PRODUCT_FIXTURES[scene.fixtureId];

  if (!scene || !ad) return null;
  return (
    <div className="studio" data-testid="studio">
      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <div className="stage-wrap">
          <ViewerPanel
            ref={viewer}
            scene={scene}
            ad={ad}
            onSelectPart={setSelectedPart}
            onTime={(t, playing) => {
              timeSource.current = { t, playing };
            }}
            onStats={(s) => {
              const now = performance.now();
              if (now - statsThrottle.current > 500) {
                statsThrottle.current = now;
                setStats({ ...s });
              }
            }}
          />
        </div>
        <Timeline viewer={viewer} scene={scene} readOnly={!canEdit} timeSource={timeSource} />
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Button
            size="sm"
            variant="tertiary"
            onClick={undo}
            disabledReason={canUndo ? undefined : 'Nothing to undo.'}
            data-testid="scene-undo"
          >
            <Undo2 size={14} aria-hidden="true" /> Undo
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onClick={redo}
            disabledReason={canRedo ? undefined : 'Nothing to redo.'}
            data-testid="scene-redo"
          >
            <Redo2 size={14} aria-hidden="true" /> Redo
          </Button>
          <span>
            <Kbd>Space</Kbd> play · <Kbd>⌘Z</Kbd> undo
          </span>
          {stats ? (
            <span
              className="numeric"
              style={{ marginLeft: 'auto' }}
              data-testid="viewer-stats"
              data-idle={stats.idle}
              data-frames={stats.framesRendered}
            >
              {fixture.name} · {stats.triangles.toLocaleString()} tris · {stats.drawCalls} draws · DPR{' '}
              {stats.dpr} · {stats.idle ? 'idle' : 'rendering'}
            </span>
          ) : null}
        </div>
        <section aria-label="Variants and versions" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Output versions</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {variants.length
                ? 'Click a version to load its scene and composition into the studio.'
                : 'Run the workflow to create versions.'}
            </span>
          </div>
          {variants.length ? (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {variants.map((a) => (
                <VariantChip
                  key={a.id}
                  artifact={a}
                  selected={selectedArtifact?.id === a.id}
                  onSelect={() => {
                    if (a.scene && a.ad) useSceneStore.getState().edit({ scene: a.scene, ad: a.ad });
                    if (canEdit)
                      void services.projects
                        .selectArtifact(project.id, a.id)
                        .then(() => inv.project(project.id));
                  }}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
      <aside
        className="card card-pad"
        style={{ display: 'grid', gap: 12, alignContent: 'start', position: 'sticky', top: 76 }}
        aria-label="Scene and ad controls"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge>{fixture.name}</Badge>
          {project.reference.source === 'upload' ? (
            <Badge tone="warning">Demo fixture, not your image</Badge>
          ) : null}
        </div>
        <SceneControls scene={scene} ad={ad} readOnly={!canEdit} selectedPart={selectedPart} />
        <Button variant="primary" onClick={() => setExportOpen(true)} data-testid="open-export">
          <Download size={16} aria-hidden="true" /> Export
        </Button>
      </aside>
      <ExportDialog
        open={exportOpen}
        onClose={() => {
          setExportOpen(false);
          onExportPresetHandled();
        }}
        viewer={viewer}
        initialPreset={exportPreset}
        sourceArtifact={selectedArtifact}
        saveScene={() => saveScene()}
      />
    </div>
  );
});

function VariantChip({
  artifact,
  selected,
  onSelect,
}: {
  artifact: Artifact;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx('card')}
      style={{
        padding: 6,
        minWidth: 150,
        textAlign: 'left',
        borderColor: selected ? 'var(--accent)' : undefined,
        cursor: 'pointer',
      }}
      data-testid="variant-chip"
    >
      <div className="thumb" style={{ aspectRatio: '4/3', width: 138 }}>
        <FixtureThumb
          fixtureId={
            (artifact.preview.kind === 'fixture'
              ? artifact.preview.fixtureId
              : 'serum-bottle') as 'serum-bottle'
          }
          alt=""
        />
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          marginTop: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {artifact.title}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{artifact.acceptance}</div>
    </button>
  );
}
