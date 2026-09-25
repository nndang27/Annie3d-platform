import { BOARD_FILE_DIRECT_MAX_BYTES, BOARD_FILE_MAX_BYTES } from '@annie3d/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor } from '../lib/session';
import { importBoardFile, memorySource, r2Source } from '../services/boardImport';
import { BUCKET_NAMES, completeMultipart, createMultipart, presignPart } from '../services/r2';

export const boardFileRoutes = new Hono<AppEnv>();

const PART_SIZE = 16 * 1024 * 1024;
const at = (c: { req: { query(k: string): string | undefined } }) => ({
  x: Number(c.req.query('x') ?? 0) || 0,
  y: Number(c.req.query('y') ?? 0) || 0,
});
/** `?into=existing`: add results to nodes the board already has (see importBoardFile). */
const into = (c: { req: { query(k: string): string | undefined } }) =>
  c.req.query('into') === 'existing' ? ('existing' as const) : ('new' as const);

/**
 * Import a `.annie3d` file into a board (signed-in), sent as the request body. For files up to
 * 80 MB (Workers take request bodies up to 100 MB); larger files go through R2 below.
 */
boardFileRoutes.post('/api/boards/:boardId/import', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const lim = await c.env.RL_UPLOAD.limit({ key: c.get('user')!.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many imports, slow down');
  if (Number(c.req.header('content-length') ?? 0) > BOARD_FILE_DIRECT_MAX_BYTES)
    throw httpError(413 as 400, 'bad_request', 'Send files over 80 MB through /import-upload');
  const raw = new Uint8Array(await c.req.arrayBuffer());
  if (raw.byteLength > BOARD_FILE_DIRECT_MAX_BYTES)
    throw httpError(413 as 400, 'bad_request', 'Send files over 80 MB through /import-upload');
  const who = { workspaceId: c.get('workspaceId')!, userId: c.get('user')!.id };
  return c.json(await importBoardFile(c.env, getDb(c), who, boardId, memorySource(raw), at(c), into(c)), 201);
});

/** Large files (up to 2 GB): the browser uploads the file to R2 in parts, then asks to import it. */
const ImportUploadRequest = z.object({ byteSize: z.number().int().positive().max(BOARD_FILE_MAX_BYTES) });
const tempKey = (prefix: string, ws: string, id: string) => `${prefix}ws/${ws}/imports/${id}.annie3d`;

boardFileRoutes.post('/api/boards/:boardId/import-upload', requireEditor, async (c) => {
  uuidParam(c, 'boardId');
  const lim = await c.env.RL_UPLOAD.limit({ key: c.get('user')!.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many imports, slow down');
  const { byteSize } = await body(c, ImportUploadRequest);
  const id = crypto.randomUUID();
  const key = tempKey(c.env.R2_KEY_PREFIX, c.get('workspaceId')!, id);
  const uploadId = await createMultipart(c.env, BUCKET_NAMES.uploads, key, 'application/vnd.annie3d+zip');
  const count = Math.ceil(byteSize / PART_SIZE);
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      presignPart(c.env, BUCKET_NAMES.uploads, key, uploadId, i + 1).then((url) => ({
        partNumber: i + 1,
        url,
      })),
    ),
  );
  return c.json({ uploadId: `${id}:${uploadId}`, partSize: PART_SIZE, parts }, 201);
});

const CompleteImport = z.object({
  uploadId: z.string().regex(/^[0-9a-f-]{36}:.{1,500}$/),
  parts: z
    .array(z.object({ partNumber: z.number().int().positive(), etag: z.string().max(200) }))
    .max(10_000),
});

boardFileRoutes.post('/api/boards/:boardId/import-upload/complete', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const req = await body(c, CompleteImport);
  const [id, uploadId] = [req.uploadId.slice(0, 36), req.uploadId.slice(37)];
  // The key is derived from the caller's own workspace: nobody can import someone else's upload.
  const key = tempKey(c.env.R2_KEY_PREFIX, c.get('workspaceId')!, id);
  try {
    await completeMultipart(c.env, BUCKET_NAMES.uploads, key, uploadId, req.parts);
  } catch {
    throw httpError(400, 'bad_request', 'The upload is missing, unfinished or already imported');
  }
  try {
    const head = await c.env.UPLOADS.head(key);
    if (!head) throw httpError(400, 'bad_request', 'The upload is missing');
    const who = { workspaceId: c.get('workspaceId')!, userId: c.get('user')!.id };
    const src = r2Source(c.env.UPLOADS, key, head.size);
    return c.json(await importBoardFile(c.env, getDb(c), who, boardId, src, at(c), into(c)), 201);
  } finally {
    // The file was only a vehicle: its contents are now in the workspace's store.
    c.executionCtx.waitUntil(c.env.UPLOADS.delete(key));
  }
});
