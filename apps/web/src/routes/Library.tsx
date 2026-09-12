import { type Artifact, PRODUCT_FIXTURES, TEMPLATES } from '@3dads/contracts';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  formatBytes,
  formatRelative,
  Input,
  Select,
  useToast,
} from '@3dads/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Download, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { FixtureThumb } from '@/components/FixtureThumb';
import { downloadBlob } from '@/lib/download';
import { presentError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useArtifact, useArtifacts, useBlobUrl, useProjects, useVersions } from '@/services/queries';

const KINDS = ['all', 'reference-image', 'model', 'scene', 'clip', 'ad-variant', 'export'];

export function Library() {
  const search = useSearch({ from: '/authed/library' });
  const navigate = useNavigate({ from: '/library' });
  const [q, setQ] = useState(search.q ?? '');
  const dq = useDeferredValue(q);
  const artifacts = useArtifacts({ query: dq, kind: search.kind ?? 'all', projectId: search.project });
  const projects = useProjects({ status: 'all' });
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((search.q ?? '') !== dq)
        void navigate({ to: '/library', search: (s) => ({ ...s, q: dq || undefined }), replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [dq, navigate, search.q]);
  const open = (id: string | undefined) =>
    void navigate({ to: '/library', search: (s) => ({ ...s, artifact: id }) });

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Library
      </h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 400 }}>
          <Search
            size={16}
            aria-hidden="true"
            style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }}
          />
          <Input
            type="search"
            aria-label="Search outputs"
            placeholder="Search outputs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36 }}
            data-testid="library-search"
          />
        </div>
        <Select
          small
          aria-label="Kind"
          value={search.kind ?? 'all'}
          onChange={(e) =>
            void navigate({
              to: '/library',
              search: (s) => ({ ...s, kind: e.target.value === 'all' ? undefined : e.target.value }),
            })
          }
          style={{ width: 170 }}
          data-testid="library-kind"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k === 'all' ? 'All kinds' : k}
            </option>
          ))}
        </Select>
        <Select
          small
          aria-label="Project"
          value={search.project ?? ''}
          onChange={(e) =>
            void navigate({ to: '/library', search: (s) => ({ ...s, project: e.target.value || undefined }) })
          }
          style={{ width: 240 }}
        >
          <option value="">All projects</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {artifacts.error ? (
        <ErrorState error={artifacts.error} onRetry={() => void artifacts.refetch()} />
      ) : null}
      {artifacts.isPending ? (
        <div className="grid-cards" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '4/4' }} />
          ))}
        </div>
      ) : artifacts.data?.length === 0 ? (
        <EmptyState
          title="No outputs match"
          action={
            <Button
              onClick={() => {
                setQ('');
                void navigate({ to: '/library', search: {} });
              }}
            >
              Clear filters
            </Button>
          }
        >
          Outputs from every run land here with their provenance and versions.
        </EmptyState>
      ) : (
        <div className="grid-cards" data-testid="library-grid">
          {artifacts.data?.map((a) => (
            <button
              key={a.id}
              type="button"
              className="card"
              style={{ padding: 10, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 6 }}
              onClick={() => open(a.id)}
              data-testid="library-item"
            >
              <div className="thumb">
                {a.preview.kind === 'fixture' ? (
                  <FixtureThumb fixtureId={a.preview.fixtureId as 'serum-bottle'} alt="" />
                ) : a.preview.kind === 'image' ? (
                  <ImagePreview blobKey={a.preview.blobKey} alt={a.title} />
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{a.mime}</span>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.title}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                <Badge>{a.kind}</Badge>
                <Badge
                  tone={
                    a.acceptance === 'accepted'
                      ? 'success'
                      : a.acceptance === 'rejected'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {a.acceptance}
                </Badge>
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>
                  {formatRelative(a.createdAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <ArtifactDetail id={search.artifact} onClose={() => open(undefined)} />
    </div>
  );
}

function ImagePreview({ blobKey, alt }: { blobKey: string; alt: string }) {
  const b = useBlobUrl(blobKey);
  return b.data ? (
    <img src={b.data} alt={alt} />
  ) : (
    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
  );
}

function ArtifactDetail({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const services = useServices();
  const toast = useToast();
  const art = useArtifact(id);
  const versions = useVersions(art.data?.lineageId);
  const projects = useProjects({ status: 'all' });
  const [busy, setBusy] = useState(false);
  const a = art.data;
  const project = projects.data?.find((p) => p.id === a?.projectId);
  const download = async (target: Artifact) => {
    setBusy(true);
    try {
      const { blob, filename } = await services.artifacts.download(target.id);
      downloadBlob(blob, filename);
    } catch (e) {
      toast.push({ message: presentError(e).message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      title={a?.title ?? (art.error ? 'Artifact unavailable' : 'Loading…')}
      width={720}
    >
      {art.error ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <ErrorState error={art.error} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            The artifact you followed a link to is missing from this workspace. Other versions in its lineage,
            if any, are still listed in the library.
          </p>
        </div>
      ) : a ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 16 }}>
          <div
            className="thumb"
            style={{ aspectRatio: a.ad?.aspect === '9:16' ? '9/16' : '4/3', maxHeight: 360 }}
          >
            {a.preview.kind === 'fixture' ? (
              <FixtureThumb fixtureId={a.preview.fixtureId as 'serum-bottle'} alt="" />
            ) : a.preview.kind === 'image' ? (
              <ImagePreview blobKey={a.preview.blobKey} alt={a.title} />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{a.mime ?? 'No preview'}</span>
            )}
          </div>
          <div style={{ fontSize: '0.875rem', display: 'grid', gap: 8, alignContent: 'start' }}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
              <dt style={{ color: 'var(--text-muted)' }}>Kind</dt>
              <dd style={{ margin: 0 }}>{a.kind}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Revision</dt>
              <dd style={{ margin: 0 }}>v{a.revision}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Project</dt>
              <dd style={{ margin: 0 }}>
                {project ? (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    search={{ tab: 'outputs', artifact: a.id }}
                  >
                    {project.name}
                  </Link>
                ) : (
                  a.projectId
                )}
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Source</dt>
              <dd style={{ margin: 0 }}>{a.provenance.source}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Run</dt>
              <dd style={{ margin: 0 }} className="mono">
                {a.runId ?? '—'}
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Created</dt>
              <dd style={{ margin: 0 }}>{new Date(a.createdAt).toLocaleString('en-US')}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Size</dt>
              <dd style={{ margin: 0 }}>{formatBytes(a.sizeBytes)}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Fixture</dt>
              <dd style={{ margin: 0 }}>{a.scene ? PRODUCT_FIXTURES[a.scene.fixtureId].name : '—'}</dd>
            </dl>
            <p style={{ color: 'var(--text-secondary)' }}>{a.provenance.note}</p>
            {a.blobKey ? (
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() => void download(a)}
                data-testid="library-download"
              >
                <Download size={14} aria-hidden="true" /> Download {a.mime?.split('/')[1]?.toUpperCase()}
              </Button>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                No file: this output is a scene definition. Open the project and export it.
              </p>
            )}
            {versions.data && versions.data.length > 1 ? (
              <div>
                <div className="field-label">Versions</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {versions.data.map((v) => (
                    <li key={v.id}>
                      <Link
                        to="/library"
                        search={(s) => ({ ...s, artifact: v.id })}
                        aria-current={v.id === a.id ? 'true' : undefined}
                      >
                        v{v.revision} · {formatRelative(v.createdAt)} · {v.acceptance}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Template: {TEMPLATES.find((t) => t.slug === project?.templateSlug)?.name ?? '—'}
            </p>
          </div>
        </div>
      ) : (
        <div className="skeleton" style={{ height: 240 }} />
      )}
    </Dialog>
  );
}
