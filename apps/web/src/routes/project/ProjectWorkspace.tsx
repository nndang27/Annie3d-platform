import {
  type Artifact,
  isServiceError,
  isTerminal,
  NODE_KINDS,
  newOperationId,
  type Project,
  type RunEvent,
  TEMPLATES,
} from '@3dads/contracts';
import { Badge, Button, Dialog, Segmented, Tabs, useToast } from '@3dads/ui';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Play, Save } from 'lucide-react';
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Composer } from '@/components/composer/Composer';
import type { Intent } from '@/components/composer/intents';
import { ErrorState } from '@/components/ErrorState';
import { RunStatusBadge } from '@/components/RunStatusBadge';
import { presentError } from '@/lib/errors';
import { useServices } from '@/services/context';
import { useArtifacts, useInvalidate, useMe, useProject, useRuns, useWorkflow } from '@/services/queries';
import { useRunSubscription } from '@/services/runSubscription';
import { useRunStore } from '@/stores/runStore';
import { useSceneStore } from '@/stores/sceneStore';
import { useUiStore } from '@/stores/uiStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { type ProjectContextValue, ProjectProvider } from './context';
import { OutputsTab } from './OutputsTab';
import { OverviewTab } from './OverviewTab';

const WorkflowTab = lazy(() => import('./WorkflowTab').then((m) => ({ default: m.WorkflowTab })));
const StudioTab = lazy(() => import('./StudioTab').then((m) => ({ default: m.StudioTab })));

type Tab = 'overview' | 'workflow' | 'studio' | 'outputs';

export function ProjectWorkspace() {
  const { projectId } = useParams({ from: '/authed/projects/$projectId' });
  const search = useSearch({ from: '/authed/projects/$projectId' });
  const navigate = useNavigate({ from: '/projects/$projectId' });
  const services = useServices();
  const toast = useToast();
  const inv = useInvalidate();
  const me = useMe();
  const detail = useProject(projectId);
  const project = detail.data?.project;
  const workflow = useWorkflow(project?.workflowId);
  const artifacts = useArtifacts({ projectId });
  const runs = useRuns(projectId);
  const selectedRunId = useUiStore((s) => s.selectedRunId);
  const setSelectedRunId = useUiStore((s) => s.setSelectedRunId);
  const role = me.data?.role ?? 'viewer';
  const canEdit = role !== 'viewer';
  const tab: Tab = search.tab ?? 'overview';
  const [busyRun, setBusyRun] = useState(false);
  const [exportPreset, setExportPreset] = useState<string | null>(null);
  const studioRef = useRef<{ play(): void; pause(): void }>(null);

  // ----- stores: load documents on arrival (never clobber dirty local edits) -----
  const wfStore = useWorkflowStore;
  const sceneStore = useSceneStore;
  useEffect(() => {
    if (
      workflow.data &&
      (wfStore.getState().workflowId !== workflow.data.id ||
        (!wfStore.getState().dirty() && wfStore.getState().baseRevision !== workflow.data.revision))
    ) {
      wfStore.getState().load(workflow.data);
    }
  }, [workflow.data]);
  useEffect(() => {
    if (!detail.data) return;
    const rev = detail.data.sceneRevisions.at(-1);
    if (!rev) return;
    const st = sceneStore.getState();
    if (st.projectId !== projectId || (!st.dirty() && st.baseRevision !== rev.revision)) {
      st.load(projectId, rev.revision, { scene: rev.scene, ad: rev.ad });
    }
  }, [detail.data, projectId]);

  // ----- run feed -----
  const activeFromList = runs.data?.find((r) => !isTerminal(r.status)) ?? null;
  const runId = search.run ?? selectedRunId ?? activeFromList?.id ?? project?.lastRunId;
  const onEvent = useCallback(
    (e: RunEvent) => {
      if (
        e.type === 'artifact.created' ||
        e.type === 'run.completed' ||
        e.type === 'run.failed' ||
        e.type === 'run.cancelled'
      ) {
        void inv.artifacts();
        void inv.project(projectId);
        void inv.runs(projectId);
      }
      if (e.type === 'run.completed')
        toast.push({
          message: 'Run completed. Outputs are ready for review.',
          action: {
            label: 'Review',
            onClick: () =>
              void navigate({
                to: '/projects/$projectId',
                params: { projectId },
                search: (s) => ({ ...s, tab: 'studio' }),
              }),
          },
        });
      if (e.type === 'run.failed')
        toast.push({
          message: `Run failed: ${String((e.payload as { error?: string }).error ?? '')}`,
          tone: 'danger',
        });
    },
    [inv, projectId, toast, navigate],
  );
  const feed = useRunSubscription(runId, onEvent);
  const setRun = useRunStore((s) => s.setRun);
  useEffect(() => setRun(feed.run), [feed.run, setRun]);
  useEffect(() => () => setRun(null), [setRun]);
  const activeRun = feed.run && !isTerminal(feed.run.status) ? feed.run : activeFromList;

  // ----- autosave workflow & scene at edit boundaries -----
  const wfDirty = useWorkflowStore((s) => s.history.present !== s.history.savedPresent);
  const wfSaving = useWorkflowStore((s) => s.saving);
  const wfSaveError = useWorkflowStore((s) => s.saveError);
  const sceneDirty = useSceneStore((s) => s.history.present !== s.history.savedPresent);
  const sceneSaving = useSceneStore((s) => s.saving);
  const sceneSaveError = useSceneStore((s) => s.saveError);

  const saveWorkflow = useCallback(async () => {
    const st = wfStore.getState();
    if (!st.dirty() || st.saving || !canEdit) return;
    const doc = st.history.present;
    st.setSaving(true);
    try {
      const saved = await services.workflows.save(doc, st.baseRevision);
      // Only mark saved if no further edits happened while saving.
      if (wfStore.getState().history.present === doc) wfStore.getState().markSaved(saved);
      else wfStore.setState({ saving: false, baseRevision: saved.revision });
    } catch (e) {
      st.setSaving(false, presentError(e).message);
    }
  }, [services, canEdit]);

  const saveScene = useCallback(
    async (source: 'manual' | 'composer' = 'manual', note?: string) => {
      const st = sceneStore.getState();
      if (!st.dirty() || st.saving || !canEdit || !st.projectId) return;
      const present = st.history.present;
      st.setSaving(true);
      try {
        const rev = await services.projects.saveScene(st.projectId, {
          scene: present.scene,
          ad: present.ad,
          baseRevision: st.baseRevision,
          source,
          note,
        });
        if (sceneStore.getState().history.present === present) sceneStore.getState().markSaved(rev.revision);
        else sceneStore.setState({ saving: false, baseRevision: rev.revision });
        void inv.project(projectId);
      } catch (e) {
        st.setSaving(false, presentError(e).message);
      }
    },
    [services, canEdit, inv, projectId],
  );

  useEffect(() => {
    if (!wfDirty) return;
    const t = window.setTimeout(() => void saveWorkflow(), 1200);
    return () => window.clearTimeout(t);
  }, [wfDirty, saveWorkflow]);
  useEffect(() => {
    if (!sceneDirty) return;
    const t = window.setTimeout(() => void saveScene(), 1000);
    return () => window.clearTimeout(t);
  }, [sceneDirty, saveScene]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (wfStore.getState().dirty() || sceneStore.getState().dirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // ----- run actions -----
  const startRun = useCallback(
    async (onlyNodeId?: string) => {
      if (!project || busyRun) return;
      setBusyRun(true);
      try {
        await saveWorkflow();
        const run = await services.runs.start({
          projectId: project.id,
          workflowId: project.workflowId,
          operationId: newOperationId(),
          onlyNodeId,
        });
        setSelectedRunId(run.id);
        void navigate({
          to: '/projects/$projectId',
          params: { projectId },
          search: (s) => ({ ...s, run: run.id }),
          replace: true,
        });
        inv.runs(project.id);
      } catch (e) {
        toast.push({ message: presentError(e).message, tone: 'danger' });
        throw e;
      } finally {
        setBusyRun(false);
      }
    },
    [project, busyRun, saveWorkflow, services, setSelectedRunId, navigate, projectId, inv, toast],
  );
  const cancelRun = useCallback(async () => {
    if (!activeRun) return;
    await services.runs.cancel(activeRun.id, newOperationId());
    inv.runs(projectId);
  }, [activeRun, services, inv, projectId]);
  const retryRun = useCallback(
    async (id: string) => {
      const run = await services.runs.retry(id, newOperationId());
      setSelectedRunId(run.id);
      void navigate({
        to: '/projects/$projectId',
        params: { projectId },
        search: (s) => ({ ...s, run: run.id }),
        replace: true,
      });
      inv.runs(projectId);
    },
    [services, setSelectedRunId, navigate, projectId, inv],
  );
  const openStudio = useCallback(
    () =>
      void navigate({
        to: '/projects/$projectId',
        params: { projectId },
        search: (s) => ({ ...s, tab: 'studio' }),
      }),
    [navigate, projectId],
  );

  const latestArtifactFor = useCallback(
    (nodeId: string): Artifact | undefined =>
      artifacts.data
        ?.filter((a) => a.nodeId === nodeId && !a.supersededBy)
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    [artifacts.data],
  );

  const ctxValue = useMemo<ProjectContextValue | null>(
    () =>
      project
        ? {
            project,
            role,
            canEdit,
            artifacts: artifacts.data ?? [],
            latestArtifactFor,
            activeRun,
            startRun,
            cancelRun,
            retryRun,
            openStudio,
            refreshArtifacts: () => void inv.artifacts(),
          }
        : null,
    [
      project,
      role,
      canEdit,
      artifacts.data,
      latestArtifactFor,
      activeRun,
      startRun,
      cancelRun,
      retryRun,
      openStudio,
      inv,
    ],
  );

  // ----- composer -----
  const onIntent = useCallback(
    async (intent: Intent): Promise<string | undefined> => {
      if (!project) return;
      switch (intent.type) {
        case 'scene': {
          if (!canEdit) throw new Error('Viewers cannot edit the scene.');
          sceneStore.getState().edit(intent.patch);
          if (tab !== 'studio') openStudio();
          await saveScene('composer', intent.summary);
          return intent.summary;
        }
        case 'template': {
          if (!canEdit) throw new Error('Viewers cannot change the workflow.');
          const t =
            TEMPLATES.find((x) => x.scene.animation === intent.preset && x.nodes.length >= 8) ??
            TEMPLATES[0]!;
          const doc = await services.workflows.applyTemplate(project.id, t.slug);
          wfStore.getState().load(doc);
          sceneStore
            .getState()
            .edit({ scene: { animation: { preset: intent.preset, durationSec: t.scene.durationSec } } });
          await saveScene('composer', `Preset ${intent.preset}`);
          void inv.project(project.id);
          if (tab !== 'workflow')
            void navigate({
              to: '/projects/$projectId',
              params: { projectId },
              search: (s) => ({ ...s, tab: 'workflow' }),
            });
          return `Applied the “${t.name}” workflow (${intent.preset}). Existing outputs are kept as earlier versions.`;
        }
        case 'run': {
          const doc = wfStore.getState().history.present;
          const only = intent.onlyKind ? doc.nodes.find((n) => n.kind === intent.onlyKind)?.id : undefined;
          if (intent.onlyKind && !only)
            throw new Error(`There is no ${NODE_KINDS[intent.onlyKind].title} step in this workflow.`);
          await startRun(only);
          if (tab !== 'workflow')
            void navigate({
              to: '/projects/$projectId',
              params: { projectId },
              search: (s) => ({ ...s, tab: 'workflow' }),
            });
          return intent.summary;
        }
        case 'cancel':
          if (!activeRun) throw new Error('There is no active run to stop.');
          await cancelRun();
          return intent.summary;
        case 'retry': {
          const last = runs.data?.find((r) => r.status === 'failed' || r.status === 'cancelled');
          if (!last) throw new Error('There is no failed or cancelled run to retry.');
          await retryRun(last.id);
          return intent.summary;
        }
        case 'playback':
          if (tab !== 'studio') openStudio();
          if (intent.action === 'play') studioRef.current?.play();
          else studioRef.current?.pause();
          return intent.summary;
        case 'history':
          if (tab === 'workflow') {
            if (intent.action === 'undo') wfStore.getState().undo();
            else wfStore.getState().redo();
          } else {
            if (intent.action === 'undo') sceneStore.getState().undo();
            else sceneStore.getState().redo();
          }
          return `${intent.summary} (${tab === 'workflow' ? 'workflow' : 'scene'})`;
        case 'export':
          if (tab !== 'studio') openStudio();
          setExportPreset(intent.preset);
          return intent.summary;
        case 'tab':
          void navigate({
            to: '/projects/$projectId',
            params: { projectId },
            search: (s) => ({ ...s, tab: intent.tab }),
          });
          return intent.summary;
        default:
          return undefined;
      }
    },
    [
      project,
      canEdit,
      tab,
      openStudio,
      saveScene,
      services,
      inv,
      navigate,
      projectId,
      startRun,
      activeRun,
      cancelRun,
      runs.data,
      retryRun,
    ],
  );

  // ----- states -----
  if (detail.isPending) {
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton" style={{ height: 28, width: 280 }} />
        <div className="skeleton" style={{ height: 420, marginTop: 20 }} />
      </div>
    );
  }
  if (detail.error || !project || !ctxValue) {
    const notFound = isServiceError(detail.error, 'not_found');
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        {notFound ? (
          <>
            <p className="badge">Missing project</p>
            <h1 className="page-title" style={{ marginTop: 12 }}>
              This project is not in your workspace
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              {presentError(detail.error).message}
            </p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
              Back to projects
            </Link>
          </>
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </div>
    );
  }

  const saveState =
    wfSaveError || sceneSaveError
      ? 'error'
      : wfSaving || sceneSaving
        ? 'saving'
        : wfDirty || sceneDirty
          ? 'dirty'
          : 'saved';
  const composerEl = (
    <Composer
      onIntent={onIntent}
      target={tab === 'workflow' ? `workflow of ${project.name}` : `scene and ad of ${project.name}`}
      disabledReason={canEdit ? undefined : 'Viewers can read but not change this project.'}
    />
  );
  const setTab = (t: Tab) =>
    void navigate({ to: '/projects/$projectId', params: { projectId }, search: (s) => ({ ...s, tab: t }) });

  return (
    <ProjectProvider value={ctxValue}>
      <div className="workspace" data-testid="workspace" data-project-id={project.id}>
        <div className="workspace-bar">
          <nav
            aria-label="Breadcrumb"
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <Link to="/">Projects</Link>
            <span aria-hidden="true">/</span>
            <h1
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 'min(360px, 55vw)',
              }}
            >
              {project.name}
            </h1>
          </nav>
          <SaveIndicator
            state={saveState}
            error={wfSaveError ?? sceneSaveError}
            onRetry={() => void Promise.all([saveWorkflow(), saveScene()])}
            onReload={() => {
              wfStore.getState().load(workflow.data!);
              void inv.project(projectId);
              void workflow.refetch();
            }}
          />
          <div style={{ flex: 1 }} />
          {activeRun ? (
            <button
              type="button"
              className="badge badge-accent"
              onClick={() => setTab('workflow')}
              style={{ border: 0, cursor: 'pointer' }}
              data-testid="active-run-badge"
            >
              <RunStatusBadge status={activeRun.status} />
            </button>
          ) : feed.run ? (
            <RunStatusBadge status={feed.run.status} />
          ) : null}
          {activeRun ? (
            <Button
              size="sm"
              onClick={() => void cancelRun()}
              disabledReason={canEdit ? undefined : 'Editors only.'}
              data-testid="bar-cancel-run"
            >
              Stop run
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              loading={busyRun}
              onClick={() => void startRun().catch(() => {})}
              disabledReason={
                canEdit ? undefined : 'Viewers cannot run workflows. Ask an owner for the editor role.'
              }
              data-testid="run-workflow"
            >
              <Play size={14} aria-hidden="true" /> Run workflow
            </Button>
          )}
        </div>
        <div
          style={{
            padding: '0 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Tabs
            label="Project views"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview', panelId: 'panel-overview' },
              { value: 'workflow', label: 'Workflow', panelId: 'panel-workflow' },
              { value: 'studio', label: 'Studio', panelId: 'panel-studio' },
              {
                value: 'outputs',
                label: `Outputs${artifacts.data?.length ? ` (${artifacts.data.length})` : ''}`,
                panelId: 'panel-outputs',
              },
            ]}
          />
          {tab === 'workflow' ? <WorkflowViewToggle /> : null}
        </div>
        <div
          className="workspace-body"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          style={{ minHeight: 0 }}
        >
          {tab === 'overview' ? <OverviewTab run={feed.run} /> : null}
          {tab === 'workflow' ? (
            <Suspense fallback={<PanelSkeleton label="Loading workflow editor" />}>
              <WorkflowTab feed={feed} composer={composerEl} />
            </Suspense>
          ) : null}
          {tab === 'studio' ? (
            <Suspense fallback={<PanelSkeleton label="Loading 3D studio" />}>
              <StudioTab
                ref={studioRef}
                exportPreset={exportPreset}
                onExportPresetHandled={() => setExportPreset(null)}
                saveScene={saveScene}
              />
            </Suspense>
          ) : null}
          {tab === 'outputs' ? <OutputsTab /> : null}
        </div>
        {tab === 'studio' ? composerEl : null}
      </div>
    </ProjectProvider>
  );
}

function WorkflowViewToggle() {
  const view = useUiStore((s) => s.workflowView);
  const setView = useUiStore((s) => s.setWorkflowView);
  return (
    <Segmented
      label="Workflow view"
      value={view}
      onChange={setView}
      options={[
        { value: 'canvas', label: 'Canvas' },
        { value: 'list', label: 'List' },
      ]}
    />
  );
}

function SaveIndicator({
  state,
  error,
  onRetry,
  onReload,
}: {
  state: 'saved' | 'saving' | 'dirty' | 'error';
  error: string | null;
  onRetry: () => void;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (state === 'error') {
    const conflict = /revision|elsewhere|Reload/i.test(error ?? '');
    return (
      <>
        <button
          type="button"
          className="badge badge-danger"
          onClick={() => setOpen(true)}
          style={{ border: 0, cursor: 'pointer' }}
          data-testid="save-state"
        >
          Save failed
        </button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Your changes were not saved"
          description={error ?? undefined}
          actions={
            <>
              <Button onClick={() => setOpen(false)}>Close</Button>
              {conflict ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    onReload();
                    setOpen(false);
                  }}
                >
                  Reload latest
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    onRetry();
                    setOpen(false);
                  }}
                >
                  Retry save
                </Button>
              )}
            </>
          }
        >
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Your edits are still in this browser.{' '}
            {conflict
              ? 'Reloading replaces the workflow with the saved revision; use Undo afterwards if needed.'
              : 'Retry when the connection is back.'}
          </p>
        </Dialog>
      </>
    );
  }
  return (
    <span className="badge" data-testid="save-state" aria-live="polite">
      {state === 'saving' ? <Save size={12} aria-hidden="true" /> : null}
      {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved changes'}
    </span>
  );
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div style={{ padding: 20 }} role="status" aria-busy="true" aria-label={label}>
      <div className="skeleton" style={{ height: 420 }} />
    </div>
  );
}

export function ProjectMeta({ project, children }: { project: Project; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge>{project.reference.source === 'upload' ? 'Uploaded reference' : 'Catalog fixture'}</Badge>
      {children}
    </div>
  );
}
