import { findTemplate, PRODUCT_FIXTURES, type Run } from '@annie3d/contracts';
import { Badge, Button, formatBytes, formatRelative } from '@annie3d/ui';
import { Link } from '@tanstack/react-router';
import { FixtureThumb } from '@/components/FixtureThumb';
import { RunStatusBadge } from '@/components/RunStatusBadge';
import { useBlobUrl } from '@/services/queries';
import { useProjectContext } from './context';

export function OverviewTab({ run }: { run: Run | null }) {
  const { project, artifacts, canEdit, startRun, activeRun, openStudio } = useProjectContext();
  const template = findTemplate(project.templateSlug);
  const fixture = PRODUCT_FIXTURES[project.reference.fixtureId];
  const upload = useBlobUrl(project.reference.uploadBlobKey);
  const outputs = artifacts.filter((a) => a.kind === 'ad-variant' || a.kind === 'clip' || a.kind === 'scene');
  return (
    <div
      className="page"
      style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 1100 }}
      data-testid="overview"
    >
      <section
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}
      >
        <div className="card card-pad" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Product reference</h2>
          <div className="preview-frame" style={{ padding: 8 }}>
            {project.reference.source === 'upload' ? (
              upload.data ? (
                <img
                  src={upload.data}
                  alt={`Uploaded reference ${project.reference.uploadName}`}
                  style={{ maxHeight: 220, objectFit: 'contain', margin: '0 auto' }}
                  data-testid="reference-preview"
                />
              ) : (
                <div className="skeleton" style={{ height: 200 }} />
              )
            ) : (
              <FixtureThumb fixtureId={project.reference.fixtureId} alt={`Catalog fixture ${fixture.name}`} />
            )}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{project.productName}</strong>
            </div>
            <div>{project.productDescription || 'No description yet.'}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {project.reference.source === 'upload' ? (
                <>
                  <Badge>Your image · {formatBytes(project.reference.uploadSizeBytes)}</Badge>
                  <Badge tone="warning">3D model is a labelled demo fixture ({fixture.name})</Badge>
                </>
              ) : (
                <Badge>Catalog fixture · {fixture.name}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="card card-pad" style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Creative brief</h2>
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 12px',
              fontSize: '0.875rem',
            }}
          >
            <dt style={{ color: 'var(--text-muted)' }}>Template</dt>
            <dd style={{ margin: 0 }}>{template?.name ?? '—'}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Goal</dt>
            <dd style={{ margin: 0 }}>{project.brief.goal}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Audience</dt>
            <dd style={{ margin: 0 }}>{project.brief.audience}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Tone</dt>
            <dd style={{ margin: 0 }}>{project.brief.tone}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Formats</dt>
            <dd style={{ margin: 0 }}>{project.brief.aspects.join(' · ')}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>Key message</dt>
            <dd style={{ margin: 0 }}>{project.brief.keyMessage}</dd>
          </dl>
        </div>
        <div className="card card-pad" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Status</h2>
          <div
            style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}
          >
            {run ? <RunStatusBadge status={run.status} /> : <Badge>No runs yet</Badge>}
            <span style={{ color: 'var(--text-muted)' }}>Updated {formatRelative(project.updatedAt)}</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {outputs.length} output{outputs.length === 1 ? '' : 's'} · scene revision {project.sceneRevision}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!activeRun ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void startRun().catch(() => {})}
                disabledReason={canEdit ? undefined : 'Viewers cannot run workflows.'}
              >
                Run workflow
              </Button>
            ) : null}
            <Button size="sm" onClick={openStudio}>
              Open studio
            </Button>
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              search={{ tab: 'workflow' }}
              className="btn btn-secondary btn-sm"
            >
              Edit workflow
            </Link>
          </div>
        </div>
      </section>
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 10 }}>Recent outputs</h2>
        {outputs.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>
            <div className="empty-title">No outputs yet</div>
            <div>
              Run the workflow to produce a model, scene, clip and ad variants. In the demo these are labelled
              fixtures.
            </div>
          </div>
        ) : (
          <div className="grid-cards">
            {outputs.slice(0, 6).map((a) => (
              <Link
                key={a.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ tab: 'outputs', artifact: a.id }}
                className="card"
                style={{ padding: 10, color: 'inherit' }}
              >
                <div className="thumb">
                  {a.preview.kind === 'fixture' ? (
                    <FixtureThumb fixtureId={a.preview.fixtureId as 'serum-bottle'} alt="" />
                  ) : null}
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>{a.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {a.kind} · {formatRelative(a.createdAt)} · {a.acceptance}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
