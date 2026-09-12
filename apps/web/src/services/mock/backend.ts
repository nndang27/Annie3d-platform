import {
  type AdComposition,
  type Artifact,
  type BillingInterval,
  type CheckoutSession,
  type CreateProjectInput,
  canTransition,
  DEFAULT_AD,
  DEFAULT_NOTIFICATION_PREFS,
  defaultScene,
  type EventReplay,
  EXPORT_PRESETS,
  type ExportJob,
  type ExportPresetId,
  executableSteps,
  findPlan,
  findTemplate,
  type Identity,
  type Invitation,
  isTerminal,
  type Member,
  NODE_KINDS,
  type NotificationEntry,
  type NotificationPrefs,
  PLANS,
  type PlanId,
  PRODUCT_FIXTURES,
  type Project,
  type ProjectDetail,
  type ProjectFilter,
  type ProjectSummary,
  planPrice,
  type Role,
  type Run,
  type RunEvent,
  type RunEventType,
  type RunStatus,
  type RunStep,
  type SceneDoc,
  type SceneRevision,
  ServiceError,
  type Session,
  type Subscription,
  TEMPLATES,
  type User,
  type WorkflowDoc,
  type Workspace,
} from '@3dads/contracts';
import type { VirtualClock } from './clock';
import type { LatencyProfile, ScenarioId } from './scenarios';
import { PersistedScheduler, type ScheduledTask } from './scheduler';
import {
  buildWorkflowFromTemplate,
  type DatasetSize,
  type GlobalState,
  RETENTION,
  STATE_VERSION,
  seedGlobal,
  seedWorkspace,
  type WorkspaceState,
} from './state';
import type { DemoStore } from './store';

export interface BackendOptions {
  store: DemoStore;
  clock: VirtualClock;
  scenario: () => ScenarioId;
  latency: () => LatencyProfile;
  /** URL of the labelled sample MP4 used by the simulated render queue. */
  sampleMp4Url: string;
  defaultDataset?: DatasetSize;
}

const SESSION_TTL_MS = 12 * 3_600_000;

type Listener<T> = (v: T) => void;

/**
 * Stateful demo backend. Owns domain rules, the persisted scheduler and the event log.
 * Transport concerns (latency, injected failures) live in transport.ts.
 */
export class MockBackend {
  global: GlobalState;
  ws: WorkspaceState | null = null;
  readonly scheduler: PersistedScheduler;
  private runListeners = new Map<string, Set<Listener<RunEvent>>>();
  private exportListeners = new Set<Listener<ExportJob>>();
  private notificationListeners = new Set<() => void>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  ready: Promise<void>;
  /** Scheduler-driven runs use this to look up durations at execution time. */
  private opts: BackendOptions;

  constructor(opts: BackendOptions) {
    this.opts = opts;
    this.global = seedGlobal();
    this.scheduler = new PersistedScheduler(
      opts.clock,
      () => this.ws?.tasks ?? [],
      (t) => {
        if (this.ws) {
          this.ws.tasks = t;
          this.persistSoon();
        }
      },
    );
    this.registerTaskHandlers();
    this.ready = this.load();
  }

  // ---------- persistence ----------

  private async load(): Promise<void> {
    const g = await this.opts.store.get<GlobalState>('global');
    if (g && g.version === STATE_VERSION) this.global = g;
    else await this.persistNow();
    if (this.global.session && this.global.session.expiresAt > this.now()) {
      await this.loadWorkspace(this.global.session.workspaceId);
    } else if (this.global.session) {
      this.global.session = null;
    }
  }

  private async loadWorkspace(workspaceId: string): Promise<void> {
    const key = `ws:${workspaceId}`;
    let ws = await this.opts.store.get<WorkspaceState>(key);
    if (!ws || ws.version !== STATE_VERSION) {
      const size = this.opts.defaultDataset ?? (workspaceId === 'ws_lumen' ? 'typical' : 'small');
      ws = seedWorkspace(workspaceId, size, this.now(), (p) => this.nextId(p));
      this.ws = ws;
      await this.persistNow();
    }
    this.ws = ws;
    // Catch up on simulated work that became due while the tab was closed.
    this.scheduler.runDue();
    this.scheduler.arm();
  }

  private unloadWorkspace(): void {
    this.scheduler.dispose();
    this.ws = null;
  }

  persistSoon(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 80);
  }

  persistNow(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const stamp = Date.now();
    this.global.savedAt = stamp;
    if (this.ws) this.ws.savedAt = stamp;
    const g = structuredClone(this.global);
    const ws = this.ws ? structuredClone(this.ws) : null;
    this.persistQueue = this.persistQueue.then(async () => {
      await this.opts.store.set('global', g);
      if (ws) await this.opts.store.set(`ws:${ws.workspaceId}`, ws);
    });
    return this.persistQueue;
  }

  async resetAll(dataset?: DatasetSize): Promise<void> {
    this.scheduler.dispose();
    await this.persistQueue;
    await this.opts.store.clear();
    this.global = seedGlobal();
    this.ws = null;
    if (dataset) this.opts.defaultDataset = dataset;
    await this.persistNow();
  }

  async reseedWorkspace(dataset: DatasetSize): Promise<void> {
    const s = this.requireSession();
    this.scheduler.dispose();
    this.ws = seedWorkspace(s.workspaceId, dataset, this.now(), (p) => this.nextId(p));
    await this.persistNow();
    this.scheduler.arm();
  }

  now(): number {
    return this.opts.clock.now();
  }

  nextId(prefix: string): string {
    this.global.idCounter += 1;
    return `${prefix}_${this.global.idCounter.toString(36).padStart(6, '0')}`;
  }

  // ---------- session ----------

  requireSession(): Session {
    const s = this.global.session;
    if (!s) throw new ServiceError('unauthorized', 'Sign in to continue.');
    if (s.expiresAt <= this.now()) {
      this.global.session = null;
      this.unloadWorkspace();
      throw new ServiceError('session_expired', 'Your demo session expired. Sign in again to continue.');
    }
    return s;
  }

  expireSession(): void {
    if (this.global.session) this.global.session.expiresAt = this.now() - 1;
    this.persistSoon();
  }

  requireWs(): WorkspaceState {
    this.requireSession();
    if (!this.ws) throw new ServiceError('internal', 'Workspace not loaded.');
    return this.ws;
  }

  requireRole(min: 'editor' | 'owner'): Session {
    const s = this.requireSession();
    const effective: Role = this.opts.scenario() === 'denied-role' ? 'viewer' : s.role;
    const rank: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
    if (rank[effective] < rank[min]) {
      throw new ServiceError(
        'forbidden',
        `This action needs the ${min} role. Ask a workspace owner to change your role in Settings → Members.`,
        {
          details: { needed: min, current: effective },
        },
      );
    }
    return s;
  }

  currentSession(): Session | null {
    const s = this.global.session;
    if (!s) return null;
    if (s.expiresAt <= this.now()) return null;
    return s;
  }

  listFixtureIdentities(): Identity[] {
    return this.global.users
      .map((user) => {
        const m = this.global.members.find((x) => x.userId === user.id);
        const workspace = this.global.workspaces.find((w) => w.id === m?.workspaceId);
        if (!m || !workspace) return null;
        return { user, workspace, role: m.role };
      })
      .filter((x): x is Identity => !!x);
  }

  async signIn(email: string): Promise<Session> {
    const user = this.global.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user)
      throw new ServiceError(
        'not_found',
        'No demo account uses that email. Pick one of the fixture identities or create a demo account.',
      );
    const m = this.global.members.find((x) => x.userId === user.id);
    if (!m) throw new ServiceError('forbidden', 'This account is not a member of any workspace.');
    return this.openSession(user, m.workspaceId, m.role);
  }

  private async openSession(user: User, workspaceId: string, role: Role): Promise<Session> {
    if (this.ws && this.ws.workspaceId !== workspaceId) this.unloadWorkspace();
    const session: Session = {
      token: this.nextId('sess'),
      userId: user.id,
      workspaceId,
      role,
      expiresAt: this.now() + SESSION_TTL_MS,
      mode: 'demo',
    };
    this.global.session = session;
    await this.persistNow();
    if (!this.ws) await this.loadWorkspace(workspaceId);
    return session;
  }

  async signUp(input: { email: string; name: string; workspaceName: string }): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new ServiceError('invalid_input', 'Enter a valid email address.', {
        details: { field: 'email' },
      });
    if (this.global.users.some((u) => u.email === email))
      throw new ServiceError('conflict', 'An account already uses that email. Sign in instead.', {
        details: { field: 'email' },
      });
    if (input.name.trim().length < 2)
      throw new ServiceError('invalid_input', 'Enter your name.', { details: { field: 'name' } });
    if (input.workspaceName.trim().length < 2)
      throw new ServiceError('invalid_input', 'Enter a workspace name.', {
        details: { field: 'workspaceName' },
      });
    const user: User = {
      id: this.nextId('u'),
      email,
      name: input.name.trim(),
      initials: input.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2),
      locale: 'en',
      createdAt: this.now(),
    };
    const workspace: Workspace = {
      id: this.nextId('ws'),
      name: input.workspaceName.trim(),
      slug: input.workspaceName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      ownerId: user.id,
      defaultAspect: '1:1',
      createdAt: this.now(),
    };
    this.global.users.push(user);
    this.global.workspaces.push(workspace);
    this.global.members.push({
      userId: user.id,
      workspaceId: workspace.id,
      role: 'owner',
      joinedAt: this.now(),
      name: user.name,
      email: user.email,
    });
    this.opts.defaultDataset = this.opts.defaultDataset ?? undefined;
    const prev = this.opts.defaultDataset;
    this.opts.defaultDataset = 'small';
    const s = await this.openSession(user, workspace.id, 'owner');
    this.opts.defaultDataset = prev;
    // A brand new workspace starts empty (the seed gives 3 sample projects; remove them for a true empty state)
    if (this.ws) {
      this.ws.projects = [];
      this.ws.workflows = [];
      this.ws.sceneRevisions = {};
      this.ws.artifacts = [];
      this.ws.subscription.creditsUsed = 0;
      await this.persistNow();
    }
    return s;
  }

  async signOut(): Promise<void> {
    // Only end the session that was current when sign-out started; a sign-out that completes
    // after a newer sign-in must not clobber it (stale-response rule).
    const token = this.global.session?.token;
    await this.persistNow();
    if (!token || this.global.session?.token !== token) return;
    this.global.session = null;
    this.unloadWorkspace();
    await this.persistNow();
  }

  requestRecovery(email: string): { simulatedLink: string } {
    const user = this.global.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    // Do not reveal whether the account exists; always produce a link, but only a real user's token works.
    const token = this.nextId('rec');
    if (user) this.global.recoveryTokens.push({ token, userId: user.id, expiresAt: this.now() + 3_600_000 });
    this.persistSoon();
    return { simulatedLink: `/app/recover?token=${token}` };
  }

  async completeRecovery(token: string): Promise<Session> {
    const rec = this.global.recoveryTokens.find((r) => r.token === token);
    if (!rec || rec.expiresAt < this.now())
      throw new ServiceError('not_found', 'This recovery link is invalid or expired. Request a new one.');
    this.global.recoveryTokens = this.global.recoveryTokens.filter((r) => r.token !== token);
    const user = this.global.users.find((u) => u.id === rec.userId)!;
    const m = this.global.members.find((x) => x.userId === user.id)!;
    return this.openSession(user, m.workspaceId, m.role);
  }

  me(): Identity {
    const s = this.requireSession();
    const user = this.global.users.find((u) => u.id === s.userId)!;
    const workspace = this.global.workspaces.find((w) => w.id === s.workspaceId)!;
    return { user, workspace, role: s.role };
  }

  // ---------- operations (idempotency) ----------

  private recallOperation<T>(operationId: string, resolve: (refId: string) => T | undefined): T | undefined {
    const ws = this.requireWs();
    const op = ws.operations[operationId];
    if (!op) return undefined;
    return resolve(op.refId);
  }

  private recordOperation(operationId: string, kind: string, refId: string): void {
    const ws = this.requireWs();
    ws.operations[operationId] = { kind, refId, at: this.now() };
    const keys = Object.keys(ws.operations);
    if (keys.length > RETENTION.operations) {
      for (const k of keys.slice(0, keys.length - RETENTION.operations)) delete ws.operations[k];
    }
  }

  // ---------- projects ----------

  listProjects(filter: ProjectFilter = {}): ProjectSummary[] {
    const ws = this.requireWs();
    const q = (filter.query ?? '').trim().toLowerCase();
    const status = filter.status ?? 'active';
    return ws.projects
      .filter((p) => (status === 'all' ? true : p.status === status))
      .filter((p) => (filter.templateSlug ? p.templateSlug === filter.templateSlug : true))
      .filter((p) =>
        q ? `${p.name} ${p.productName} ${p.templateSlug ?? ''}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => {
        const active = ws.runs.find((r) => r.projectId === p.id && !isTerminal(r.status));
        return {
          id: p.id,
          name: p.name,
          productName: p.productName,
          templateSlug: p.templateSlug,
          status: p.status,
          updatedAt: p.updatedAt,
          fixtureId: p.reference.fixtureId,
          activeRunStatus: active?.status,
          artifactCount: ws.artifacts.filter((a) => a.projectId === p.id).length,
        };
      });
  }

  getProject(id: string): ProjectDetail {
    const ws = this.requireWs();
    const project = ws.projects.find((p) => p.id === id);
    if (!project)
      throw new ServiceError(
        'not_found',
        'This project does not exist in the current workspace. It may have been deleted, or it belongs to another workspace.',
      );
    return { project, sceneRevisions: ws.sceneRevisions[id] ?? [] };
  }

  private touch(project: Project): void {
    project.updatedAt = this.now();
    this.persistSoon();
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    this.requireRole('editor');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (id) => ws.projects.find((p) => p.id === id));
    if (existing) return existing;
    if (!input.name.trim())
      throw new ServiceError('invalid_input', 'Give the project a name.', { details: { field: 'name' } });
    if (!input.productName.trim())
      throw new ServiceError('invalid_input', 'Enter the product name.', {
        details: { field: 'productName' },
      });
    if (!input.brief.goal.trim())
      throw new ServiceError('invalid_input', 'Describe the campaign goal.', { details: { field: 'goal' } });
    const plan = findPlan(ws.subscription.planId)!;
    const activeCount = ws.projects.filter((p) => p.status === 'active').length;
    if (plan.maxProjects !== 'unlimited' && activeCount >= plan.maxProjects) {
      throw new ServiceError(
        'usage_limit',
        `The ${plan.name} plan allows ${plan.maxProjects} active projects. Archive a project or upgrade to continue.`,
      );
    }
    const template = findTemplate(input.templateSlug) ?? TEMPLATES[0]!;
    const fixtureId = input.reference.fixtureId;
    const fixture = PRODUCT_FIXTURES[fixtureId];
    const id = this.nextId('proj');
    const workflowId = this.nextId('wf');
    let reference: Project['reference'] = { source: 'fixture', fixtureId };
    if (input.reference.source === 'upload') {
      const file = input.reference.file;
      const maxBytes = this.opts.scenario() === 'upload-reject' ? 200 * 1024 : 12 * 1024 * 1024;
      if (!file.type.startsWith('image/'))
        throw new ServiceError(
          'upload_rejected',
          `${input.reference.name} is not an image. Use PNG, JPG or WebP.`,
          { details: { field: 'reference', file: input.reference.name } },
        );
      if (file.size > maxBytes)
        throw new ServiceError(
          'upload_rejected',
          `${input.reference.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${Math.round(maxBytes / 1024 / 1024) || (maxBytes / 1024).toFixed(0) + ' K'}${maxBytes >= 1024 * 1024 ? ' MB' : 'B'}.`,
          { details: { field: 'reference', file: input.reference.name } },
        );
      const blobKey = `upload:${id}`;
      await this.opts.store.putBlob(blobKey, file);
      reference = {
        source: 'upload',
        fixtureId,
        uploadBlobKey: blobKey,
        uploadName: input.reference.name,
        uploadSizeBytes: file.size,
      };
    }
    const now = this.now();
    const project: Project = {
      id,
      workspaceId: ws.workspaceId,
      name: input.name.trim(),
      templateSlug: template.slug,
      productName: input.productName.trim(),
      productDescription: input.productDescription.trim(),
      brief: input.brief,
      reference,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      workflowId,
      sceneRevision: 1,
    };
    ws.projects.push(project);
    ws.workflows.push(buildWorkflowFromTemplate(workflowId, id, template, now));
    const scene: SceneDoc = {
      ...defaultScene(fixtureId, template.scene.materialColor ?? fixture.defaultColor),
      background: template.scene.background,
      light: template.scene.light,
      animation: { preset: template.scene.animation, durationSec: template.scene.durationSec },
    };
    const ad: AdComposition = {
      ...DEFAULT_AD,
      ...template.ad,
      headline: input.brief.keyMessage.trim() || template.ad.headline,
      aspect: input.brief.aspects[0] ?? template.aspects[0]!,
    };
    ws.sceneRevisions[id] = [
      { revision: 1, scene, ad, savedAt: now, source: 'template', note: `Created from ${template.name}` },
    ];
    if (reference.source === 'upload') {
      const artId = this.nextId('art');
      ws.artifacts.push({
        id: artId,
        projectId: id,
        nodeId: 'n-ref',
        kind: 'reference-image',
        title: `Reference · ${reference.uploadName}`,
        revision: 1,
        lineageId: `${id}:n-ref`,
        createdAt: now,
        preview: { kind: 'image', blobKey: reference.uploadBlobKey! },
        acceptance: 'unreviewed',
        provenance: {
          source: 'upload',
          note: 'Your uploaded reference image, stored locally in this browser.',
        },
        sizeBytes: reference.uploadSizeBytes,
        mime: input.reference.source === 'upload' ? input.reference.file.type : undefined,
        blobKey: reference.uploadBlobKey,
      });
    }
    this.recordOperation(input.operationId, 'project.create', id);
    await this.persistNow();
    return project;
  }

  renameProject(id: string, name: string): Project {
    this.requireRole('editor');
    const { project } = this.getProject(id);
    if (!name.trim())
      throw new ServiceError('invalid_input', 'Project name cannot be empty.', {
        details: { field: 'name' },
      });
    project.name = name.trim();
    this.touch(project);
    return project;
  }

  duplicateProject(id: string, operationId: string): Project {
    this.requireRole('editor');
    const ws = this.requireWs();
    const existing = this.recallOperation(operationId, (rid) => ws.projects.find((p) => p.id === rid));
    if (existing) return existing;
    const { project, sceneRevisions } = this.getProject(id);
    const wf = ws.workflows.find((w) => w.id === project.workflowId)!;
    const nid = this.nextId('proj');
    const wid = this.nextId('wf');
    const now = this.now();
    const copy: Project = {
      ...structuredClone(project),
      id: nid,
      name: `${project.name} (copy)`,
      workflowId: wid,
      createdAt: now,
      updatedAt: now,
      selectedArtifactId: undefined,
      lastRunId: undefined,
      status: 'active',
    };
    ws.projects.push(copy);
    ws.workflows.push({ ...structuredClone(wf), id: wid, projectId: nid, revision: 1, updatedAt: now });
    ws.sceneRevisions[nid] = sceneRevisions.map((r) => structuredClone(r));
    this.recordOperation(operationId, 'project.duplicate', nid);
    this.persistSoon();
    return copy;
  }

  archiveProject(id: string, archived: boolean): Project {
    this.requireRole('editor');
    const { project } = this.getProject(id);
    project.status = archived ? 'archived' : 'active';
    this.touch(project);
    return project;
  }

  async removeProject(id: string): Promise<void> {
    this.requireRole('owner');
    const ws = this.requireWs();
    const { project } = this.getProject(id);
    for (const r of ws.runs.filter((r) => r.projectId === id)) this.cancelRunInternal(r, 'Project deleted');
    const blobKeys = ws.artifacts.filter((a) => a.projectId === id && a.blobKey).map((a) => a.blobKey!);
    if (project.reference.uploadBlobKey) blobKeys.push(project.reference.uploadBlobKey);
    ws.projects = ws.projects.filter((p) => p.id !== id);
    ws.workflows = ws.workflows.filter((w) => w.projectId !== id);
    delete ws.sceneRevisions[id];
    ws.runs = ws.runs.filter((r) => r.projectId !== id);
    ws.artifacts = ws.artifacts.filter((a) => a.projectId !== id);
    ws.exportJobs = ws.exportJobs.filter((j) => j.projectId !== id);
    for (const k of blobKeys) await this.opts.store.delBlob(k);
    await this.persistNow();
  }

  saveScene(
    id: string,
    input: {
      scene: SceneDoc;
      ad: AdComposition;
      baseRevision: number;
      source: SceneRevision['source'];
      note?: string;
    },
  ): SceneRevision {
    this.requireRole('editor');
    const ws = this.requireWs();
    const { project } = this.getProject(id);
    if (input.baseRevision !== project.sceneRevision) {
      throw new ServiceError(
        'conflict',
        `The scene was saved elsewhere (revision ${project.sceneRevision}). Reload to pick up the latest revision before saving.`,
      );
    }
    const rev: SceneRevision = {
      revision: project.sceneRevision + 1,
      scene: structuredClone(input.scene),
      ad: structuredClone(input.ad),
      savedAt: this.now(),
      source: input.source,
      note: input.note,
    };
    const list = ws.sceneRevisions[id] ?? [];
    ws.sceneRevisions[id] = list;
    list.push(rev);
    while (list.length > RETENTION.sceneRevisionsPerProject) list.shift();
    project.sceneRevision = rev.revision;
    this.touch(project);
    return rev;
  }

  selectArtifact(id: string, artifactId: string | undefined): Project {
    this.requireRole('editor');
    const { project } = this.getProject(id);
    if (artifactId) this.getArtifact(artifactId);
    project.selectedArtifactId = artifactId;
    project.selectedArtifactPinned = artifactId !== undefined;
    this.touch(project);
    return project;
  }

  async readBlob(blobKey: string): Promise<Blob | null> {
    this.requireWs();
    return (await this.opts.store.getBlob(blobKey)) ?? null;
  }

  // ---------- workflows ----------

  getWorkflow(workflowId: string): WorkflowDoc {
    const ws = this.requireWs();
    const wf = ws.workflows.find((w) => w.id === workflowId);
    if (!wf) throw new ServiceError('not_found', 'Workflow not found.');
    return wf;
  }

  saveWorkflow(doc: WorkflowDoc, baseRevision: number): WorkflowDoc {
    this.requireRole('editor');
    const ws = this.requireWs();
    const idx = ws.workflows.findIndex((w) => w.id === doc.id);
    if (idx < 0) throw new ServiceError('not_found', 'Workflow not found.');
    const current = ws.workflows[idx]!;
    if (current.revision !== baseRevision)
      throw new ServiceError(
        'conflict',
        `Workflow changed elsewhere (revision ${current.revision}). Reload before saving.`,
      );
    const saved: WorkflowDoc = {
      ...structuredClone(doc),
      revision: current.revision + 1,
      updatedAt: this.now(),
    };
    ws.workflows[idx] = saved;
    const project = ws.projects.find((p) => p.id === doc.projectId);
    if (project) this.touch(project);
    else this.persistSoon();
    return saved;
  }

  applyTemplate(projectId: string, templateSlug: string): WorkflowDoc {
    this.requireRole('editor');
    const ws = this.requireWs();
    const { project } = this.getProject(projectId);
    const t = findTemplate(templateSlug);
    if (!t) throw new ServiceError('not_found', 'Template not found.');
    const idx = ws.workflows.findIndex((w) => w.id === project.workflowId);
    const current = ws.workflows[idx]!;
    const doc = buildWorkflowFromTemplate(current.id, projectId, t, this.now());
    doc.revision = current.revision + 1;
    ws.workflows[idx] = doc;
    project.templateSlug = t.slug;
    this.touch(project);
    return doc;
  }

  // ---------- runs & engine ----------

  private registerTaskHandlers(): void {
    this.scheduler.on('run.start', (t) => this.taskRunStart(t));
    this.scheduler.on('step.tick', (t) => this.taskStepTick(t));
    this.scheduler.on('run.settle-cancel', (t) => this.taskSettleCancel(t));
    this.scheduler.on('export.tick', (t) => this.taskExportTick(t));
    this.scheduler.on('checkout.confirm', (t) => this.taskCheckoutConfirm(t));
  }

  listRuns(projectId: string): Run[] {
    const ws = this.requireWs();
    return ws.runs.filter((r) => r.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
  }

  activeRuns(): Run[] {
    const ws = this.requireWs();
    return ws.runs.filter((r) => !isTerminal(r.status)).sort((a, b) => b.createdAt - a.createdAt);
  }

  getRun(runId: string): Run {
    const ws = this.requireWs();
    const r = ws.runs.find((x) => x.id === runId);
    if (!r) throw new ServiceError('not_found', 'Run not found.');
    return r;
  }

  private emit(run: Run, type: RunEventType, payload: Record<string, unknown> = {}): void {
    const ws = this.requireWs();
    run.lastSeq += 1;
    const ev: RunEvent = { seq: run.lastSeq, runId: run.id, at: this.now(), type, payload };
    const log = ws.events[run.id] ?? { firstSeq: 1, items: [] };
    ws.events[run.id] = log;
    log.items.push(ev);
    while (log.items.length > RETENTION.eventsPerRun) {
      log.items.shift();
      log.firstSeq = log.items[0]?.seq ?? run.lastSeq + 1;
    }
    this.persistSoon();
    for (const l of this.runListeners.get(run.id) ?? []) l(ev);
    for (const l of this.runListeners.get('*') ?? []) l(ev);
  }

  private setStatus(run: Run, to: RunStatus): void {
    if (!canTransition(run.status, to))
      throw new ServiceError('conflict', `Cannot move a ${run.status} run to ${to}.`);
    run.status = to;
  }

  startRun(input: {
    projectId: string;
    workflowId: string;
    operationId: string;
    onlyNodeId?: string;
    retryOf?: string;
  }): Run {
    this.requireRole('editor');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (rid) => ws.runs.find((r) => r.id === rid));
    if (existing) return existing;
    const { project } = this.getProject(input.projectId);
    const wf = this.getWorkflow(input.workflowId);
    if (ws.runs.some((r) => r.projectId === project.id && !isTerminal(r.status))) {
      throw new ServiceError(
        'conflict',
        'A run is already active for this project. Cancel it or wait for it to finish.',
      );
    }
    let steps = executableSteps(wf);
    if (input.onlyNodeId) steps = steps.filter((s) => s.node.id === input.onlyNodeId);
    if (steps.length === 0)
      throw new ServiceError(
        'invalid_input',
        'Nothing to run: add an executable step such as Build 3D model.',
      );
    const missing = steps.find((s) => s.missing.length > 0);
    if (missing)
      throw new ServiceError(
        'invalid_input',
        `Connect ${missing.missing.join(' and ')} to "${this.stepTitle(missing.node)}" before running.`,
        { details: { nodeId: missing.node.id } },
      );
    // Retry reuses artifacts from steps that already succeeded in the previous run.
    const prior = input.retryOf ? ws.runs.find((r) => r.id === input.retryOf) : undefined;
    const runSteps: RunStep[] = steps.map((s) => {
      const priorStep = prior?.steps.find(
        (p) => p.nodeId === s.node.id && p.status === 'completed' && p.artifactId,
      );
      return priorStep
        ? {
            nodeId: s.node.id,
            title: this.stepTitle(s.node),
            status: 'skipped',
            artifactId: priorStep.artifactId,
          }
        : { nodeId: s.node.id, title: this.stepTitle(s.node), status: 'pending' };
    });
    const credits = steps
      .filter((s) => !runSteps.find((r) => r.nodeId === s.node.id && r.status === 'skipped'))
      .reduce((sum, s) => sum + NODE_KINDS[s.node.kind].credits, 0);
    if (ws.subscription.creditsUsed + credits > ws.subscription.creditsIncluded) {
      throw new ServiceError(
        'usage_limit',
        `This run needs ${credits} credits but only ${ws.subscription.creditsIncluded - ws.subscription.creditsUsed} remain this month. Upgrade in Settings → Usage & billing, or wait for the reset.`,
      );
    }
    const run: Run = {
      id: this.nextId('run'),
      projectId: project.id,
      workflowId: wf.id,
      workflowRevision: wf.revision,
      operationId: input.operationId,
      status: 'draft',
      steps: runSteps,
      createdAt: this.now(),
      creditsReserved: credits,
      creditsCharged: 0,
      retryOf: input.retryOf,
      lastSeq: 0,
    };
    ws.runs.push(run);
    this.pruneRuns(project.id);
    project.lastRunId = run.id;
    this.setStatus(run, 'queued');
    this.recordOperation(input.operationId, 'run.start', run.id);
    this.emit(run, 'run.accepted', { steps: run.steps.length, credits });
    this.scheduler.schedule('run.start', this.opts.latency().queueMs, { runId: run.id });
    this.touch(project);
    return run;
  }

  private stepTitle(node: WorkflowDoc['nodes'][number]): string {
    return node.title || NODE_KINDS[node.kind].title;
  }

  private pruneRuns(projectId: string): void {
    const ws = this.requireWs();
    const runs = ws.runs
      .filter((r) => r.projectId === projectId && isTerminal(r.status))
      .sort((a, b) => a.createdAt - b.createdAt);
    while (runs.length > RETENTION.runsPerProject) {
      const victim = runs.shift()!;
      ws.runs = ws.runs.filter((r) => r.id !== victim.id);
      delete ws.events[victim.id];
    }
  }

  private taskRunStart(t: ScheduledTask): void {
    const run = this.ws?.runs.find((r) => r.id === t.payload.runId);
    if (run?.status !== 'queued') return;
    this.setStatus(run, 'running');
    run.startedAt = this.now();
    this.emit(run, 'run.started', {});
    this.advanceRun(run);
  }

  /** Starts the next pending step or finishes the run. */
  private advanceRun(run: Run): void {
    if (run.status !== 'running') return;
    const next = run.steps.find((s) => s.status === 'pending');
    if (!next) {
      this.finishRun(run);
      return;
    }
    const wf = this.getWorkflow(run.workflowId);
    const node = wf.nodes.find((n) => n.id === next.nodeId)!;
    next.status = 'running';
    next.startedAt = this.now();
    const total = this.unitsFor(node.kind, wf, run);
    next.progress = { done: 0, total: total.total, unit: total.unit };
    this.emit(run, 'step.started', {
      nodeId: node.id,
      title: next.title,
      total: total.total,
      unit: total.unit,
    });
    this.scheduleTick(run, node.id, total.total);
  }

  private unitsFor(kind: string, _wf: WorkflowDoc, run: Run): { total: number; unit: string } {
    const project = this.ws!.projects.find((p) => p.id === run.projectId)!;
    const rev = (this.ws!.sceneRevisions[project.id] ?? []).at(-1)!;
    switch (kind) {
      case 'image-gen':
      case 'image-edit':
        return { total: 4, unit: 'steps' };
      case 'image-upscale':
        return { total: 6, unit: 'tiles' };
      case 'video-gen':
        return { total: 16, unit: 'frames' };
      case 'tts':
        return { total: 3, unit: 'segments' };
      case 'reconstruct':
        return { total: 12, unit: 'views' };
      case 'scene':
        return { total: 3, unit: 'passes' };
      case 'animation':
        return { total: Math.max(8, rev.scene.animation.durationSec * 4), unit: 'frames' };
      case 'ad-variants':
        return { total: Math.max(1, project.brief.aspects.length), unit: 'variants' };
      case 'export':
        return { total: 2, unit: 'files' };
      default:
        return { total: 1, unit: 'steps' };
    }
  }

  private scheduleTick(run: Run, nodeId: string, total: number): void {
    const p = this.opts.latency();
    const stepMs = p.stepMinMs + (p.stepMaxMs - p.stepMinMs) * this.pseudoRandom(run.id + nodeId);
    const perTick = Math.max(30, Math.round(stepMs / total));
    this.scheduler.schedule('step.tick', perTick, { runId: run.id, nodeId });
  }

  private pseudoRandom(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return ((h >>> 0) % 1000) / 1000;
  }

  private taskStepTick(t: ScheduledTask): void {
    const run = this.ws?.runs.find((r) => r.id === t.payload.runId);
    if (run?.status !== 'running') return; // late ticks for cancelled/paused runs are dropped
    const step = run.steps.find((s) => s.nodeId === t.payload.nodeId);
    if (step?.status !== 'running' || !step.progress) return;
    step.progress.done += 1;
    const wf = this.getWorkflow(run.workflowId);
    const node = wf.nodes.find((n) => n.id === step.nodeId)!;
    const scenario = this.opts.scenario();
    const ratio = step.progress.done / step.progress.total;
    if (
      (scenario === 'run-failure' && node.kind === 'reconstruct' && ratio >= 0.6) ||
      (scenario === 'partial-result' && node.kind === 'animation' && ratio >= 0.5)
    ) {
      step.status = 'failed';
      step.finishedAt = this.now();
      step.error =
        node.kind === 'reconstruct'
          ? 'Model build stopped: the demo engine reported an unsupported silhouette at view 8/12.'
          : 'Animation render stopped: frame buffer allocation failed in the demo engine.';
      this.emit(run, 'step.failed', { nodeId: node.id, error: step.error });
      for (const s of run.steps) if (s.status === 'pending') s.status = 'skipped';
      this.setStatus(run, 'failed');
      run.finishedAt = this.now();
      run.error = `${step.title} failed. ${step.error}`;
      this.chargeRun(run);
      this.emit(run, 'run.failed', {
        error: run.error,
        retainedArtifacts: run.steps.filter((s) => s.artifactId).length,
      });
      this.notify('runFailed', 'Run failed', run.error);
      return;
    }
    if (
      scenario === 'waiting-input' &&
      node.kind === 'ad-variants' &&
      ratio >= 0.5 &&
      !run.inputRequest &&
      !run.inputAnswers?.[node.id]
    ) {
      run.inputRequest = {
        nodeId: node.id,
        question: 'Which layout should the ad variants use?',
        options: ['text-left', 'text-bottom', 'centered'],
      };
      this.setStatus(run, 'waiting_input');
      this.emit(run, 'run.waiting_input', { ...run.inputRequest });
      return;
    }
    this.emit(run, 'step.progress', {
      nodeId: node.id,
      done: step.progress.done,
      total: step.progress.total,
      unit: step.progress.unit,
    });
    if (step.progress.done >= step.progress.total) {
      this.completeStep(run, step, node);
      this.advanceRun(run);
    } else {
      this.scheduleTick(run, node.id, step.progress.total);
    }
  }

  private completeStep(run: Run, step: RunStep, node: WorkflowDoc['nodes'][number]): void {
    const ws = this.requireWs();
    const project = ws.projects.find((p) => p.id === run.projectId)!;
    const rev = (ws.sceneRevisions[project.id] ?? []).at(-1)!;
    const fixtureId = project.reference.fixtureId;
    const created: Artifact[] = [];
    const mk = (
      kind: Artifact['kind'],
      title: string,
      lineageKey: string,
      extra: Partial<Artifact> = {},
    ): Artifact => {
      const lineageId = `${project.id}:${node.id}:${lineageKey}`;
      const prev = ws.artifacts
        .filter((a) => a.lineageId === lineageId)
        .sort((a, b) => b.revision - a.revision)[0];
      const art: Artifact = {
        id: this.nextId('art'),
        projectId: project.id,
        runId: run.id,
        nodeId: node.id,
        kind,
        title: `${title} · v${(prev?.revision ?? 0) + 1}`,
        revision: (prev?.revision ?? 0) + 1,
        lineageId,
        createdAt: this.now(),
        preview: { kind: 'fixture', fixtureId },
        acceptance: 'unreviewed',
        provenance: {
          source: 'engine-demo',
          note:
            project.reference.source === 'upload'
              ? 'Demonstration fixture. Not reconstructed from your uploaded image.'
              : 'Demonstration fixture produced by the simulated engine.',
        },
        ...extra,
      };
      if (prev) prev.supersededBy = art.id;
      ws.artifacts.push(art);
      created.push(art);
      return art;
    };
    const promptNote =
      typeof node.settings.prompt === 'string' && node.settings.prompt.trim()
        ? ` Prompt: “${node.settings.prompt.trim().slice(0, 80)}”.`
        : '';
    switch (node.kind) {
      case 'image-gen':
      case 'image-edit':
      case 'image-upscale':
        mk(
          'image',
          node.kind === 'image-gen'
            ? 'Generated image'
            : node.kind === 'image-edit'
              ? 'Edited image'
              : 'Upscaled image',
          'image',
          {
            scene: rev.scene,
            provenance: {
              source: 'engine-demo',
              note: `Demonstration fixture render; not generated from the prompt.${promptNote}`,
            },
          },
        );
        break;
      case 'video-gen':
        mk('clip', 'Generated video', 'video', {
          scene: rev.scene,
          provenance: {
            source: 'engine-demo',
            note: `Demonstration fixture clip; not generated from the prompt.${promptNote}`,
          },
        });
        break;
      case 'tts': {
        const text = typeof node.settings.prompt === 'string' ? node.settings.prompt : '';
        const blob = synthTone(Math.min(6, Math.max(1.5, text.length / 18)));
        const art = mk('audio', 'Voice-over (synthetic tone)', 'audio', {
          mime: 'audio/wav',
          sizeBytes: blob.size,
          preview: { kind: 'none' },
          provenance: {
            source: 'engine-demo',
            note: `Synthetic tone standing in for speech; not a voice.${promptNote}`,
          },
        });
        art.blobKey = `artifact:${art.id}`;
        void this.opts.store.putBlob(art.blobKey, blob);
        break;
      }
      case 'reconstruct':
        mk('model', `${PRODUCT_FIXTURES[fixtureId].name} model`, 'model', { scene: rev.scene });
        break;
      case 'scene':
        mk('scene', 'Scene', 'scene', {
          scene: this.sceneFromSettings(rev.scene, node.settings),
          ad: rev.ad,
        });
        break;
      case 'animation':
        mk('clip', `${String(node.settings.preset ?? rev.scene.animation.preset)} clip`, 'clip', {
          scene: this.sceneFromSettings(rev.scene, node.settings),
          ad: rev.ad,
        });
        break;
      case 'ad-variants': {
        const layout =
          typeof node.settings.layout === 'string'
            ? (node.settings.layout as AdComposition['layout'])
            : rev.ad.layout;
        for (const aspect of project.brief.aspects) {
          mk('ad-variant', `Ad ${aspect}`, aspect, {
            scene: this.sceneFromSettings(rev.scene, node.settings),
            ad: { ...rev.ad, aspect, layout },
          });
        }
        break;
      }
      case 'export': {
        const payload = JSON.stringify(
          {
            project: project.name,
            scene: rev.scene,
            ad: rev.ad,
            exportedAt: this.now(),
            note: 'Editable scene data from the demo workspace.',
          },
          null,
          2,
        );
        const blob = new Blob([payload], { type: 'application/json' });
        const art = mk('export', 'Scene JSON', 'export-json', {
          mime: 'application/json',
          sizeBytes: blob.size,
          preview: { kind: 'none' },
          provenance: { source: 'engine-demo', note: 'Real JSON of the saved scene and composition.' },
        });
        art.blobKey = `artifact:${art.id}`;
        void this.opts.store.putBlob(art.blobKey, blob);
        break;
      }
    }
    step.status = 'completed';
    step.finishedAt = this.now();
    step.artifactId = created[0]?.id;
    this.emit(run, 'step.completed', { nodeId: node.id, artifactIds: created.map((a) => a.id) });
    for (const a of created) {
      this.emit(run, 'artifact.created', {
        artifactId: a.id,
        kind: a.kind,
        title: a.title,
        revision: a.revision,
        lineageId: a.lineageId,
      });
      // Only the project's latest run may auto-select, and only when nothing newer is selected.
      if (a.kind === 'ad-variant' && project.lastRunId === run.id && !project.selectedArtifactPinned) {
        const sel = project.selectedArtifactId
          ? ws.artifacts.find((x) => x.id === project.selectedArtifactId)
          : undefined;
        if (!sel || (sel.lineageId === a.lineageId && sel.revision < a.revision))
          project.selectedArtifactId = a.id;
      }
    }
  }

  private sceneFromSettings(base: SceneDoc, settings: Record<string, string | number | boolean>): SceneDoc {
    const s = structuredClone(base);
    if (typeof settings.background === 'string') s.background = settings.background as SceneDoc['background'];
    if (typeof settings.light === 'string') s.light = settings.light as SceneDoc['light'];
    if (typeof settings.preset === 'string')
      s.animation.preset = settings.preset as SceneDoc['animation']['preset'];
    if (typeof settings.durationSec === 'number') s.animation.durationSec = settings.durationSec;
    return s;
  }

  private finishRun(run: Run): void {
    this.setStatus(run, 'completed');
    run.finishedAt = this.now();
    this.chargeRun(run);
    this.emit(run, 'run.completed', {
      artifacts: run.steps.filter((s) => s.artifactId).length,
      creditsCharged: run.creditsCharged,
    });
    this.notify(
      'runCompleted',
      'Run completed',
      `${run.steps.filter((s) => s.status === 'completed').length} steps finished. Outputs are ready for review.`,
    );
  }

  private chargeRun(run: Run): void {
    const ws = this.requireWs();
    if (ws.usage.some((u) => u.refId === run.id)) return; // never charge twice
    const done = run.steps.filter((s) => s.status === 'completed' || s.status === 'failed');
    const wf = this.getWorkflow(run.workflowId);
    const credits = done.reduce((sum, s) => {
      const node = wf.nodes.find((n) => n.id === s.nodeId);
      return sum + (node ? NODE_KINDS[node.kind].credits : 0);
    }, 0);
    run.creditsCharged = credits;
    ws.subscription.creditsUsed += credits;
    ws.usage.unshift({
      id: this.nextId('use'),
      workspaceId: ws.workspaceId,
      at: this.now(),
      kind: 'run',
      refId: run.id,
      credits,
      operationId: run.operationId,
    });
    while (ws.usage.length > RETENTION.usageRecords) ws.usage.pop();
  }

  cancelRun(runId: string, operationId: string): Run {
    this.requireRole('editor');
    const run = this.getRun(runId);
    if (isTerminal(run.status) || run.status === 'cancelling') return run;
    const ws = this.requireWs();
    if (ws.operations[operationId]) return run;
    this.recordOperation(operationId, 'run.cancel', run.id);
    this.cancelRunInternal(run, 'Cancelled by user');
    return run;
  }

  private cancelRunInternal(run: Run, reason: string): void {
    if (isTerminal(run.status) || run.status === 'cancelling') return;
    this.setStatus(run, 'cancelling');
    run.inputRequest = undefined;
    this.scheduler.cancelWhere((t) => t.kind === 'step.tick' && t.payload.runId === run.id);
    this.scheduler.cancelWhere((t) => t.kind === 'run.start' && t.payload.runId === run.id);
    this.emit(run, 'run.cancelling', { reason });
    this.scheduler.schedule('run.settle-cancel', 350, { runId: run.id });
  }

  private taskSettleCancel(t: ScheduledTask): void {
    const run = this.ws?.runs.find((r) => r.id === t.payload.runId);
    if (run?.status !== 'cancelling') return;
    for (const s of run.steps) {
      if (s.status === 'running') s.status = 'cancelled';
      if (s.status === 'pending') s.status = 'skipped';
    }
    this.setStatus(run, 'cancelled');
    run.finishedAt = this.now();
    this.chargeRun(run);
    this.emit(run, 'run.cancelled', { retainedArtifacts: run.steps.filter((s) => s.artifactId).length });
  }

  retryRun(runId: string, operationId: string): Run {
    const prior = this.getRun(runId);
    if (!isTerminal(prior.status))
      throw new ServiceError('conflict', 'Wait for the run to finish or cancel it before retrying.');
    return this.startRun({
      projectId: prior.projectId,
      workflowId: prior.workflowId,
      operationId,
      retryOf: prior.id,
    });
  }

  pauseRun(runId: string): Run {
    this.requireRole('editor');
    const run = this.getRun(runId);
    if (run.status !== 'running') throw new ServiceError('conflict', 'Only a running run can be paused.');
    this.setStatus(run, 'paused');
    this.scheduler.cancelWhere((t) => t.kind === 'step.tick' && t.payload.runId === run.id);
    this.emit(run, 'run.paused', {});
    return run;
  }

  resumeRun(runId: string): Run {
    this.requireRole('editor');
    const run = this.getRun(runId);
    if (run.status !== 'paused') throw new ServiceError('conflict', 'Only a paused run can be resumed.');
    this.setStatus(run, 'running');
    this.emit(run, 'run.resumed', {});
    const step = run.steps.find((s) => s.status === 'running');
    if (step?.progress) this.scheduleTick(run, step.nodeId, step.progress.total);
    else this.advanceRun(run);
    return run;
  }

  answerInput(runId: string, answer: string): Run {
    this.requireRole('editor');
    const run = this.getRun(runId);
    if (run.status !== 'waiting_input' || !run.inputRequest)
      throw new ServiceError('conflict', 'This run is not waiting for input.');
    if (!run.inputRequest.options.includes(answer))
      throw new ServiceError('invalid_input', `Choose one of: ${run.inputRequest.options.join(', ')}.`);
    const wf = this.getWorkflow(run.workflowId);
    const step = run.steps.find((s) => s.status === 'running');
    const node = step ? wf.nodes.find((n) => n.id === step.nodeId) : undefined;
    if (node) node.settings = { ...node.settings, layout: answer };
    run.inputAnswers = { ...(run.inputAnswers ?? {}), [run.inputRequest.nodeId]: answer };
    run.inputRequest = undefined;
    this.setStatus(run, 'running');
    this.emit(run, 'run.resumed', { answer });
    if (step?.progress) this.scheduleTick(run, step.nodeId, step.progress.total);
    return run;
  }

  replay(runId: string, cursor: number): EventReplay {
    const ws = this.requireWs();
    const run = this.getRun(runId);
    const log = ws.events[runId] ?? { firstSeq: 1, items: [] };
    const gap = cursor + 1 < log.firstSeq && cursor < run.lastSeq;
    const events = gap ? log.items.slice() : log.items.filter((e) => e.seq > cursor);
    return { events, gap, snapshot: structuredClone(run), cursor: run.lastSeq };
  }

  subscribeRun(runId: string, listener: Listener<RunEvent>): () => void {
    const set = this.runListeners.get(runId) ?? new Set();
    set.add(listener);
    this.runListeners.set(runId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.runListeners.delete(runId);
    };
  }

  // ---------- artifacts ----------

  listArtifacts(
    filter: { query?: string; kind?: string; projectId?: string; acceptance?: string } = {},
  ): Artifact[] {
    const ws = this.requireWs();
    const q = (filter.query ?? '').trim().toLowerCase();
    return ws.artifacts
      .filter((a) => (filter.projectId ? a.projectId === filter.projectId : true))
      .filter((a) => (filter.kind && filter.kind !== 'all' ? a.kind === filter.kind : true))
      .filter((a) =>
        filter.acceptance && filter.acceptance !== 'all' ? a.acceptance === filter.acceptance : true,
      )
      .filter((a) => (q ? `${a.title} ${a.kind} ${a.provenance.note}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getArtifact(id: string): Artifact {
    const ws = this.requireWs();
    if (this.opts.scenario() === 'missing-artifact')
      throw new ServiceError(
        'not_found',
        'This artifact is no longer available. It may have been removed from storage or belong to a deleted project.',
      );
    const a = ws.artifacts.find((x) => x.id === id);
    if (!a) throw new ServiceError('not_found', 'This artifact does not exist in the current workspace.');
    return a;
  }

  versions(lineageId: string): Artifact[] {
    const ws = this.requireWs();
    return ws.artifacts.filter((a) => a.lineageId === lineageId).sort((a, b) => b.revision - a.revision);
  }

  setAcceptance(id: string, acceptance: Artifact['acceptance']): Artifact {
    this.requireRole('editor');
    const a = this.getArtifact(id);
    a.acceptance = acceptance;
    const p = this.ws!.projects.find((x) => x.id === a.projectId);
    if (p) this.touch(p);
    return a;
  }

  async storeBrowserExport(input: {
    projectId: string;
    sourceArtifactId: string;
    preset: ExportPresetId;
    blob: Blob;
    filename: string;
    operationId: string;
    scene?: SceneDoc;
    ad?: AdComposition;
  }): Promise<Artifact> {
    this.requireRole('editor');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (id) => ws.artifacts.find((a) => a.id === id));
    if (existing) return existing;
    const preset = EXPORT_PRESETS.find((p) => p.id === input.preset)!;
    this.getProject(input.projectId);
    const src = input.sourceArtifactId ? this.getArtifact(input.sourceArtifactId) : undefined;
    const lineageId = `${input.projectId}:${src?.nodeId ?? 'manual'}:export-${preset.id}`;
    const prev = ws.artifacts
      .filter((a) => a.lineageId === lineageId)
      .sort((a, b) => b.revision - a.revision)[0];
    const art: Artifact = {
      id: this.nextId('art'),
      projectId: input.projectId,
      runId: src?.runId,
      nodeId: src?.nodeId,
      kind: 'export',
      title: `${preset.title} · v${(prev?.revision ?? 0) + 1}`,
      revision: (prev?.revision ?? 0) + 1,
      lineageId,
      createdAt: this.now(),
      preview: preset.id === 'png-snapshot' ? { kind: 'image', blobKey: '' } : { kind: 'none' },
      acceptance: 'unreviewed',
      provenance: {
        source: 'browser',
        note: `${preset.label}. ${src ? `Derived from ${src.title}.` : 'From the working scene.'}`,
      },
      sizeBytes: input.blob.size,
      mime: preset.mime,
      scene: input.scene ?? src?.scene,
      ad: input.ad ?? src?.ad,
    };
    art.blobKey = `artifact:${art.id}`;
    if (art.preview.kind === 'image') art.preview = { kind: 'image', blobKey: art.blobKey };
    await this.opts.store.putBlob(art.blobKey, input.blob);
    if (prev) prev.supersededBy = art.id;
    ws.artifacts.push(art);
    this.recordOperation(input.operationId, 'export.store', art.id);
    await this.persistNow();
    return art;
  }

  async download(id: string): Promise<{ blob: Blob; filename: string; mime: string }> {
    const a = this.getArtifact(id);
    if (!a.blobKey)
      throw new ServiceError('not_found', 'This artifact has no downloadable file. Export it first.');
    const blob = await this.opts.store.getBlob(a.blobKey);
    if (!blob)
      throw new ServiceError('not_found', 'The stored file for this artifact is missing from local storage.');
    const ext =
      a.mime === 'image/png'
        ? 'png'
        : a.mime === 'video/webm'
          ? 'webm'
          : a.mime === 'video/mp4'
            ? 'mp4'
            : a.mime === 'application/json'
              ? 'json'
              : a.mime?.startsWith('image/')
                ? (a.mime.split('/')[1] ?? 'bin')
                : 'bin';
    const filename = `${a.title
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()}.${ext}`;
    return { blob, filename, mime: a.mime ?? blob.type };
  }

  // ---------- exports (simulated render queue) ----------

  listExportJobs(projectId?: string): ExportJob[] {
    const ws = this.requireWs();
    return ws.exportJobs
      .filter((j) => (projectId ? j.projectId === projectId : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  enqueueExport(input: {
    projectId: string;
    artifactId: string;
    preset: ExportPresetId;
    operationId: string;
  }): ExportJob {
    this.requireRole('editor');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (id) => ws.exportJobs.find((j) => j.id === id));
    if (existing) return existing;
    const preset = EXPORT_PRESETS.find((p) => p.id === input.preset);
    if (preset?.mode !== 'queue')
      throw new ServiceError('invalid_input', 'Only queued presets can be enqueued.');
    const plan = findPlan(ws.subscription.planId)!;
    if (!plan.exportPresets.includes('MP4 render'))
      throw new ServiceError(
        'usage_limit',
        `MP4 renders are not included in the ${plan.name} plan. Upgrade to Studio or Team to queue video renders.`,
      );
    if (ws.subscription.creditsUsed + preset.credits > ws.subscription.creditsIncluded)
      throw new ServiceError('usage_limit', 'Not enough credits left this month for a render.');
    const src = this.getArtifact(input.artifactId);
    const job: ExportJob = {
      id: this.nextId('exp'),
      projectId: input.projectId,
      artifactId: src.id,
      preset: preset.id,
      operationId: input.operationId,
      status: 'queued',
      createdAt: this.now(),
      progress: { done: 0, total: 24, unit: 'frames' },
      filename: `${src.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-sample.${preset.extension}`,
    };
    ws.exportJobs.unshift(job);
    while (ws.exportJobs.length > RETENTION.exportJobs) ws.exportJobs.pop();
    this.recordOperation(input.operationId, 'export.enqueue', job.id);
    this.persistSoon();
    this.scheduler.schedule('export.tick', this.opts.latency().queueMs, { jobId: job.id });
    this.emitExport(job);
    return job;
  }

  cancelExport(jobId: string): ExportJob {
    this.requireRole('editor');
    const ws = this.requireWs();
    const job = ws.exportJobs.find((j) => j.id === jobId);
    if (!job) throw new ServiceError('not_found', 'Export job not found.');
    if (job.status === 'queued' || job.status === 'rendering') {
      job.status = 'cancelled';
      job.finishedAt = this.now();
      this.scheduler.cancelWhere((t) => t.kind === 'export.tick' && t.payload.jobId === job.id);
      this.persistSoon();
      this.emitExport(job);
    }
    return job;
  }

  private emitExport(job: ExportJob): void {
    for (const l of this.exportListeners) l(structuredClone(job));
  }

  subscribeExports(l: Listener<ExportJob>): () => void {
    this.exportListeners.add(l);
    return () => this.exportListeners.delete(l);
  }

  private taskExportTick(t: ScheduledTask): void {
    const ws = this.ws;
    const job = ws?.exportJobs.find((j) => j.id === t.payload.jobId);
    if (!ws || !job || (job.status !== 'queued' && job.status !== 'rendering')) return;
    if (job.status === 'queued') job.status = 'rendering';
    job.progress!.done += 1;
    if (job.progress!.done >= job.progress!.total) {
      void this.completeExport(job);
      return;
    }
    this.persistSoon();
    this.emitExport(job);
    const p = this.opts.latency();
    this.scheduler.schedule(
      'export.tick',
      Math.max(20, Math.round((p.stepMinMs + p.stepMaxMs) / 2 / job.progress!.total)),
      { jobId: job.id },
    );
  }

  private async completeExport(job: ExportJob): Promise<void> {
    const ws = this.requireWs();
    try {
      const res = await fetch(this.opts.sampleMp4Url);
      if (!res.ok) throw new Error(`sample fetch ${res.status}`);
      const blob = new Blob([await res.arrayBuffer()], { type: 'video/mp4' });
      const src = ws.artifacts.find((a) => a.id === job.artifactId);
      const lineageId = `${job.projectId}:${src?.nodeId ?? 'manual'}:export-mp4`;
      const prev = ws.artifacts
        .filter((a) => a.lineageId === lineageId)
        .sort((a, b) => b.revision - a.revision)[0];
      const art: Artifact = {
        id: this.nextId('art'),
        projectId: job.projectId,
        runId: src?.runId,
        nodeId: src?.nodeId,
        kind: 'export',
        title: `MP4 render (sample) · v${(prev?.revision ?? 0) + 1}`,
        revision: (prev?.revision ?? 0) + 1,
        lineageId,
        createdAt: this.now(),
        preview: { kind: 'none' },
        acceptance: 'unreviewed',
        provenance: {
          source: 'engine-demo',
          note: 'Sample media from the demo render queue. This file is NOT a render of your edited scene.',
        },
        sizeBytes: blob.size,
        mime: 'video/mp4',
        scene: src?.scene,
        ad: src?.ad,
      };
      art.blobKey = `artifact:${art.id}`;
      await this.opts.store.putBlob(art.blobKey, blob);
      if (prev) prev.supersededBy = art.id;
      ws.artifacts.push(art);
      job.status = 'completed';
      job.finishedAt = this.now();
      job.resultArtifactId = art.id;
      if (!ws.usage.some((u) => u.refId === job.id)) {
        ws.subscription.creditsUsed += 1;
        ws.usage.unshift({
          id: this.nextId('use'),
          workspaceId: ws.workspaceId,
          at: this.now(),
          kind: 'export',
          refId: job.id,
          credits: 1,
          operationId: job.operationId,
        });
      }
      this.notify('exportReady', 'Export ready', `${art.title} is ready to download.`);
    } catch (e) {
      job.status = 'failed';
      job.finishedAt = this.now();
      job.error = `The sample render file could not be loaded (${(e as Error).message}). Retry the export.`;
    }
    await this.persistNow();
    this.emitExport(job);
  }

  // ---------- billing ----------

  subscription(): Subscription {
    return this.requireWs().subscription;
  }

  createCheckout(input: {
    planId: PlanId;
    interval: BillingInterval;
    returnTo: string;
    operationId: string;
  }): CheckoutSession {
    this.requireRole('owner');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (id) => ws.checkouts.find((c) => c.id === id));
    if (existing) return existing;
    const plan = findPlan(input.planId);
    if (!plan) throw new ServiceError('invalid_input', 'Unknown plan.');
    if (
      ws.subscription.planId === plan.id &&
      ws.subscription.interval === input.interval &&
      ws.subscription.status === 'active'
    ) {
      throw new ServiceError(
        'conflict',
        `This workspace is already on ${plan.name} (${input.interval}). Nothing to purchase.`,
      );
    }
    const c: CheckoutSession = {
      id: this.nextId('chk'),
      workspaceId: ws.workspaceId,
      planId: plan.id,
      interval: input.interval,
      amountUsd: planPrice(plan.id, input.interval),
      status: 'open',
      createdAt: this.now(),
      returnTo: input.returnTo,
      callbacks: 0,
      operationId: input.operationId,
    };
    ws.checkouts.unshift(c);
    this.recordOperation(input.operationId, 'checkout.create', c.id);
    this.persistSoon();
    return c;
  }

  getCheckout(id: string): CheckoutSession {
    const ws = this.requireWs();
    const c = ws.checkouts.find((x) => x.id === id);
    if (!c) throw new ServiceError('not_found', 'Checkout session not found.');
    if (c.status === 'open' && c.createdAt + 3_600_000 < this.now()) c.status = 'expired';
    return c;
  }

  simulateOutcome(id: string, outcome: 'success' | 'cancel' | 'decline' | 'delayed'): CheckoutSession {
    const c = this.getCheckout(id);
    if (c.status !== 'open') return c; // repeated clicks change nothing
    const forcedDelay = this.opts.scenario() === 'payment-pending' && outcome === 'success';
    switch (forcedDelay ? 'delayed' : outcome) {
      case 'success':
        c.status = 'succeeded';
        break;
      case 'cancel':
        c.status = 'cancelled';
        break;
      case 'decline':
        c.status = 'failed';
        c.failureReason = 'The demo card was declined (simulated). No charge was made.';
        break;
      case 'delayed':
        c.status = 'pending_confirmation';
        this.scheduler.schedule('checkout.confirm', 4000, { checkoutId: c.id });
        break;
    }
    this.persistSoon();
    return c;
  }

  private taskCheckoutConfirm(t: ScheduledTask): void {
    const c = this.ws?.checkouts.find((x) => x.id === t.payload.checkoutId);
    if (c?.status !== 'pending_confirmation') return;
    c.status = 'succeeded';
    this.persistSoon();
  }

  reconcile(id: string): { checkout: CheckoutSession; subscription: Subscription } {
    const ws = this.requireWs();
    const c = this.getCheckout(id);
    c.callbacks += 1;
    if (c.status === 'succeeded' && !c.fulfilledAt) {
      const plan = findPlan(c.planId)!;
      ws.subscription = {
        ...ws.subscription,
        planId: plan.id,
        interval: c.interval,
        status: 'active',
        creditsIncluded: plan.creditsPerMonth,
        renewsAt: this.now() + (c.interval === 'monthly' ? 30 : 365) * 86_400_000,
      };
      c.fulfilledAt = this.now();
      ws.invoices.unshift({
        id: this.nextId('inv'),
        at: this.now(),
        amountUsd: c.amountUsd,
        status: 'paid',
        description: `${plan.name} · ${c.interval} (simulated)`,
      });
    }
    this.persistSoon();
    return { checkout: c, subscription: ws.subscription };
  }

  changePlan(input: { planId: PlanId; interval: BillingInterval; operationId: string }): Subscription {
    this.requireRole('owner');
    const ws = this.requireWs();
    if (ws.operations[input.operationId]) return ws.subscription;
    const plan = findPlan(input.planId);
    if (!plan) throw new ServiceError('invalid_input', 'Unknown plan.');
    ws.subscription = {
      ...ws.subscription,
      planId: plan.id,
      interval: input.interval,
      status: 'active',
      creditsIncluded: plan.creditsPerMonth,
    };
    this.recordOperation(input.operationId, 'plan.change', plan.id);
    this.persistSoon();
    return ws.subscription;
  }

  cancelSubscription(): Subscription {
    this.requireRole('owner');
    const ws = this.requireWs();
    ws.subscription = { ...ws.subscription, status: 'cancelled' };
    this.persistSoon();
    return ws.subscription;
  }

  // ---------- workspace, members, notifications ----------

  workspace(): Workspace {
    const s = this.requireSession();
    return this.global.workspaces.find((w) => w.id === s.workspaceId)!;
  }

  updateWorkspace(input: Partial<Pick<Workspace, 'name' | 'defaultAspect'>>): Workspace {
    this.requireRole('owner');
    const w = this.workspace();
    if (input.name !== undefined) {
      if (!input.name.trim())
        throw new ServiceError('invalid_input', 'Workspace name cannot be empty.', {
          details: { field: 'name' },
        });
      w.name = input.name.trim();
    }
    if (input.defaultAspect) w.defaultAspect = input.defaultAspect;
    this.persistSoon();
    return w;
  }

  updateProfile(input: Partial<Pick<User, 'name'>>): User {
    const s = this.requireSession();
    const u = this.global.users.find((x) => x.id === s.userId)!;
    if (input.name !== undefined) {
      if (input.name.trim().length < 2)
        throw new ServiceError('invalid_input', 'Name must be at least 2 characters.', {
          details: { field: 'name' },
        });
      u.name = input.name.trim();
      u.initials = u.name
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);
      for (const m of this.global.members) if (m.userId === u.id) m.name = u.name;
    }
    this.persistSoon();
    return u;
  }

  members(): Member[] {
    const s = this.requireSession();
    return this.global.members.filter((m) => m.workspaceId === s.workspaceId);
  }

  invitations(): Invitation[] {
    return this.requireWs().invitations;
  }

  invite(input: { email: string; role: Role; operationId: string }): Invitation {
    this.requireRole('owner');
    const ws = this.requireWs();
    const existing = this.recallOperation(input.operationId, (id) => ws.invitations.find((i) => i.id === id));
    if (existing) return existing;
    const email = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new ServiceError('invalid_input', 'Enter a valid email address.', {
        details: { field: 'email' },
      });
    if (this.members().some((m) => m.email === email))
      throw new ServiceError('conflict', 'That person is already a member.', { details: { field: 'email' } });
    if (ws.invitations.some((i) => i.email === email && i.status === 'pending'))
      throw new ServiceError('conflict', 'An invitation for that email is already pending.', {
        details: { field: 'email' },
      });
    const plan = findPlan(ws.subscription.planId)!;
    if (this.members().length + ws.invitations.filter((i) => i.status === 'pending').length >= plan.seats) {
      throw new ServiceError(
        'usage_limit',
        `The ${plan.name} plan includes ${plan.seats} seat${plan.seats === 1 ? '' : 's'}. Upgrade to invite more people.`,
      );
    }
    const inv: Invitation = {
      id: this.nextId('inv'),
      workspaceId: ws.workspaceId,
      email,
      role: input.role,
      status: 'pending',
      createdAt: this.now(),
      simulatedLink: `/app/settings/members?accept=${this.nextId('tok')}`,
    };
    ws.invitations.unshift(inv);
    this.recordOperation(input.operationId, 'invite', inv.id);
    this.persistSoon();
    return inv;
  }

  revokeInvitation(id: string): void {
    this.requireRole('owner');
    const ws = this.requireWs();
    const inv = ws.invitations.find((i) => i.id === id);
    if (inv) inv.status = 'revoked';
    this.persistSoon();
  }

  acceptInvitationSimulated(id: string): Member {
    this.requireRole('owner');
    const ws = this.requireWs();
    const inv = ws.invitations.find((i) => i.id === id);
    if (inv?.status !== 'pending') throw new ServiceError('not_found', 'Invitation is not pending.');
    inv.status = 'accepted';
    const name = inv.email
      .split('@')[0]!
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const user: User = {
      id: this.nextId('u'),
      email: inv.email,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      locale: 'en',
      createdAt: this.now(),
    };
    this.global.users.push(user);
    const m: Member = {
      userId: user.id,
      workspaceId: ws.workspaceId,
      role: inv.role,
      joinedAt: this.now(),
      name,
      email: inv.email,
    };
    this.global.members.push(m);
    ws.subscription.seatsUsed = this.members().length;
    this.notify('memberJoined', 'Member joined', `${name} accepted the invitation (simulated).`);
    this.persistSoon();
    return m;
  }

  setRole(userId: string, role: Role): Member {
    this.requireRole('owner');
    const m = this.members().find((x) => x.userId === userId);
    if (!m) throw new ServiceError('not_found', 'Member not found.');
    const w = this.workspace();
    if (m.userId === w.ownerId && role !== 'owner')
      throw new ServiceError(
        'conflict',
        'The workspace owner keeps the owner role. Transfer ownership first (not available in the demo).',
      );
    m.role = role;
    if (this.global.session?.userId === userId) this.global.session.role = role;
    this.persistSoon();
    return m;
  }

  removeMember(userId: string): void {
    this.requireRole('owner');
    const w = this.workspace();
    if (userId === w.ownerId) throw new ServiceError('conflict', 'The workspace owner cannot be removed.');
    this.global.members = this.global.members.filter((m) => !(m.userId === userId && m.workspaceId === w.id));
    if (this.ws) this.ws.subscription.seatsUsed = this.members().length;
    this.persistSoon();
  }

  notificationPrefs(): NotificationPrefs {
    const s = this.requireSession();
    const ws = this.requireWs();
    return ws.notificationPrefs[s.userId] ?? DEFAULT_NOTIFICATION_PREFS;
  }

  updateNotificationPrefs(prefs: NotificationPrefs): NotificationPrefs {
    const s = this.requireSession();
    const ws = this.requireWs();
    ws.notificationPrefs[s.userId] = structuredClone(prefs);
    this.persistSoon();
    return prefs;
  }

  private notify(kind: keyof NotificationPrefs, title: string, body: string): void {
    const ws = this.ws;
    const s = this.global.session;
    if (!ws || !s) return;
    const prefs = ws.notificationPrefs[s.userId] ?? DEFAULT_NOTIFICATION_PREFS;
    const pref = prefs[kind] as { inApp?: boolean; email?: boolean };
    if (pref.inApp)
      ws.notifications.unshift({
        id: this.nextId('ntf'),
        workspaceId: ws.workspaceId,
        userId: s.userId,
        at: this.now(),
        kind,
        title,
        body,
        channel: 'in-app',
        read: false,
      });
    if (pref.email)
      ws.notifications.unshift({
        id: this.nextId('ntf'),
        workspaceId: ws.workspaceId,
        userId: s.userId,
        at: this.now(),
        kind,
        title,
        body: `${body} (email logged, not delivered)`,
        channel: 'email',
        read: true,
      });
    while (ws.notifications.length > RETENTION.notifications) ws.notifications.pop();
    this.persistSoon();
    for (const l of this.notificationListeners) l();
  }

  notifications(): NotificationEntry[] {
    const s = this.requireSession();
    return this.requireWs().notifications.filter((n) => n.userId === s.userId);
  }

  markRead(id: string): void {
    const n = this.requireWs().notifications.find((x) => x.id === id);
    if (n) n.read = true;
    this.persistSoon();
    for (const l of this.notificationListeners) l();
  }

  subscribeNotifications(l: () => void): () => void {
    this.notificationListeners.add(l);
    return () => this.notificationListeners.delete(l);
  }

  usage() {
    return this.requireWs().usage;
  }

  invoices() {
    return this.requireWs().invoices;
  }

  plans() {
    return PLANS;
  }
}

/** Real, valid 16-bit mono WAV of a soft two-tone chime; used as the demo voice-over stand-in. */
function synthTone(seconds: number): Blob {
  const rate = 22050;
  const n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, t * 8) * Math.min(1, (seconds - t) * 4);
    const f = 220 + 110 * Math.floor((t * 2) % 3);
    const sample = env * 0.35 * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t));
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
