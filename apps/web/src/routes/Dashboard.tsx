import {
  findTemplate,
  newOperationId,
  PRODUCT_FIXTURES,
  type ProjectFilter,
  type ProjectSummary,
  TEMPLATES,
} from '@3dads/contracts';
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  formatRelative,
  Input,
  Menu,
  Segmented,
  Select,
  useToast,
} from '@3dads/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  Archive,
  ArchiveRestore,
  Copy,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { FixtureThumb } from '@/components/FixtureThumb';
import { RunStatusBadge } from '@/components/RunStatusBadge';
import { en } from '@/i18n/en';
import { presentError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useActiveRuns, useInvalidate, useMe, useProjects } from '@/services/queries';

export function Dashboard() {
  const search = useSearch({ from: '/authed/' });
  const navigate = useNavigate({ from: '/' });
  const [q, setQ] = useState(search.q ?? '');
  const deferredQ = useDeferredValue(q);
  const status = search.status ?? 'active';
  const filter: ProjectFilter = { query: deferredQ, status, templateSlug: search.template };
  const projects = useProjects(filter);
  const active = useActiveRuns();
  const me = useMe();
  const canEdit = me.data?.role !== 'viewer';

  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((search.q ?? '') !== deferredQ)
        void navigate({ to: '/', search: (s) => ({ ...s, q: deferredQ || undefined }), replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [deferredQ, navigate, search.q]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 className="page-title">{en.dashboard.title}</h1>
        <div style={{ flex: 1 }} />
        <Link
          to="/projects/new"
          className="btn btn-primary"
          data-testid="dashboard-new-project"
          aria-disabled={!canEdit || undefined}
          title={!canEdit ? 'Viewers cannot create projects. Ask an owner for the editor role.' : undefined}
          onClick={(e) => !canEdit && e.preventDefault()}
        >
          <FolderPlus size={16} aria-hidden="true" />
          {en.nav.newProject}
        </Link>
      </div>

      {active.data && active.data.length > 0 ? (
        <section aria-labelledby="active-runs" style={{ marginBottom: 24 }}>
          <h2
            id="active-runs"
            style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}
          >
            {en.dashboard.activeRuns}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {active.data.map((r) => (
              <Link
                key={r.id}
                to="/projects/$projectId"
                params={{ projectId: r.projectId }}
                search={{ tab: 'workflow', run: r.id }}
                className="card"
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  color: 'inherit',
                }}
                data-testid="active-run"
              >
                <RunStatusBadge status={r.status} />
                <span className="numeric">
                  {r.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length}/
                  {r.steps.length} steps
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
          <Search
            size={16}
            aria-hidden="true"
            style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }}
          />
          <Input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36 }}
            data-testid="project-search"
          />
        </div>
        <Segmented
          label="Project status"
          value={status}
          onChange={(v) =>
            void navigate({ to: '/', search: (s) => ({ ...s, status: v === 'active' ? undefined : v }) })
          }
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Select
          aria-label="Filter by template"
          small
          value={search.template ?? ''}
          onChange={(e) =>
            void navigate({ to: '/', search: (s) => ({ ...s, template: e.target.value || undefined }) })
          }
          style={{ width: 220 }}
        >
          <option value="">All templates</option>
          {TEMPLATES.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {projects.error ? <ErrorState error={projects.error} onRetry={() => void projects.refetch()} /> : null}
      {projects.isPending ? (
        <div className="grid-cards" aria-busy="true" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-pad">
              <div className="skeleton" style={{ aspectRatio: '4/3' }} />
              <div className="skeleton" style={{ height: 16, marginTop: 12, width: '70%' }} />
              <div className="skeleton" style={{ height: 12, marginTop: 8, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : projects.data && projects.data.length === 0 ? (
        deferredQ || search.template || status !== 'active' ? (
          <EmptyState
            title={en.dashboard.noResults}
            action={
              <Button
                onClick={() => {
                  setQ('');
                  void navigate({ to: '/', search: {} });
                }}
              >
                Clear filters
              </Button>
            }
          >
            Nothing matches “{deferredQ || search.template || status}”. Your query is kept so you can refine
            it.
          </EmptyState>
        ) : (
          <EmptyState
            title={en.dashboard.empty}
            icon={<FolderPlus size={28} aria-hidden="true" />}
            action={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link
                  to="/projects/new"
                  search={{ template: 'turntable-hero-skincare' }}
                  className="btn btn-primary"
                >
                  Try the Turntable hero template
                </Link>
                <Link to="/projects/new" className="btn btn-secondary">
                  Upload a product image
                </Link>
              </div>
            }
          >
            {en.dashboard.emptyBody}
          </EmptyState>
        )
      ) : (
        <div className="grid-cards" data-testid="project-grid">
          {projects.data?.map((p) => (
            <ProjectCard key={p.id} project={p} canEdit={canEdit} isOwner={me.data?.role === 'owner'} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  canEdit,
  isOwner,
}: {
  project: ProjectSummary;
  canEdit: boolean;
  isOwner: boolean;
}) {
  const services = useServices();
  const inv = useInvalidate();
  const toast = useToast();
  const navigate = useNavigate({ from: '/' });
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const template = findTemplate(project.templateSlug);
  const fixture = PRODUCT_FIXTURES[project.fixtureId];

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await inv.projects();
      if (done) toast.push({ message: done });
      setDialog(null);
    } catch (e) {
      setErr(e);
      if (!dialog) toast.push({ message: presentError(e).message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const items = [
    {
      label: 'Rename',
      icon: <Pencil size={16} aria-hidden="true" />,
      onSelect: () => setDialog('rename'),
      disabledReason: canEdit ? undefined : 'Editors only',
    },
    {
      label: 'Duplicate',
      icon: <Copy size={16} aria-hidden="true" />,
      onSelect: () =>
        void run(() => services.projects.duplicate(project.id, newOperationId()), 'Project duplicated'),
      disabledReason: canEdit ? undefined : 'Editors only',
    },
    project.status === 'archived'
      ? {
          label: 'Restore',
          icon: <ArchiveRestore size={16} aria-hidden="true" />,
          onSelect: () => void run(() => services.projects.archive(project.id, false), 'Project restored'),
          disabledReason: canEdit ? undefined : 'Editors only',
        }
      : {
          label: 'Archive',
          icon: <Archive size={16} aria-hidden="true" />,
          onSelect: () => void run(() => services.projects.archive(project.id, true), 'Project archived'),
          disabledReason: canEdit ? undefined : 'Editors only',
        },
    'sep' as const,
    {
      label: 'Delete…',
      icon: <Trash2 size={16} aria-hidden="true" />,
      danger: true,
      onSelect: () => setDialog('delete'),
      disabledReason: isOwner ? undefined : 'Only the workspace owner can delete projects',
    },
  ];

  return (
    <article
      className="card"
      style={{ display: 'flex', flexDirection: 'column' }}
      data-testid="project-card"
      data-project-id={project.id}
    >
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        search={{ tab: 'overview' }}
        style={{ color: 'inherit', display: 'block', padding: 12, paddingBottom: 0 }}
        aria-label={`Open ${project.name}`}
      >
        <div className="thumb">
          <FixtureThumb fixtureId={project.fixtureId} />
        </div>
      </Link>
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            search={{ tab: 'overview' }}
            style={{
              color: 'inherit',
              fontWeight: 600,
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {project.name}
          </Link>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              marginTop: 2,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span>{template?.name ?? fixture.name}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(project.updatedAt)}</span>
            {project.activeRunStatus ? (
              <RunStatusBadge status={project.activeRunStatus as 'running'} />
            ) : null}
            {project.status === 'archived' ? <span className="badge">Archived</span> : null}
          </div>
        </div>
        <Menu
          label={`Actions for ${project.name}`}
          items={items}
          trigger={(p) => (
            <button
              type="button"
              className="btn btn-tertiary btn-icon btn-sm"
              aria-label={`More actions for ${project.name}`}
              {...p}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          )}
        />
      </div>
      <Dialog
        open={dialog === 'rename'}
        onClose={() => setDialog(null)}
        title="Rename project"
        locked={busy}
        actions={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => void run(() => services.projects.rename(project.id, name), 'Project renamed')}
            >
              Save name
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => services.projects.rename(project.id, name), 'Project renamed');
          }}
        >
          <Field label="Project name" error={err ? presentError(err).message : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                data-autofocus
              />
            )}
          </Field>
        </form>
      </Dialog>
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete “${project.name}”?`}
        description="This removes the project, its workflow, runs and outputs from the demo workspace. Exports you already downloaded are unaffected."
        locked={busy}
        actions={
          <>
            <Button onClick={() => setDialog(null)}>Keep project</Button>
            <Button
              variant="destructive-solid"
              loading={busy}
              onClick={() =>
                void run(
                  () => services.projects.remove(project.id).then(() => navigate({ to: '/' })),
                  'Project deleted',
                )
              }
              data-testid="confirm-delete"
            >
              Delete project
            </Button>
          </>
        }
      >
        {err ? <ErrorState error={err} compact /> : null}
      </Dialog>
    </article>
  );
}
