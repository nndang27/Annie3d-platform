import {
  type Artifact,
  type CheckoutSession,
  createIdFactory,
  DEFAULT_AD,
  defaultScene,
  type ExportJob,
  type Invitation,
  type Invoice,
  type Member,
  type NotificationEntry,
  type NotificationPrefs,
  PRODUCT_FIXTURES,
  type Project,
  type Role,
  type Run,
  type RunEvent,
  type SceneRevision,
  type Session,
  type Subscription,
  TEMPLATES,
  type Template,
  type UsageRecord,
  type User,
  type WorkflowDoc,
  type Workspace,
} from '@3dads/contracts';
import type { ScheduledTask } from './scheduler';

export const STATE_VERSION = 3;

export interface GlobalState {
  version: number;
  users: User[];
  workspaces: Workspace[];
  members: Member[];
  session: Session | null;
  recoveryTokens: { token: string; userId: string; expiresAt: number }[];
  /** id counter so ids stay unique across reloads */
  idCounter: number;
  /** Wall-clock stamp of the last persisted write; the store refuses older writes. */
  savedAt?: number;
}

export interface WorkspaceState {
  version: number;
  workspaceId: string;
  seededWith: DatasetSize;
  projects: Project[];
  workflows: WorkflowDoc[];
  sceneRevisions: Record<string, SceneRevision[]>;
  runs: Run[];
  events: Record<string, { firstSeq: number; items: RunEvent[] }>;
  artifacts: Artifact[];
  exportJobs: ExportJob[];
  subscription: Subscription;
  checkouts: CheckoutSession[];
  usage: UsageRecord[];
  invoices: Invoice[];
  invitations: Invitation[];
  notificationPrefs: Record<string, NotificationPrefs>;
  notifications: NotificationEntry[];
  /** Persisted scheduler tasks (runs continue across navigation and reload). */
  tasks: ScheduledTask[];
  /** operationId → result summary for duplicate-command handling */
  operations: Record<string, { kind: string; refId: string; at: number }>;
  savedAt?: number;
}

export type DatasetSize = 'small' | 'typical' | 'stress';

export const RETENTION = {
  eventsPerRun: 200,
  runsPerProject: 30,
  notifications: 100,
  sceneRevisionsPerProject: 50,
  usageRecords: 500,
  exportJobs: 100,
  operations: 1000,
};

export const FIXTURE_USERS: {
  user: User;
  workspace: Workspace;
  role: Role;
  members: { userId: string; role: Role }[];
}[] = [
  {
    user: {
      id: 'u_mai',
      email: 'mai@lumen.demo',
      name: 'Mai Tran',
      initials: 'MT',
      locale: 'en',
      createdAt: 1_755_000_000_000,
    },
    workspace: {
      id: 'ws_lumen',
      name: 'Lumen Skincare',
      slug: 'lumen',
      ownerId: 'u_mai',
      defaultAspect: '4:5',
      createdAt: 1_755_000_000_000,
    },
    role: 'owner',
    members: [
      { userId: 'u_mai', role: 'owner' },
      { userId: 'u_sam', role: 'viewer' },
    ],
  },
  {
    user: {
      id: 'u_alex',
      email: 'alex@northwind.demo',
      name: 'Alex Rivera',
      initials: 'AR',
      locale: 'en',
      createdAt: 1_755_100_000_000,
    },
    workspace: {
      id: 'ws_northwind',
      name: 'Northwind Audio',
      slug: 'northwind',
      ownerId: 'u_alex',
      defaultAspect: '1:1',
      createdAt: 1_755_100_000_000,
    },
    role: 'owner',
    members: [{ userId: 'u_alex', role: 'owner' }],
  },
  {
    user: {
      id: 'u_sam',
      email: 'sam@lumen.demo',
      name: 'Sam Okafor',
      initials: 'SO',
      locale: 'en',
      createdAt: 1_755_200_000_000,
    },
    workspace: {
      id: 'ws_lumen',
      name: 'Lumen Skincare',
      slug: 'lumen',
      ownerId: 'u_mai',
      defaultAspect: '4:5',
      createdAt: 1_755_000_000_000,
    },
    role: 'viewer',
    members: [],
  },
];

export function seedGlobal(): GlobalState {
  const users = new Map<string, User>();
  const workspaces = new Map<string, Workspace>();
  const members: Member[] = [];
  for (const f of FIXTURE_USERS) {
    users.set(f.user.id, f.user);
    workspaces.set(f.workspace.id, f.workspace);
  }
  for (const f of FIXTURE_USERS) {
    for (const m of f.members) {
      const u = users.get(m.userId)!;
      members.push({
        userId: m.userId,
        workspaceId: f.workspace.id,
        role: m.role,
        joinedAt: u.createdAt,
        name: u.name,
        email: u.email,
      });
    }
  }
  return {
    version: STATE_VERSION,
    users: [...users.values()],
    workspaces: [...workspaces.values()],
    members,
    session: null,
    recoveryTokens: [],
    idCounter: 1000,
  };
}

export function buildWorkflowFromTemplate(
  id: string,
  projectId: string,
  template: Template,
  now: number,
): WorkflowDoc {
  return {
    id,
    projectId,
    revision: 1,
    nodes: template.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title ?? '',
      position: { x: n.x, y: n.y },
      settings: { ...(n.settings ?? {}) },
    })),
    edges: template.edges.map(([source, sourcePort, target, targetPort], i) => ({
      id: `e-${i}`,
      source,
      sourcePort,
      target,
      targetPort,
    })),
    updatedAt: now,
  };
}

export function seedWorkspace(
  workspaceId: string,
  size: DatasetSize,
  now: number,
  nextId: (p: string) => string,
): WorkspaceState {
  const count = size === 'small' ? 3 : size === 'typical' ? 24 : 400;
  const projects: Project[] = [];
  const workflows: WorkflowDoc[] = [];
  const sceneRevisions: Record<string, SceneRevision[]> = {};
  const artifacts: Artifact[] = [];
  const productNames: Record<string, string[]> = {
    'serum-bottle': ['Radiance Serum 30 ml', 'Night Repair Drops', 'Vitamin C Booster'],
    headphones: ['Aria Pro headphones', 'Aria Lite', 'Studio Monitor X'],
    'smart-speaker': ['Echo-style speaker', 'Room speaker mini', 'Kitchen speaker'],
  };
  for (let i = 0; i < count; i++) {
    const template = TEMPLATES[i % TEMPLATES.length]!;
    const fixture = PRODUCT_FIXTURES[template.fixtureId];
    const pid = nextId('proj');
    const wid = nextId('wf');
    const createdAt = now - (i + 1) * 3_600_000 * 7;
    const names = productNames[template.fixtureId]!;
    const productName = names[i % names.length]!;
    const project: Project = {
      id: pid,
      workspaceId,
      name: `${productName} — ${template.name}${size === 'stress' ? ` #${i + 1}` : ''}`,
      templateSlug: template.slug,
      productName,
      productDescription: `${fixture.name} for ${template.suitableFor.toLowerCase()}`,
      brief: {
        goal: template.outcome,
        audience: template.suitableFor,
        tone: i % 4 === 0 ? 'clean' : i % 4 === 1 ? 'bold' : i % 4 === 2 ? 'warm' : 'technical',
        aspects: template.aspects,
        keyMessage: template.ad.headline,
      },
      reference: { source: 'fixture', fixtureId: template.fixtureId },
      status: i % 9 === 8 ? 'archived' : 'active',
      createdAt,
      updatedAt: createdAt + 600_000 * (i % 5),
      workflowId: wid,
      sceneRevision: 1,
    };
    projects.push(project);
    const wf = buildWorkflowFromTemplate(wid, pid, template, createdAt);
    if (size === 'stress' && i === 0) {
      // 60-node stress graph: extra ad-variant/review branches
      for (let k = 0; k < 52; k++) {
        const id = `n-extra-${k}`;
        wf.nodes.push({
          id,
          kind: k % 2 === 0 ? 'ad-variants' : 'review',
          title: `Branch ${k}`,
          position: { x: 1520 + (k % 8) * 380, y: 600 + Math.floor(k / 8) * 260 },
          settings: {},
        });
      }
    }
    workflows.push(wf);
    const scene = {
      ...defaultScene(template.fixtureId, template.scene.materialColor ?? fixture.defaultColor),
      background: template.scene.background,
      light: template.scene.light,
      animation: { preset: template.scene.animation, durationSec: template.scene.durationSec },
    };
    const ad = { ...DEFAULT_AD, ...template.ad, aspect: template.aspects[0]! };
    sceneRevisions[pid] = [
      {
        revision: 1,
        scene,
        ad,
        savedAt: createdAt,
        source: 'template',
        note: `From template ${template.name}`,
      },
    ];
    // Seed a couple of finished artifacts on the first few projects so the library is not empty.
    if (i < 6) {
      const lineage = `${pid}:n-ads:${ad.aspect}`;
      for (let r = 1; r <= (i === 0 ? 3 : 1); r++) {
        const aid = nextId('art');
        artifacts.push({
          id: aid,
          projectId: pid,
          nodeId: 'n-ads',
          kind: 'ad-variant',
          title: `${template.name} · ${ad.aspect} · v${r}`,
          revision: r,
          lineageId: lineage,
          createdAt: createdAt + r * 900_000,
          preview: { kind: 'fixture', fixtureId: template.fixtureId },
          acceptance: r === 1 && i === 0 ? 'accepted' : 'unreviewed',
          provenance: {
            source: 'engine-demo',
            note: 'Seeded demonstration output. Not generated from a reference image.',
          },
          scene: { ...scene, materialColor: r === 2 ? '#5b7cff' : scene.materialColor },
          ad,
        });
        const prev = artifacts.find((a) => a.lineageId === lineage && a.revision === r - 1);
        if (prev) prev.supersededBy = aid;
      }
      if (i === 0)
        project.selectedArtifactId = artifacts.find((a) => a.lineageId === lineage && a.revision === 3)?.id;
    }
  }
  const prefs: Record<string, NotificationPrefs> = {};
  return {
    version: STATE_VERSION,
    workspaceId,
    seededWith: size,
    projects,
    workflows,
    sceneRevisions,
    runs: [],
    events: {},
    artifacts,
    exportJobs: [],
    subscription: {
      workspaceId,
      planId: workspaceId === 'ws_lumen' ? 'studio' : 'starter',
      interval: 'monthly',
      status: 'active',
      renewsAt: now + 14 * 86_400_000,
      creditsIncluded: workspaceId === 'ws_lumen' ? 300 : 20,
      creditsUsed: workspaceId === 'ws_lumen' ? 112 : 3,
      seatsUsed: workspaceId === 'ws_lumen' ? 2 : 1,
    },
    checkouts: [],
    usage: [],
    invoices:
      workspaceId === 'ws_lumen'
        ? [
            {
              id: 'inv_0001',
              at: now - 16 * 86_400_000,
              amountUsd: 29,
              status: 'paid',
              description: 'Studio · monthly (sample invoice)',
            },
            {
              id: 'inv_0002',
              at: now - 46 * 86_400_000,
              amountUsd: 29,
              status: 'paid',
              description: 'Studio · monthly (sample invoice)',
            },
          ]
        : [],
    invitations: [],
    notificationPrefs: prefs,
    notifications: [],
    tasks: [],
    operations: {},
  };
}

export const idFactory = createIdFactory;
