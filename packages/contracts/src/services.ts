import type { Artifact, ExportJob, ExportPresetId } from './artifacts';
import type { BillingInterval, CheckoutSession, Invoice, PlanId, Subscription, UsageRecord } from './billing';
import type { Invitation, Member, Role, Session, User, Workspace } from './identity';
import type { NotificationEntry, NotificationPrefs } from './notifications';
import type { CreateProjectInput, Project, ProjectDetail, ProjectSummary } from './projects';
import type { EventReplay, Run, RunEvent } from './runs';
import type { AdComposition, SceneDoc, SceneRevision } from './scene';
import type { WorkflowDoc } from './workflow';

export interface Identity {
  user: User;
  workspace: Workspace;
  role: Role;
}

export interface SessionService {
  current(): Promise<Session | null>;
  listFixtureIdentities(): Promise<Identity[]>;
  signIn(input: { email: string; operationId: string }): Promise<Session>;
  signUp(input: {
    email: string;
    name: string;
    workspaceName: string;
    operationId: string;
  }): Promise<Session>;
  signOut(): Promise<void>;
  requestRecovery(input: { email: string }): Promise<{ simulatedLink: string }>;
  completeRecovery(input: { token: string }): Promise<Session>;
  me(): Promise<Identity>;
}

export interface ProjectFilter {
  query?: string;
  status?: 'active' | 'archived' | 'all';
  templateSlug?: string;
}

export interface ProjectsService {
  list(filter?: ProjectFilter): Promise<ProjectSummary[]>;
  get(id: string): Promise<ProjectDetail>;
  create(input: CreateProjectInput): Promise<Project>;
  rename(id: string, name: string): Promise<Project>;
  duplicate(id: string, operationId: string): Promise<Project>;
  archive(id: string, archived: boolean): Promise<Project>;
  remove(id: string): Promise<void>;
  saveScene(
    id: string,
    input: {
      scene: SceneDoc;
      ad: AdComposition;
      baseRevision: number;
      source: SceneRevision['source'];
      note?: string;
    },
  ): Promise<SceneRevision>;
  selectArtifact(id: string, artifactId: string | undefined): Promise<Project>;
  /** Returns a stored upload/preview blob. */
  readBlob(blobKey: string): Promise<Blob | null>;
}

export interface WorkflowsService {
  get(workflowId: string): Promise<WorkflowDoc>;
  save(doc: WorkflowDoc, baseRevision: number): Promise<WorkflowDoc>;
  applyTemplate(projectId: string, templateSlug: string): Promise<WorkflowDoc>;
}

export interface RunsService {
  list(projectId: string): Promise<Run[]>;
  get(runId: string): Promise<Run>;
  start(input: {
    projectId: string;
    workflowId: string;
    operationId: string;
    onlyNodeId?: string;
  }): Promise<Run>;
  cancel(runId: string, operationId: string): Promise<Run>;
  retry(runId: string, operationId: string): Promise<Run>;
  pause(runId: string): Promise<Run>;
  resume(runId: string): Promise<Run>;
  answerInput(runId: string, answer: string): Promise<Run>;
  /** Replay from cursor (exclusive). */
  replay(runId: string, cursor: number): Promise<EventReplay>;
  /** Live subscription; events arrive in order. Returns unsubscribe. */
  subscribe(
    runId: string,
    cursor: number,
    onEvent: (e: RunEvent) => void,
    onGap: (snapshot: Run) => void,
  ): () => void;
  activeForWorkspace(): Promise<Run[]>;
}

export interface ArtifactFilter {
  query?: string;
  kind?: string;
  projectId?: string;
  acceptance?: string;
}

export interface ArtifactsService {
  list(filter?: ArtifactFilter): Promise<Artifact[]>;
  get(id: string): Promise<Artifact>;
  versions(lineageId: string): Promise<Artifact[]>;
  setAcceptance(id: string, acceptance: Artifact['acceptance']): Promise<Artifact>;
  /** Store a browser-produced artifact (PNG/WebM/JSON). */
  storeBrowserExport(input: {
    projectId: string;
    sourceArtifactId: string;
    preset: ExportPresetId;
    blob: Blob;
    filename: string;
    operationId: string;
    scene?: SceneDoc;
    ad?: AdComposition;
  }): Promise<Artifact>;
  download(id: string): Promise<{ blob: Blob; filename: string; mime: string }>;
}

export interface ExportsService {
  list(projectId?: string): Promise<ExportJob[]>;
  enqueue(input: {
    projectId: string;
    artifactId: string;
    preset: ExportPresetId;
    operationId: string;
  }): Promise<ExportJob>;
  cancel(jobId: string): Promise<ExportJob>;
  subscribe(onChange: (job: ExportJob) => void): () => void;
}

export interface BillingService {
  subscription(): Promise<Subscription>;
  usage(): Promise<UsageRecord[]>;
  invoices(): Promise<Invoice[]>;
  createCheckout(input: {
    planId: PlanId;
    interval: BillingInterval;
    returnTo: string;
    operationId: string;
  }): Promise<CheckoutSession>;
  getCheckout(id: string): Promise<CheckoutSession>;
  /** Simulated provider outcome, driven by the demo checkout page. */
  simulateOutcome(
    id: string,
    outcome: 'success' | 'cancel' | 'decline' | 'delayed',
  ): Promise<CheckoutSession>;
  /** Idempotent reconciliation called by the return page; repeated calls are safe. */
  reconcile(id: string): Promise<{ checkout: CheckoutSession; subscription: Subscription }>;
  changePlan(input: {
    planId: PlanId;
    interval: BillingInterval;
    operationId: string;
  }): Promise<Subscription>;
  cancelSubscription(): Promise<Subscription>;
}

export interface WorkspaceService {
  get(): Promise<Workspace>;
  update(input: Partial<Pick<Workspace, 'name' | 'defaultAspect'>>): Promise<Workspace>;
  updateProfile(input: Partial<Pick<User, 'name'>>): Promise<User>;
  members(): Promise<Member[]>;
  invitations(): Promise<Invitation[]>;
  invite(input: { email: string; role: Role; operationId: string }): Promise<Invitation>;
  revokeInvitation(id: string): Promise<void>;
  acceptInvitationSimulated(id: string): Promise<Member>;
  setRole(userId: string, role: Role): Promise<Member>;
  removeMember(userId: string): Promise<void>;
  notificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
  notifications(): Promise<NotificationEntry[]>;
  markRead(id: string): Promise<void>;
  subscribeNotifications(onChange: () => void): () => void;
}

export type ConnectivityState = 'online' | 'offline' | 'reconnecting';

export interface ConnectivityService {
  subscribe(cb: (state: ConnectivityState) => void): () => void;
  state(): ConnectivityState;
  reconnect(): Promise<void>;
}

export interface PlatformServices {
  readonly mode: 'demo' | 'live';
  session: SessionService;
  projects: ProjectsService;
  workflows: WorkflowsService;
  runs: RunsService;
  artifacts: ArtifactsService;
  exports: ExportsService;
  billing: BillingService;
  workspace: WorkspaceService;
  connectivity: ConnectivityService;
}
