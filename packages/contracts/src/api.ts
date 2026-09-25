import { z } from 'zod';
import { OpBatch } from './graph';
import { NodeKindSchema } from './nodes';
import { GLB_PRESETS } from './presets';

/**
 * Public HTTP API of Annie 3D (Worker, `/api/*`). Every route below is validated on the server
 * with these schemas and used by the typed client in the SPA. `docs/API.md` is the readable
 * version of this file.
 */

const uuid = z.string().uuid();
const iso = z.string().datetime();
export const Cursor = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ------------------------------------ Errors ------------------------------------
export const ERROR_CODES = [
  'bad_request',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'insufficient_credits',
  'sign_in_required',
  'payload_too_large',
  'unsupported_media',
  'internal',
] as const;
export const ApiError = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string(), details: z.unknown().optional() }),
});
export type ApiError = z.infer<typeof ApiError>;

// ------------------------------------ DTOs ------------------------------------
export const UserDto = z.object({
  id: uuid,
  name: z.string(),
  email: z.string().email(),
  image: z.string().url().nullable(),
});
export const WorkspaceDto = z.object({
  id: uuid,
  name: z.string(),
  plan: z.enum(['free', 'creator', 'studio']),
  role: z.enum(['owner', 'editor', 'viewer']),
});
export const CreditsDto = z.object({
  balance: z.number().int(),
  reserved: z.number().int().nonnegative(),
  freeRunAvailable: z.boolean(),
});
export const MeResponse = z.object({ user: UserDto, workspace: WorkspaceDto, credits: CreditsDto });

const AssetUrl = z.string().regex(/^(\/[^/]|https:\/\/)/, 'absolute https URL or same-origin path');
export const AssetKind = z.enum(['image', 'model3d', 'video', 'audio', 'text', 'file']);
export const AssetDto = z.object({
  id: uuid,
  kind: AssetKind,
  mime: z.string(),
  byteSize: z.number().int().positive(),
  sha256: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  triangleCount: z.number().int().nullable(),
  status: z.enum(['pending', 'ready', 'failed']),
  /**
   * Same-origin paths (e.g. `/api/assets/:id/content`), valid on every host the app is served
   * from (preview URLs, custom domains). Resolve against the page origin when needed.
   */
  urls: z.object({
    original: AssetUrl.nullable(),
    poster: AssetUrl.nullable(),
    thumb: AssetUrl.nullable(),
    turntable: AssetUrl.nullable(),
  }),
  createdAt: iso,
});
export type AssetDto = z.infer<typeof AssetDto>;

export const NodeDto = z.object({
  id: uuid,
  kind: NodeKindSchema,
  x: z.number(),
  y: z.number(),
  label: z.string().nullable(),
  settings: z.record(z.string(), z.unknown()),
  zKey: z.string(),
  version: z.number().int(),
  currentVersionId: uuid.nullable(),
  stale: z.boolean(),
});
export const EdgeDto = z.object({
  id: uuid,
  source: uuid,
  sourcePort: z.literal('out'),
  target: uuid,
  targetPort: z.string(),
});
export const NodeVersionDto = z.object({
  id: uuid,
  nodeId: uuid,
  versionNo: z.number().int().positive(),
  source: z.enum(['run', 'edit', 'upload', 'agent', 'copy']),
  runId: uuid.nullable(),
  parentVersionId: uuid.nullable(),
  outputAssetId: uuid.nullable(),
  outputs: z.array(AssetDto),
  params: z.record(z.string(), z.unknown()),
  gates: z.array(
    z.object({
      id: z.string(),
      passed: z.boolean(),
      value: z.number().optional(),
      threshold: z.number().optional(),
    }),
  ),
  createdAt: iso,
});
export type NodeVersionDto = z.infer<typeof NodeVersionDto>;

export const BoardSummary = z.object({
  id: uuid,
  title: z.string(),
  updatedAt: iso,
  thumbnailUrl: z.string().url().nullable(),
});
export const BoardSnapshot = z.object({
  board: BoardSummary.extend({
    seq: z.number().int().nonnegative(),
    role: z.enum(['owner', 'editor', 'viewer']),
  }),
  nodes: z.array(NodeDto),
  edges: z.array(EdgeDto),
  /** Current versions of every node, so the canvas can render outputs without extra calls. */
  versions: z.array(NodeVersionDto),
});
export type BoardSnapshot = z.infer<typeof BoardSnapshot>;

export const RunScope = z.enum(['node', 'from_here', 'with_upstream', 'all']);
export const RunDto = z.object({
  id: uuid,
  boardId: uuid,
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial']),
  scope: RunScope,
  rootNodeId: uuid.nullable(),
  estimatedCredits: z.number().int(),
  chargedCredits: z.number().int(),
  steps: z.array(
    z.object({
      id: uuid,
      nodeId: uuid,
      seq: z.number().int(),
      status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped', 'cached']),
      credits: z.number().int(),
      outputVersionId: uuid.nullable(),
      errorCode: z.string().nullable(),
    }),
  ),
  lastEventSeq: z.number().int(),
  createdAt: iso,
  finishedAt: iso.nullable(),
});
export type RunDto = z.infer<typeof RunDto>;

// ------------------------------------ Requests ------------------------------------
export const CreateBoardRequest = z.object({
  title: z.string().min(1).max(120).default('Untitled board'),
  starter: z.enum(['blank', 'teardown-reveal', 'stone-water', 'splash-hero']).default('blank'),
  /** Guest boards built before sign-in are imported here (F1 → F11 hand-off). */
  fromGuest: z
    .object({
      nodes: z.array(NodeDto.omit({ version: true, currentVersionId: true, stale: true })),
      edges: z.array(EdgeDto),
    })
    .optional(),
  /**
   * The desktop app's working copy of a board file: a run needs the graph and its files on the
   * server, but the file on disk stays the document. Hidden from board lists and deleted
   * WORKING_COPY_TTL_DAYS after its last run.
   */
  workingCopy: z.boolean().optional(),
});
/** How long a working copy (and the files only it uses) stays on the server after its last run. */
export const WORKING_COPY_TTL_DAYS = 7;
export const UpdateBoardRequest = z.object({ title: z.string().min(1).max(120) });
export const ApplyOpsRequest = OpBatch.extend({ baseSeq: z.number().int().nonnegative().optional() });
export const ApplyOpsResponse = z.object({ seq: z.number().int(), duplicate: z.boolean() });
export const OpsSinceResponse = z.object({
  ops: z.array(
    z.object({ seq: z.number().int(), opId: uuid, actorId: uuid, ops: OpBatch.shape.ops, at: iso }),
  ),
  seq: z.number().int(),
});

export const UPLOAD_LIMITS = {
  image: 20 * 1024 * 1024,
  model3d: 100 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 500 * 1024 * 1024,
} as const;
export const ALLOWED_MIME: Record<keyof typeof UPLOAD_LIMITS, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/avif'],
  model3d: ['model/gltf-binary', 'model/gltf+json'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  video: ['video/mp4', 'video/webm'],
};
export const CreateUploadRequest = z.object({
  kind: z.enum(['image', 'model3d', 'audio', 'video']),
  filename: z.string().min(1).max(200),
  mime: z.string().max(100),
  byteSize: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const CreateUploadResponse = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('existing'), asset: AssetDto }),
  z.object({
    mode: z.literal('single'),
    assetId: uuid,
    url: z.string().url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: iso,
  }),
  z.object({
    mode: z.literal('multipart'),
    assetId: uuid,
    uploadId: z.string(),
    partSize: z.number().int(),
    parts: z.array(z.object({ partNumber: z.number().int(), url: z.string().url() })),
    expiresAt: iso,
  }),
]);
export const CompleteUploadRequest = z.object({
  parts: z.array(z.object({ partNumber: z.number().int(), etag: z.string() })).optional(),
});

export const EstimateRequest = z.object({ nodeId: uuid.nullable(), scope: RunScope });
export const EstimateResponse = z.object({
  plan: z.array(
    z.object({ nodeId: uuid, kind: NodeKindSchema, credits: z.number().int(), cached: z.boolean() }),
  ),
  totalCredits: z.number().int(),
  balance: z.number().int(),
  freeRunAvailable: z.boolean(),
  signInRequired: z.boolean(),
});
export const StartRunRequest = EstimateRequest.extend({ idempotencyKey: uuid });
export const EditRequest = z.object({
  idempotencyKey: uuid,
  baseVersionId: uuid,
  selection: z.object({ faces: z.array(z.number().int().nonnegative()).max(2_000_000) }),
  instruction: z.string().min(1).max(1000),
});
export const SelectVersionRequest = z.object({ versionId: uuid });

export const AgentMessageRequest = z.object({
  threadId: uuid.optional(),
  content: z.string().min(1).max(4000),
  budgetCredits: z.number().int().min(0).max(1000).default(100),
  context: z
    .object({
      nodeIds: z.array(uuid).max(50).default([]),
      versionId: uuid.optional(),
      faces: z.array(z.number().int()).optional(),
    })
    .default({ nodeIds: [] }),
});
/** Agent replies stream as Server-Sent Events of these shapes. */
export const AgentStreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('thread'), threadId: uuid, messageId: uuid }),
  z.object({ type: z.literal('text'), delta: z.string() }),
  z.object({
    type: z.literal('ops'),
    batch: OpBatch,
    applied: z.boolean(),
    seq: z.number().int().optional(),
  }),
  z.object({ type: z.literal('run'), runId: uuid }),
  z.object({ type: z.literal('done'), usage: z.object({ credits: z.number().int() }) }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export const ExportRequest = z.object({
  idempotencyKey: uuid,
  nodeId: uuid,
  versionId: uuid.optional(),
  glbPreset: z
    .enum(Object.keys(GLB_PRESETS) as [keyof typeof GLB_PRESETS, ...(keyof typeof GLB_PRESETS)[]])
    .optional(),
  includeMp4: z.boolean().default(false),
  includePng: z.boolean().default(false),
});
export const ExportReport = z.object({
  preset: z.string(),
  passed: z.boolean(),
  checks: z.array(
    z.object({
      id: z.enum(['bytes', 'triangles', 'texture', 'animation', 'validator']),
      passed: z.boolean(),
      value: z.number(),
      limit: z.number(),
      message: z.string(),
    }),
  ),
});
export const ExportResponse = z.object({
  id: uuid,
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  files: z.array(AssetDto),
  report: ExportReport.nullable(),
});

export const CreateShareRequest = z.object({
  targetType: z.enum(['version', 'board']),
  targetId: uuid,
  visibility: z.enum(['public', 'unlisted']).default('unlisted'),
});
export const ShareDto = z.object({
  id: uuid,
  token: z.string(),
  url: z.string().url(),
  targetType: z.enum(['version', 'board']),
  targetId: uuid,
  visibility: z.enum(['public', 'unlisted']),
  viewCount: z.number().int(),
  createdAt: iso,
  revokedAt: iso.nullable(),
});
export const PublicShareResponse = z.object({
  title: z.string(),
  targetType: z.enum(['version', 'board']),
  assets: z.array(AssetDto),
  ownerName: z.string(),
});

export const PlanDto = z.object({
  id: z.enum(['creator', 'studio']),
  name: z.string(),
  priceMonthlyUsd: z.number(),
  creditsPerMonth: z.number().int(),
});
export const CheckoutRequest = z.object({
  planId: z.enum(['creator', 'studio']),
  returnUrl: z.string().url(),
});
export const CheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
  provider: z.enum(['simulated', 'stripe', 'paddle']),
});
export const CreditEntryDto = z.object({
  id: uuid,
  amount: z.number().int(),
  reason: z.enum([
    'grant_free',
    'purchase',
    'subscription',
    'run_reserve',
    'run_settle',
    'run_refund',
    'adjust',
  ]),
  runId: uuid.nullable(),
  createdAt: iso,
});

export const CreateReelRequest = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('client'), assetId: uuid }),
  z.object({ mode: z.literal('server') }),
]);
export const ReelDto = z.object({
  id: uuid,
  runId: uuid,
  status: z.enum(['queued', 'rendering', 'ready', 'failed']),
  asset: AssetDto.nullable(),
});

// ------------------------------------ Route table ------------------------------------
export interface RouteDef {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth: 'none' | 'optional' | 'user';
  feature: string;
  summary: string;
  body?: z.ZodType;
  response?: z.ZodType;
}

export const ROUTES: RouteDef[] = [
  {
    method: 'GET',
    path: '/api/health',
    auth: 'none',
    feature: 'ops',
    summary: 'Liveness + database round trip',
  },
  {
    method: 'GET',
    path: '/api/auth/*',
    auth: 'none',
    feature: 'F11',
    summary: 'Better Auth (Google sign-in, session, sign-out)',
  },
  {
    method: 'GET',
    path: '/api/me',
    auth: 'user',
    feature: 'F11',
    summary: 'Current user, workspace, credits. With ?optional=1 a guest gets 200 null instead of 401.',
    response: MeResponse,
  },
  {
    method: 'GET',
    path: '/api/boards',
    auth: 'user',
    feature: 'F1',
    summary: 'List boards (cursor pagination)',
  },
  {
    method: 'POST',
    path: '/api/boards',
    auth: 'user',
    feature: 'F1',
    summary: 'Create board (blank, starter, or import guest board)',
    body: CreateBoardRequest,
    response: BoardSnapshot,
  },
  {
    method: 'GET',
    path: '/api/boards/:boardId',
    auth: 'user',
    feature: 'F1',
    summary: 'Board snapshot: nodes, edges, current versions',
    response: BoardSnapshot,
  },
  {
    method: 'PATCH',
    path: '/api/boards/:boardId',
    auth: 'user',
    feature: 'F1',
    summary: 'Rename board',
    body: UpdateBoardRequest,
  },
  {
    method: 'DELETE',
    path: '/api/boards/:boardId',
    auth: 'user',
    feature: 'F1',
    summary: 'Archive board (soft delete)',
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/ops',
    auth: 'user',
    feature: 'F1',
    summary: 'Apply an idempotent batch of graph ops',
    body: ApplyOpsRequest,
    response: ApplyOpsResponse,
  },
  {
    method: 'GET',
    path: '/api/boards/:boardId/ops',
    auth: 'user',
    feature: 'F12',
    summary: 'Ops after a sequence (sync, replay, process reel)',
    response: OpsSinceResponse,
  },
  {
    method: 'POST',
    path: '/api/assets/uploads',
    auth: 'user',
    feature: 'F2',
    summary: 'Start an upload; dedupes by sha256; presigned single or multipart',
    body: CreateUploadRequest,
    response: CreateUploadResponse,
  },
  {
    method: 'POST',
    path: '/api/assets/:assetId/complete',
    auth: 'user',
    feature: 'F2',
    summary: 'Finish an upload and verify size/type',
    body: CompleteUploadRequest,
    response: AssetDto,
  },
  {
    method: 'GET',
    path: '/api/assets/:assetId',
    auth: 'user',
    feature: 'F2',
    summary: 'Asset metadata with signed URLs',
    response: AssetDto,
  },
  {
    method: 'GET',
    path: '/api/boards/:boardId/nodes/:nodeId/versions',
    auth: 'user',
    feature: 'F9',
    summary: 'Version history of a node',
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/nodes/:nodeId/select-version',
    auth: 'user',
    feature: 'F9',
    summary: 'Make a version current (revert)',
    body: SelectVersionRequest,
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/runs/estimate',
    auth: 'optional',
    feature: 'F11',
    summary: 'Cost and cache hits before Run',
    body: EstimateRequest,
    response: EstimateResponse,
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/runs',
    auth: 'user',
    feature: 'F2',
    summary: 'Start a run (node, from here, with upstream, all)',
    body: StartRunRequest,
    response: RunDto,
  },
  { method: 'GET', path: '/api/boards/:boardId/runs', auth: 'user', feature: 'F2', summary: 'Run history' },
  {
    method: 'GET',
    path: '/api/runs/:runId',
    auth: 'user',
    feature: 'F2',
    summary: 'Run with steps',
    response: RunDto,
  },
  {
    method: 'POST',
    path: '/api/runs/:runId/cancel',
    auth: 'user',
    feature: 'F2',
    summary: 'Cancel a run; unstarted steps are refunded',
  },
  {
    method: 'GET',
    path: '/api/runs/:runId/events',
    auth: 'user',
    feature: 'F2',
    summary: 'WebSocket: run events after ?after=seq',
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/nodes/:nodeId/edits',
    auth: 'user',
    feature: 'F8',
    summary: 'Region edit: selected faces + instruction → new version',
    body: EditRequest,
    response: RunDto,
  },
  {
    method: 'POST',
    path: '/api/boards/:boardId/agent/messages',
    auth: 'user',
    feature: 'F7',
    summary: 'Send a message; SSE stream of text, ops and runs',
    body: AgentMessageRequest,
  },
  {
    method: 'GET',
    path: '/api/boards/:boardId/agent/threads',
    auth: 'user',
    feature: 'F7',
    summary: 'Agent threads of a board',
  },
  {
    method: 'GET',
    path: '/api/agent/threads/:threadId/messages',
    auth: 'user',
    feature: 'F7',
    summary: 'Messages of a thread',
  },
  {
    method: 'POST',
    path: '/api/exports',
    auth: 'user',
    feature: 'F6',
    summary: 'Export GLB (preset-checked), MP4, PNG',
    body: ExportRequest,
    response: ExportResponse,
  },
  {
    method: 'GET',
    path: '/api/exports/:exportId',
    auth: 'user',
    feature: 'F6',
    summary: 'Export status, files and report',
    response: ExportResponse,
  },
  {
    method: 'POST',
    path: '/api/shares',
    auth: 'user',
    feature: 'F10',
    summary: 'Create share link',
    body: CreateShareRequest,
    response: ShareDto,
  },
  {
    method: 'GET',
    path: '/api/shares',
    auth: 'user',
    feature: 'F10',
    summary: 'List share links (?boardId=)',
  },
  {
    method: 'DELETE',
    path: '/api/shares/:shareId',
    auth: 'user',
    feature: 'F10',
    summary: 'Revoke share link',
  },
  {
    method: 'GET',
    path: '/api/public/shares/:token',
    auth: 'none',
    feature: 'F10',
    summary: 'Public share payload',
    response: PublicShareResponse,
  },
  {
    method: 'GET',
    path: '/s/:token',
    auth: 'none',
    feature: 'F10',
    summary: 'Share page (HTML with Open Graph tags)',
  },
  {
    method: 'GET',
    path: '/api/credits',
    auth: 'user',
    feature: 'F11',
    summary: 'Balance and recent ledger entries',
  },
  { method: 'GET', path: '/api/billing/plans', auth: 'none', feature: 'F11', summary: 'Plans' },
  {
    method: 'POST',
    path: '/api/billing/checkout',
    auth: 'user',
    feature: 'F11',
    summary: 'Start checkout',
    body: CheckoutRequest,
    response: CheckoutResponse,
  },
  {
    method: 'POST',
    path: '/api/billing/webhooks/:provider',
    auth: 'none',
    feature: 'F11',
    summary: 'Signed payment webhook (idempotent)',
  },
  {
    method: 'POST',
    path: '/api/runs/:runId/reels',
    auth: 'user',
    feature: 'F12',
    summary: 'Register or render a process reel',
    body: CreateReelRequest,
    response: ReelDto,
  },
  {
    method: 'GET',
    path: '/api/runs/:runId/reels',
    auth: 'user',
    feature: 'F12',
    summary: 'Process reels of a run',
  },
  {
    method: 'POST',
    path: '/api/engine/jobs/:jobId/events',
    auth: 'none',
    feature: 'engine',
    summary: 'External engine callback (HMAC signed)',
  },
];
