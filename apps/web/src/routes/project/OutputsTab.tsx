import { type Artifact, type ExportJob, newOperationId } from '@annie3d/contracts';
import { Badge, Button, EmptyState, formatBytes, formatRelative, Select, useToast } from '@annie3d/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Check, Download, GitCompare, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { FixtureThumb } from '@/components/FixtureThumb';
import { downloadBlob } from '@/lib/download';
import { presentError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useBlobUrl, useExports, useInvalidate } from '@/services/queries';
import { useSceneStore } from '@/stores/sceneStore';
import { useProjectContext } from './context';

export function OutputsTab() {
  const { project, artifacts, canEdit, refreshArtifacts, openStudio } = useProjectContext();
  const search = useSearch({ from: '/authed/projects/$projectId' });
  const navigate = useNavigate({ from: '/projects/$projectId' });
  const services = useServices();
  const inv = useInvalidate();
  const toast = useToast();
  const exportsQ = useExports(project.id);
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const lineages = useMemo(() => {
    const map = new Map<string, Artifact[]>();
    for (const a of artifacts) map.set(a.lineageId, [...(map.get(a.lineageId) ?? []), a]);
    for (const list of map.values()) list.sort((a, b) => b.revision - a.revision);
    return [...map.entries()].sort((a, b) => (b[1][0]?.createdAt ?? 0) - (a[1][0]?.createdAt ?? 0));
  }, [artifacts]);
  useEffect(() => services.exports.subscribe(() => void inv.exports()), [services, inv]);
  useEffect(() => {
    if (search.artifact)
      document.getElementById(`art-${search.artifact}`)?.scrollIntoView({ block: 'center' });
  }, [search.artifact]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    setErr(null);
    try {
      await fn();
      refreshArtifacts();
      void inv.project(project.id);
      void inv.versions();
    } catch (e) {
      setErr(e);
      toast.push({ message: presentError(e).message, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const download = (a: Artifact) =>
    act(`dl-${a.id}`, async () => {
      const { blob, filename } = await services.artifacts.download(a.id);
      downloadBlob(blob, filename);
    });
  const openInStudio = (a: Artifact) => {
    if (a.scene && a.ad) useSceneStore.getState().edit({ scene: a.scene, ad: a.ad });
    void services.projects.selectArtifact(project.id, a.id).then(() => inv.project(project.id));
    openStudio();
  };
  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));
  const compared = compare.map((id) => artifacts.find((a) => a.id === id)).filter((a): a is Artifact => !!a);

  return (
    <div className="page" style={{ maxWidth: 1200 }} data-testid="outputs">
      {err ? <ErrorState error={err} /> : null}
      {compared.length === 2 ? (
        <section className="card card-pad" style={{ marginBottom: 20 }} aria-label="Compare versions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <GitCompare size={16} aria-hidden="true" />
            <strong>Comparing</strong>
            <Button size="sm" variant="tertiary" onClick={() => setCompare([])}>
              <X size={14} aria-hidden="true" /> Clear
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {compared.map((a) => (
              <div key={a.id} style={{ display: 'grid', gap: 6 }}>
                <ArtifactPreview artifact={a} />
                <strong style={{ fontSize: '0.9rem' }}>{a.title}</strong>
                <dl
                  style={{
                    margin: 0,
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '2px 8px',
                  }}
                >
                  <dt>Background</dt>
                  <dd style={{ margin: 0 }}>{a.scene?.background ?? '—'}</dd>
                  <dt>Colour</dt>
                  <dd style={{ margin: 0 }}>{a.scene?.materialColor ?? '—'}</dd>
                  <dt>Light</dt>
                  <dd style={{ margin: 0 }}>{a.scene?.light ?? '—'}</dd>
                  <dt>Headline</dt>
                  <dd style={{ margin: 0 }}>{a.ad?.headline ?? '—'}</dd>
                  <dt>Aspect</dt>
                  <dd style={{ margin: 0 }}>{a.ad?.aspect ?? '—'}</dd>
                  <dt>Acceptance</dt>
                  <dd style={{ margin: 0 }}>{a.acceptance}</dd>
                </dl>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    void act(`sel-${a.id}`, () => services.projects.selectArtifact(project.id, a.id))
                  }
                  disabledReason={canEdit ? undefined : 'Editors only.'}
                >
                  Use this version
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {lineages.length === 0 ? (
        <EmptyState title="No outputs yet">
          Run the workflow to create outputs. Each run adds a new version; earlier versions are kept.
        </EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {lineages.map(([lineage, versions]) => (
            <section
              key={lineage}
              aria-label={versions[0]!.title}
              className="card card-pad"
              style={{ display: 'grid', gap: 10 }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{versions[0]!.title.replace(/ · v\d+$/, '')}</strong>
                <Badge>{versions[0]!.kind}</Badge>
                <Badge>
                  {versions.length} version{versions.length === 1 ? '' : 's'}
                </Badge>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {versions.map((a) => {
                  const selected = project.selectedArtifactId === a.id;
                  return (
                    <article
                      key={a.id}
                      id={`art-${a.id}`}
                      className="card"
                      style={{
                        padding: 10,
                        display: 'grid',
                        gap: 6,
                        borderColor: selected
                          ? 'var(--accent)'
                          : search.artifact === a.id
                            ? 'var(--border-control)'
                            : undefined,
                      }}
                      data-testid="artifact-card"
                      data-artifact-id={a.id}
                      data-selected={selected}
                    >
                      <ArtifactPreview artifact={a} />
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <strong>v{a.revision}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>{formatRelative(a.createdAt)}</span>
                        {selected ? <Badge tone="accent">Selected for export</Badge> : null}
                        {a.supersededBy ? <Badge>Superseded</Badge> : null}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.provenance.note} {a.sizeBytes ? `· ${formatBytes(a.sizeBytes)}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Select
                          small
                          aria-label={`Acceptance for ${a.title}`}
                          value={a.acceptance}
                          onChange={(e) =>
                            void act(`acc-${a.id}`, () =>
                              services.artifacts.setAcceptance(
                                a.id,
                                e.target.value as Artifact['acceptance'],
                              ),
                            )
                          }
                          disabled={!canEdit}
                          style={{ width: 130 }}
                        >
                          <option value="unreviewed">Unreviewed</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </Select>
                        <label className="check" style={{ fontSize: '0.8125rem' }}>
                          <input
                            type="checkbox"
                            checked={compare.includes(a.id)}
                            onChange={() => toggleCompare(a.id)}
                            aria-label={`Compare ${a.title}`}
                          />
                          Compare
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.scene ? (
                          <Button
                            size="sm"
                            onClick={() => openInStudio(a)}
                            disabledReason={canEdit ? undefined : 'Editors only.'}
                          >
                            Open in Studio
                          </Button>
                        ) : null}
                        {!selected && (a.kind === 'ad-variant' || a.kind === 'clip' || a.kind === 'scene') ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            loading={busy === `sel-${a.id}`}
                            onClick={() =>
                              void act(`sel-${a.id}`, () =>
                                services.projects.selectArtifact(project.id, a.id),
                              )
                            }
                            disabledReason={canEdit ? undefined : 'Editors only.'}
                            data-testid="select-artifact"
                          >
                            <Check size={14} aria-hidden="true" /> Select
                          </Button>
                        ) : null}
                        {a.blobKey ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            loading={busy === `dl-${a.id}`}
                            onClick={() => void download(a)}
                            data-testid="download-artifact"
                          >
                            <Download size={14} aria-hidden="true" /> Download
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <section style={{ marginTop: 24 }} aria-label="Export jobs">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Render queue (simulated)</h2>
        {exportsQ.data?.length ? (
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
            data-testid="export-jobs"
          >
            {exportsQ.data.map((j) => (
              <ExportJobRow
                key={j.id}
                job={j}
                onDownload={(id) =>
                  act(`dl-${id}`, async () => {
                    const { blob, filename } = await services.artifacts.download(id);
                    downloadBlob(blob, filename);
                  })
                }
                onCancel={(id) => act(`cx-${id}`, () => services.exports.cancel(id))}
                onRetry={(job) =>
                  act(`re-${job.id}`, () =>
                    services.exports.enqueue({
                      projectId: job.projectId,
                      artifactId: job.artifactId,
                      preset: job.preset,
                      operationId: newOperationId(),
                    }),
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No render jobs yet. Queue an MP4 render from the Studio export dialog.
          </p>
        )}
      </section>
      <p style={{ marginTop: 16 }}>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => void navigate({ to: '/library', search: { project: project.id } })}
        >
          Open in library
        </Button>
      </p>
    </div>
  );
}

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const blob = useBlobUrl(artifact.preview.kind === 'image' ? artifact.preview.blobKey : undefined);
  return (
    <div
      className="thumb"
      style={{
        aspectRatio: artifact.ad?.aspect === '9:16' ? '9/16' : artifact.ad?.aspect === '4:5' ? '4/5' : '4/3',
        maxHeight: 240,
      }}
    >
      {artifact.preview.kind === 'fixture' ? (
        <FixtureThumb fixtureId={artifact.preview.fixtureId as 'serum-bottle'} alt="" />
      ) : artifact.preview.kind === 'image' && blob.data ? (
        <img src={blob.data} alt={artifact.title} />
      ) : (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>
          {artifact.mime ?? 'No preview'}
        </span>
      )}
    </div>
  );
}

export function ExportJobRow({
  job,
  onDownload,
  onCancel,
  onRetry,
}: {
  job: ExportJob;
  onDownload: (artifactId: string) => void;
  onCancel: (id: string) => void;
  onRetry: (job: ExportJob) => void;
}) {
  return (
    <li
      className="card"
      style={{
        padding: '8px 12px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '0.875rem',
      }}
      data-testid="export-job"
      data-status={job.status}
    >
      <Badge
        tone={
          job.status === 'completed'
            ? 'success'
            : job.status === 'failed'
              ? 'danger'
              : job.status === 'cancelled'
                ? 'neutral'
                : 'accent'
        }
        pulse={job.status === 'rendering' || job.status === 'queued'}
      >
        {job.status}
      </Badge>
      <span>{job.filename}</span>
      {job.progress && (job.status === 'rendering' || job.status === 'queued') ? (
        <span className="numeric" style={{ color: 'var(--text-secondary)' }}>
          {job.progress.done}/{job.progress.total} {job.progress.unit}
        </span>
      ) : null}
      {job.status === 'completed' ? <Badge tone="warning">Sample media — not your scene</Badge> : null}
      {job.error ? <span style={{ color: 'var(--danger)' }}>{job.error}</span> : null}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {job.status === 'completed' && job.resultArtifactId ? (
          <Button size="sm" onClick={() => onDownload(job.resultArtifactId!)} data-testid="download-export">
            <Download size={14} aria-hidden="true" /> Download MP4
          </Button>
        ) : null}
        {job.status === 'queued' || job.status === 'rendering' ? (
          <Button size="sm" variant="tertiary" onClick={() => onCancel(job.id)}>
            Cancel
          </Button>
        ) : null}
        {job.status === 'failed' || job.status === 'cancelled' ? (
          <Button size="sm" variant="tertiary" onClick={() => onRetry(job)}>
            Retry
          </Button>
        ) : null}
      </span>
    </li>
  );
}
