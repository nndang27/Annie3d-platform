import {
  type Artifact,
  aspectToNumber,
  EXPORT_PRESETS,
  type ExportPresetId,
  newOperationId,
} from '@annie3d/contracts';
import { Badge, Button, Dialog, formatBytes } from '@annie3d/ui';
import { compositeAd } from '@annie3d/viewer-3d';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { downloadBlob } from '@/lib/download';
import { useProjectContext } from '@/routes/project/context';
import { ExportJobRow } from '@/routes/project/OutputsTab';
import { useServices } from '@/services/context';
import { useExports, useInvalidate, useSubscription } from '@/services/queries';
import { useSceneStore } from '@/stores/sceneStore';
import type { ViewerHandle } from './ViewerPanel';

export function ExportDialog({
  open,
  onClose,
  viewer,
  initialPreset,
  sourceArtifact,
  saveScene,
}: {
  open: boolean;
  onClose: () => void;
  viewer: React.RefObject<ViewerHandle | null>;
  initialPreset?: string | null;
  sourceArtifact: Artifact | undefined;
  saveScene: () => Promise<void>;
}) {
  const services = useServices();
  const { project, canEdit } = useProjectContext();
  const inv = useInvalidate();
  const sub = useSubscription();
  const exportsQ = useExports(project.id);
  const [preset, setPreset] = useState<ExportPresetId>('png-snapshot');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<Artifact | null>(null);
  const [opId, setOpId] = useState(() => newOperationId());
  useEffect(() => {
    if (open && initialPreset && EXPORT_PRESETS.some((p) => p.id === initialPreset))
      setPreset(initialPreset as ExportPresetId);
  }, [open, initialPreset]);
  useEffect(() => services.exports.subscribe(() => void inv.exports()), [services, inv]);

  const spec = EXPORT_PRESETS.find((p) => p.id === preset)!;
  const planAllowsMp4 = sub.data ? ['studio', 'team'].includes(sub.data.planId) : true;
  const v = viewer.current?.viewer() ?? null;
  const webglReason =
    spec.mode === 'browser' && spec.id !== 'scene-json' && !v
      ? 'The 3D viewer is not available, so browser renders cannot be produced. Scene JSON export still works.'
      : undefined;
  const queueReason =
    spec.id === 'mp4-render'
      ? !planAllowsMp4
        ? 'MP4 renders need the Studio or Team plan. Upgrade in Settings → Usage & billing.'
        : !sourceArtifact
          ? 'Run the workflow first: queued renders are attached to a produced output.'
          : undefined
      : undefined;
  const disabledReason = !canEdit ? 'Editors only.' : (webglReason ?? queueReason);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await saveScene();
      const { scene, ad } = useSceneStore.getState().history.present;
      const base = {
        projectId: project.id,
        sourceArtifactId: sourceArtifact?.id ?? '',
        preset: spec.id,
        operationId: opId,
        scene,
        ad,
      };
      if (spec.id === 'png-snapshot') {
        setProgress('Rendering frame…');
        const width = 1080;
        const height = Math.round(width / aspectToNumber(ad.aspect));
        const frame = v!.renderToImageData(width, height);
        const canvas = compositeAd({
          frame,
          headline: ad.headline,
          subheadline: ad.subheadline,
          cta: ad.cta,
          brandColor: ad.brandColor,
          layout: ad.layout,
          darkText: scene.background !== 'charcoal',
          label: 'Rendered in browser · Annie 3D demo',
        });
        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'),
        );
        const art = await services.artifacts.storeBrowserExport({
          ...base,
          blob,
          filename: `${project.name}-${ad.aspect}.png`,
        });
        downloadBlob(blob, `${slug(project.name)}-${ad.aspect.replace(':', 'x')}-v${art.revision}.png`);
        setResult(art);
      } else if (spec.id === 'scene-json') {
        const payload = JSON.stringify(
          {
            format: 'annie3d.scene+ad',
            version: 1,
            project: { id: project.id, name: project.name },
            scene,
            ad,
            exportedAt: new Date().toISOString(),
            note: 'Editable scene and composition data from the demo workspace.',
          },
          null,
          2,
        );
        const blob = new Blob([payload], { type: 'application/json' });
        const art = await services.artifacts.storeBrowserExport({
          ...base,
          blob,
          filename: `${project.name}.json`,
        });
        downloadBlob(blob, `${slug(project.name)}-scene-v${art.revision}.json`);
        setResult(art);
      } else if (spec.id === 'webm-preview') {
        if (typeof MediaRecorder === 'undefined')
          throw new Error(
            'This browser cannot record the canvas (MediaRecorder unavailable). Use PNG or scene JSON instead.',
          );
        const durationMs = Math.min(scene.animation.durationSec, 10) * 1000;
        const stream = v!.captureStream(30);
        const mime =
          ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
            MediaRecorder.isTypeSupported(m),
          ) ?? 'video/webm';
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        const done = new Promise<Blob>((res) => {
          rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' }));
        });
        v!.seek(0);
        v!.play();
        rec.start(250);
        const t0 = performance.now();
        await new Promise<void>((res) => {
          const tick = () => {
            const el = performance.now() - t0;
            setProgress(`Recording ${(el / 1000).toFixed(1)} / ${(durationMs / 1000).toFixed(1)} s`);
            if (el >= durationMs) res();
            else window.setTimeout(tick, 100);
          };
          tick();
        });
        rec.stop();
        v!.pause();
        const blob = await done;
        if (blob.size < 1000)
          throw new Error(
            'Recording produced no frames. Keep the tab visible while recording and try again.',
          );
        const art = await services.artifacts.storeBrowserExport({
          ...base,
          blob,
          filename: `${project.name}.webm`,
        });
        downloadBlob(blob, `${slug(project.name)}-preview-v${art.revision}.webm`);
        setResult(art);
      } else {
        setProgress('Queued');
        await services.exports.enqueue({
          projectId: project.id,
          artifactId: sourceArtifact!.id,
          preset: 'mp4-render',
          operationId: opId,
        });
        void inv.exports();
      }
      void inv.artifacts();
      setOpId(newOperationId()); // the next export is a genuinely new operation
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export"
      description="Browser presets render your current scene locally. The MP4 preset simulates a render queue and delivers a labelled sample file."
      locked={busy}
      width={640}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div role="radiogroup" aria-label="Export preset" style={{ display: 'grid', gap: 6 }}>
          {EXPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => setPreset(p.id)}
              className="card"
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                display: 'grid',
                gap: 2,
                borderColor: preset === p.id ? 'var(--accent)' : undefined,
                cursor: 'pointer',
              }}
              data-testid={`preset-${p.id}`}
            >
              <span
                style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.9rem' }}
              >
                {p.title}
                <Badge tone={p.mode === 'browser' ? 'success' : 'warning'}>{p.label}</Badge>
                {p.credits ? <Badge>{p.credits} credit</Badge> : null}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{p.description}</span>
            </button>
          ))}
        </div>
        {disabledReason ? <p className="banner banner-warning">{disabledReason}</p> : null}
        {error ? <ErrorState error={error} compact /> : null}
        {result ? (
          <div className="banner banner-success" role="status" data-testid="export-result">
            <div className="banner-body">
              <div className="banner-title">{result.title} saved and downloaded</div>
              <div>
                {result.mime} · {formatBytes(result.sizeBytes)} · {result.provenance.note}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                void services.artifacts
                  .download(result.id)
                  .then(({ blob, filename }) => downloadBlob(blob, filename))
              }
            >
              <Download size={14} aria-hidden="true" /> Again
            </Button>
          </div>
        ) : null}
        {spec.id === 'mp4-render' && exportsQ.data?.length ? (
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
            aria-label="Render jobs"
          >
            {exportsQ.data.slice(0, 4).map((j) => (
              <ExportJobRow
                key={j.id}
                job={j}
                onDownload={(id) =>
                  void services.artifacts
                    .download(id)
                    .then(({ blob, filename }) => downloadBlob(blob, filename))
                }
                onCancel={(id) => void services.exports.cancel(id).then(() => inv.exports())}
                onRetry={(job) =>
                  void services.exports
                    .enqueue({
                      projectId: job.projectId,
                      artifactId: job.artifactId,
                      preset: job.preset,
                      operationId: newOperationId(),
                    })
                    .then(() => inv.exports())
                }
              />
            ))}
          </ul>
        ) : null}
        <div className="dialog-actions">
          <Button onClick={onClose} disabledReason={busy ? 'Wait for the export to finish.' : undefined}>
            Close
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void run()}
            disabledReason={disabledReason}
            data-testid="export-run"
          >
            {progress ?? (spec.mode === 'queue' ? 'Queue render' : 'Export and download')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
