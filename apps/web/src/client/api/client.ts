import type {
  ApplyOpsResponse,
  AssetDto,
  BoardSnapshot,
  CreateUploadResponse,
  EstimateResponse,
  ExportResponse,
  GraphOp,
  MeResponse,
  NodeVersionDto,
  RunDto,
  ShareDto,
} from '@annie3d/contracts';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'internal',
      body?.error?.message ?? res.statusText,
      body?.error?.details,
    );
  return body as T;
}

/** Dev/test only: `localStorage['annie3d.simSpeed']` speeds up the simulator (ignored in production). */
function simHeader(): Record<string, string> {
  try {
    const v = localStorage.getItem('annie3d.simSpeed');
    return v ? { 'x-annie3d-sim-speed': v } : {};
  } catch {
    return {};
  }
}

export const api = {
  me: () => call<z.infer<typeof MeResponse>>('/api/me'),
  meOptional: () => call<z.infer<typeof MeResponse> | null>('/api/me?optional=1'),
  boards: () =>
    call<{ boards: { id: string; title: string; updatedAt: string }[]; nextCursor: string | null }>(
      '/api/boards',
    ),
  createBoard: (json: { title: string; starter: string; fromGuest?: unknown }) =>
    call<BoardSnapshot>('/api/boards', { method: 'POST', json }),
  board: (id: string) => call<BoardSnapshot>(`/api/boards/${id}`),
  renameBoard: (id: string, title: string) =>
    call<{ ok: true }>(`/api/boards/${id}`, { method: 'PATCH', json: { title } }),
  applyOps: (boardId: string, opId: string, ops: GraphOp[]) =>
    call<z.infer<typeof ApplyOpsResponse>>(`/api/boards/${boardId}/ops`, {
      method: 'POST',
      json: { opId, ops },
    }),
  versions: (boardId: string, nodeId: string) =>
    call<{ versions: NodeVersionDto[] }>(`/api/boards/${boardId}/nodes/${nodeId}/versions`),
  estimate: (boardId: string, nodeId: string | null, scope: string) =>
    call<z.infer<typeof EstimateResponse>>(`/api/boards/${boardId}/runs/estimate`, {
      method: 'POST',
      json: { nodeId, scope },
    }),
  startRun: (boardId: string, json: { idempotencyKey: string; nodeId: string | null; scope: string }) =>
    call<RunDto>(`/api/boards/${boardId}/runs`, { method: 'POST', json, headers: simHeader() }),
  runs: (boardId: string) => call<{ runs: RunDto[] }>(`/api/boards/${boardId}/runs`),
  createExport: (json: {
    idempotencyKey: string;
    nodeId: string;
    versionId?: string;
    glbPreset?: string;
    includeMp4: boolean;
    includePng: boolean;
  }) => call<ExportResult>('/api/exports', { method: 'POST', json }),
  createShare: (json: {
    targetType: 'board' | 'version';
    targetId: string;
    visibility?: 'public' | 'unlisted';
  }) => call<ShareResult>('/api/shares', { method: 'POST', json }),
  revokeShare: (id: string) => call<{ ok: true }>(`/api/shares/${id}`, { method: 'DELETE' }),
  edit: (
    boardId: string,
    nodeId: string,
    json: {
      idempotencyKey: string;
      baseVersionId: string;
      selection: { faces: number[] };
      instruction: string;
    },
  ) =>
    call<RunDto>(`/api/boards/${boardId}/nodes/${nodeId}/edits`, {
      method: 'POST',
      json,
      headers: simHeader(),
    }),
  cancelRun: (runId: string) => call<RunDto>(`/api/runs/${runId}/cancel`, { method: 'POST' }),
  createUpload: (json: { kind: string; filename: string; mime: string; byteSize: number; sha256: string }) =>
    call<z.infer<typeof CreateUploadResponse>>('/api/assets/uploads', { method: 'POST', json }),
  completeUpload: (assetId: string, parts?: { partNumber: number; etag: string }[]) =>
    call<AssetDto>(`/api/assets/${assetId}/complete`, { method: 'POST', json: { parts } }),
};

export type Me = z.infer<typeof MeResponse>;
export type ExportResult = z.infer<typeof ExportResponse>;
export type ShareResult = z.infer<typeof ShareDto>;
