import type {
  ArtifactsService,
  BillingService,
  ConnectivityService,
  ExportsService,
  PlatformServices,
  ProjectsService,
  RunsService,
  SessionService,
  WorkflowsService,
  WorkspaceService,
} from '@3dads/contracts';
import { MockBackend } from './backend';
import { VirtualClock } from './clock';
import type { ScenarioId } from './scenarios';
import type { DatasetSize } from './state';
import { type DemoStore, openDemoStore } from './store';
import { MockTransport, type TransportConfig } from './transport';

export interface MockServices extends PlatformServices {
  readonly mode: 'demo';
  /** Developer/test controls; not used by product screens. */
  dev: {
    backend: MockBackend;
    transport: MockTransport;
    clock: VirtualClock;
    store: DemoStore;
    setScenario(id: ScenarioId): void;
    setLatencyScale(scale: number): void;
    getConfig(): TransportConfig;
    reset(dataset?: DatasetSize): Promise<void>;
    reseed(dataset: DatasetSize): Promise<void>;
    expireSession(): void;
    ready: Promise<void>;
  };
}

export interface CreateMockOptions {
  memoryStore?: boolean;
  sampleMp4Url?: string;
  transport?: Partial<TransportConfig>;
  dataset?: DatasetSize;
}

/** Explicit initialisation of the demo adapter. main.tsx calls this; screens never import mock code. */
export async function createMockServices(opts: CreateMockOptions = {}): Promise<MockServices> {
  const clock = new VirtualClock();
  const transport = new MockTransport(opts.transport);
  const store = await openDemoStore({ memory: opts.memoryStore });
  const backend = new MockBackend({
    store,
    clock,
    scenario: () => transport.scenario,
    latency: () => transport.latency(),
    sampleMp4Url: opts.sampleMp4Url ?? '/app/fixtures/sample-render.mp4',
    defaultDataset: opts.dataset,
  });
  await backend.ready;

  // Results cross the "wire" as copies, like a real transport would serialise them. This keeps the
  // query cache from holding live backend objects (mutated in place → no re-render).
  const wire = <T>(v: T): T => (v instanceof Blob || v === null || v === undefined ? v : structuredClone(v));
  const read = <T>(name: string, fn: () => T | Promise<T>) =>
    transport.call(name, 'read', async () => wire(await fn()));
  // Mutations are durable before they resolve, so a navigation right after a command cannot lose it.
  const mutate = <T>(name: string, fn: () => T | Promise<T>) =>
    transport.call(name, 'mutation', async () => {
      const result = await fn();
      await backend.persistNow();
      return wire(result);
    });
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void backend.persistNow());
  }
  const guardSession = <T>(fn: () => T): T => {
    if (transport.scenario === 'expired-session') backend.expireSession();
    return fn();
  };

  const session: SessionService = {
    current: () => read('session.current', () => backend.currentSession()),
    listFixtureIdentities: () => read('session.identities', () => backend.listFixtureIdentities()),
    signIn: (i) => mutate('session.signIn', () => backend.signIn(i.email)),
    signUp: (i) => mutate('session.signUp', () => backend.signUp(i)),
    signOut: () => mutate('session.signOut', () => backend.signOut()),
    requestRecovery: (i) => mutate('session.recover', () => backend.requestRecovery(i.email)),
    completeRecovery: (i) => mutate('session.completeRecovery', () => backend.completeRecovery(i.token)),
    me: () => read('session.me', () => guardSession(() => backend.me())),
  };

  const projects: ProjectsService = {
    list: (f) => read('projects.list', () => guardSession(() => backend.listProjects(f))),
    get: (id) => read('projects.get', () => guardSession(() => backend.getProject(id))),
    create: (i) => mutate('projects.create', () => backend.createProject(i)),
    rename: (id, name) => mutate('projects.rename', () => backend.renameProject(id, name)),
    duplicate: (id, op) => mutate('projects.duplicate', () => backend.duplicateProject(id, op)),
    archive: (id, a) => mutate('projects.archive', () => backend.archiveProject(id, a)),
    remove: (id) => mutate('projects.remove', () => backend.removeProject(id)),
    saveScene: (id, i) => mutate('projects.saveScene', () => backend.saveScene(id, i)),
    selectArtifact: (id, a) => mutate('projects.selectArtifact', () => backend.selectArtifact(id, a)),
    readBlob: (k) => backend.readBlob(k),
  };

  const workflows: WorkflowsService = {
    get: (id) => read('workflows.get', () => backend.getWorkflow(id)),
    save: (doc, base) => mutate('workflows.save', () => backend.saveWorkflow(doc, base)),
    applyTemplate: (p, t) => mutate('workflows.applyTemplate', () => backend.applyTemplate(p, t)),
  };

  const runs: RunsService = {
    list: (p) => read('runs.list', () => backend.listRuns(p)),
    get: (id) => read('runs.get', () => backend.getRun(id)),
    start: (i) => mutate('runs.start', () => backend.startRun(i)),
    cancel: (id, op) => mutate('runs.cancel', () => backend.cancelRun(id, op)),
    retry: (id, op) => mutate('runs.retry', () => backend.retryRun(id, op)),
    pause: (id) => mutate('runs.pause', () => backend.pauseRun(id)),
    resume: (id) => mutate('runs.resume', () => backend.resumeRun(id)),
    answerInput: (id, a) => mutate('runs.answer', () => backend.answerInput(id, a)),
    replay: (id, cursor) => read('runs.replay', () => backend.replay(id, cursor)),
    subscribe: (runId, cursor, onEvent, onGap) => {
      let disposed = false;
      let delivered = cursor;
      const unsubLive = backend.subscribeRun(runId, (e) => {
        if (disposed || transport.state() !== 'online') return; // dropped while offline; replayed on reconnect
        if (e.seq <= delivered) return; // stale / duplicate
        delivered = e.seq;
        onEvent(e);
      });
      // Initial replay through the transport so offline/latency apply.
      void read('runs.replay', () => backend.replay(runId, cursor))
        .then((r) => {
          if (disposed) return;
          if (r.gap) {
            onGap(r.snapshot);
            delivered = r.cursor;
            return;
          }
          for (const e of r.events) {
            if (e.seq <= delivered) continue;
            delivered = e.seq;
            onEvent(e);
          }
        })
        .catch(() => {
          /* offline: hook re-subscribes on reconnect */
        });
      return () => {
        disposed = true;
        unsubLive();
      };
    },
    activeForWorkspace: () => read('runs.active', () => backend.activeRuns()),
  };

  const artifacts: ArtifactsService = {
    list: (f) => read('artifacts.list', () => backend.listArtifacts(f)),
    get: (id) => read('artifacts.get', () => backend.getArtifact(id)),
    versions: (l) => read('artifacts.versions', () => backend.versions(l)),
    setAcceptance: (id, a) => mutate('artifacts.accept', () => backend.setAcceptance(id, a)),
    storeBrowserExport: (i) => mutate('artifacts.store', () => backend.storeBrowserExport(i)),
    download: (id) => read('artifacts.download', () => backend.download(id)),
  };

  const exportsSvc: ExportsService = {
    list: (p) => read('exports.list', () => backend.listExportJobs(p)),
    enqueue: (i) => mutate('exports.enqueue', () => backend.enqueueExport(i)),
    cancel: (id) => mutate('exports.cancel', () => backend.cancelExport(id)),
    subscribe: (cb) => backend.subscribeExports(cb),
  };

  const billing: BillingService = {
    subscription: () => read('billing.subscription', () => backend.subscription()),
    usage: () => read('billing.usage', () => backend.usage()),
    invoices: () => read('billing.invoices', () => backend.invoices()),
    createCheckout: (i) => mutate('billing.checkout', () => backend.createCheckout(i)),
    getCheckout: (id) => read('billing.getCheckout', () => backend.getCheckout(id)),
    simulateOutcome: (id, o) => mutate('billing.outcome', () => backend.simulateOutcome(id, o)),
    reconcile: (id) => mutate('billing.reconcile', () => backend.reconcile(id)),
    changePlan: (i) => mutate('billing.changePlan', () => backend.changePlan(i)),
    cancelSubscription: () => mutate('billing.cancel', () => backend.cancelSubscription()),
  };

  const workspace: WorkspaceService = {
    get: () => read('workspace.get', () => backend.workspace()),
    update: (i) => mutate('workspace.update', () => backend.updateWorkspace(i)),
    updateProfile: (i) => mutate('workspace.profile', () => backend.updateProfile(i)),
    members: () => read('workspace.members', () => backend.members()),
    invitations: () => read('workspace.invitations', () => backend.invitations()),
    invite: (i) => mutate('workspace.invite', () => backend.invite(i)),
    revokeInvitation: (id) => mutate('workspace.revoke', () => backend.revokeInvitation(id)),
    acceptInvitationSimulated: (id) =>
      mutate('workspace.accept', () => backend.acceptInvitationSimulated(id)),
    setRole: (u, r) => mutate('workspace.role', () => backend.setRole(u, r)),
    removeMember: (u) => mutate('workspace.removeMember', () => backend.removeMember(u)),
    notificationPrefs: () => read('workspace.prefs', () => backend.notificationPrefs()),
    updateNotificationPrefs: (p) =>
      mutate('workspace.prefs.update', () => backend.updateNotificationPrefs(p)),
    notifications: () => read('workspace.notifications', () => backend.notifications()),
    markRead: (id) => mutate('workspace.markRead', () => backend.markRead(id)),
    subscribeNotifications: (cb) => backend.subscribeNotifications(cb),
  };

  const connectivity: ConnectivityService = {
    subscribe: (cb) => transport.onConnectivity(cb),
    state: () => transport.state(),
    reconnect: () => transport.reconnect(),
  };

  return {
    mode: 'demo',
    session,
    projects,
    workflows,
    runs,
    artifacts,
    exports: exportsSvc,
    billing,
    workspace,
    connectivity,
    dev: {
      backend,
      transport,
      clock,
      store,
      setScenario: (id) => transport.setScenario(id),
      setLatencyScale: (s) => transport.setLatencyScale(s),
      getConfig: () => transport.getConfig(),
      reset: async (dataset) => {
        // Clearing the object stores is enough. Deleting the database while a connection is open
        // leaves a *pending* delete that fires on the next navigation and wipes newer state.
        await backend.resetAll(dataset);
      },
      reseed: (d) => backend.reseedWorkspace(d),
      expireSession: () => backend.expireSession(),
      ready: backend.ready,
    },
  };
}
