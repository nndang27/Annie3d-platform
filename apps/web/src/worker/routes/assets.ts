import {
  ALLOWED_MIME,
  CompleteUploadRequest,
  CreateUploadRequest,
  newId,
  UPLOAD_LIMITS,
} from '@annie3d/contracts';
import { assets, assetVariants } from '@annie3d/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { assetDto, bucketOf } from '../services/assets';
import { BUCKET_NAMES, completeMultipart, createMultipart, presignPart, presignPut } from '../services/r2';

export const assetRoutes = new Hono<AppEnv>();

const SINGLE_PUT_MAX = 64 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

/** Magic-byte sniffing: the declared MIME must match the file's real signature. */
function sniff(head: Uint8Array): string | null {
  const s = (i: number, str: string) => [...str].every((ch, k) => head[i + k] === ch.charCodeAt(0));
  if (head[0] === 0x89 && s(1, 'PNG')) return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (s(0, 'RIFF') && s(8, 'WEBP')) return 'image/webp';
  if (s(4, 'ftypavif')) return 'image/avif';
  if (s(4, 'ftypheic') || s(4, 'ftypmif1')) return 'image/heic';
  if (s(0, 'glTF')) return 'model/gltf-binary';
  if (s(0, '{')) return 'model/gltf+json';
  if (s(0, 'ID3') || (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (s(0, 'RIFF') && s(8, 'WAVE')) return 'audio/wav';
  if (s(0, 'OggS')) return 'audio/ogg';
  if (s(4, 'ftyp')) return 'video/mp4'; // also audio/mp4 and m4a containers
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  return null;
}
function compatible(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (declared === sniffed) return true;
  const mp4Family = ['video/mp4', 'audio/mp4', 'audio/x-m4a', 'image/avif', 'image/heic'];
  return mp4Family.includes(declared) && sniffed === 'video/mp4';
}

/** PNG/JPEG/WebP dimensions from the first bytes, without decoding the image. */
function dimensions(head: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (head[0] === 0x89 && head[1] === 0x50) return { width: dv.getUint32(16), height: dv.getUint32(20) };
  if (head[8] === 0x57 && head[12] === 0x56 && head[15] === 0x20)
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }; // VP8
  if (head[0] === 0xff && head[1] === 0xd8) {
    let i = 2;
    while (i + 9 < head.length) {
      if (head[i] !== 0xff) return null;
      const marker = head[i + 1]!;
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

assetRoutes.post('/api/assets/uploads', requireEditor, async (c) => {
  const lim = await c.env.RL_UPLOAD.limit({ key: c.get('user')!.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many uploads, try again in a minute');
  const req = await body(c, CreateUploadRequest);
  if (!ALLOWED_MIME[req.kind].includes(req.mime))
    throw httpError(415, 'unsupported_media', `${req.mime} is not accepted for ${req.kind}`);
  if (req.byteSize > UPLOAD_LIMITS[req.kind])
    throw httpError(
      413,
      'payload_too_large',
      `Max ${UPLOAD_LIMITS[req.kind] / 1024 / 1024} MB for ${req.kind}`,
    );
  const db = getDb(c);
  const ws = c.get('workspaceId')!;
  const existing = await db.query.assets.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.workspaceId, ws), eq(t.sha256, req.sha256), eq(t.kind, req.kind), eq(t.status, 'ready')),
  });
  if (existing) return c.json({ mode: 'existing', asset: assetDto(c.env, existing) });
  const id = newId();
  const ext = req.filename.includes('.')
    ? req.filename
        .slice(req.filename.lastIndexOf('.') + 1)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 8)
    : 'bin';
  const key = `${c.env.R2_KEY_PREFIX}ws/${ws}/uploads/${id}.${ext}`;
  await db.insert(assets).values({
    id,
    workspaceId: ws,
    kind: req.kind,
    mime: req.mime,
    byteSize: req.byteSize,
    sha256: req.sha256,
    bucket: 'uploads',
    storageKey: key,
    status: 'pending',
    originalFilename: req.filename.slice(0, 200),
    createdBy: c.get('user')!.id,
  });
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  if (req.byteSize <= SINGLE_PUT_MAX) {
    const url = await presignPut(c.env, BUCKET_NAMES.uploads, key, req.mime);
    return c.json(
      { mode: 'single', assetId: id, url, headers: { 'content-type': req.mime }, expiresAt },
      201,
    );
  }
  const uploadId = await createMultipart(c.env, BUCKET_NAMES.uploads, key, req.mime);
  const count = Math.ceil(req.byteSize / PART_SIZE);
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      presignPart(c.env, BUCKET_NAMES.uploads, key, uploadId, i + 1).then((url) => ({
        partNumber: i + 1,
        url,
      })),
    ),
  );
  await db.update(assets).set({ meta: { uploadId } }).where(eq(assets.id, id));
  return c.json({ mode: 'multipart', assetId: id, uploadId, partSize: PART_SIZE, parts, expiresAt }, 201);
});

assetRoutes.post('/api/assets/:assetId/complete', requireEditor, async (c) => {
  const id = uuidParam(c, 'assetId');
  const req = await body(c, CompleteUploadRequest);
  const db = getDb(c);
  const a = await db.query.assets.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!a) throw httpError(404, 'not_found', 'Asset not found');
  if (a.status === 'ready') return c.json(assetDto(c.env, a));
  const uploadId = (a.meta as { uploadId?: string }).uploadId;
  if (uploadId) {
    if (!req.parts?.length) throw httpError(400, 'bad_request', 'parts required for multipart upload');
    await completeMultipart(c.env, BUCKET_NAMES.uploads, a.storageKey, uploadId, req.parts);
  }
  const obj = await c.env.UPLOADS.get(a.storageKey, { range: { offset: 0, length: 64 * 1024 } });
  if (!obj) throw httpError(400, 'bad_request', 'Upload not found in storage');
  const head = new Uint8Array(await obj.arrayBuffer());
  const fail = async (msg: string) => {
    await db.update(assets).set({ status: 'failed' }).where(eq(assets.id, id));
    await c.env.UPLOADS.delete(a.storageKey);
    throw httpError(400, 'bad_request', msg);
  };
  if (obj.size !== a.byteSize) await fail(`Size mismatch: expected ${a.byteSize}, stored ${obj.size}`);
  if (!compatible(a.mime, sniff(head))) await fail('File content does not match its declared type');
  const dims = a.kind === 'image' ? dimensions(head) : null;
  if (a.kind === 'image' && dims && (dims.width > 12000 || dims.height > 12000))
    await fail('Image larger than 12000 px');
  // The dedupe index can race with a concurrent identical upload: fall back to the winner.
  try {
    const [updated] = await db
      .update(assets)
      .set({ status: 'ready', width: dims?.width ?? null, height: dims?.height ?? null, meta: {} })
      .where(eq(assets.id, id))
      .returning();
    return c.json(assetDto(c.env, updated!));
  } catch (e) {
    const winner = await db.query.assets.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.workspaceId, a.workspaceId),
          eq(t.sha256, a.sha256),
          eq(t.kind, a.kind),
          eq(t.status, 'ready'),
        ),
    });
    if (winner) {
      await db.delete(assets).where(eq(assets.id, id));
      await c.env.UPLOADS.delete(a.storageKey);
      return c.json(assetDto(c.env, winner));
    }
    throw e;
  }
});

assetRoutes.get('/api/assets/:assetId', requireUser, async (c) => {
  const id = uuidParam(c, 'assetId');
  const db = getDb(c);
  const a = await db.query.assets.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!a) throw httpError(404, 'not_found', 'Asset not found');
  const variants = await db.select().from(assetVariants).where(eq(assetVariants.assetId, id));
  return c.json(assetDto(c.env, a, variants));
});

/** Streams the file from R2. Immutable content ⇒ long-lived private cache + ETag revalidation. */
assetRoutes.get('/api/assets/:assetId/content', requireUser, async (c) => {
  const id = uuidParam(c, 'assetId');
  const variant = c.req.query('variant');
  const db = getDb(c);
  const a = await db.query.assets.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (a?.status !== 'ready') throw httpError(404, 'not_found', 'Asset not found');
  let key = a.storageKey;
  let mime = a.mime;
  if (variant) {
    const [v] = await db
      .select()
      .from(assetVariants)
      .where(and(eq(assetVariants.assetId, id), eq(assetVariants.variant, variant)));
    if (!v) throw httpError(404, 'not_found', 'Variant not found');
    key = v.storageKey;
    mime = v.mime;
  }
  return streamObject(
    c.req.raw,
    bucketOf(c.env, a.bucket),
    key,
    mime,
    'private, max-age=31536000, immutable',
    downloadName(c.req.query('download')),
  );
});

/** `?download=name.ext` → attachment with a safe ASCII filename (RFC 6266). */
export function downloadName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120);
  return safe || undefined;
}

export async function streamObject(
  req: Request,
  bucket: R2Bucket,
  key: string,
  mime: string,
  cacheControl: string,
  attachmentName?: string,
): Promise<Response> {
  const range = req.headers.get('range');
  const obj = await bucket.get(key, { onlyIf: req.headers, range: range ? req.headers : undefined });
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'content-type': mime,
    'cache-control': cacheControl,
    etag: obj.httpEtag,
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
  });
  if (attachmentName) headers.set('content-disposition', `attachment; filename="${attachmentName}"`);
  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers });
  // R2 always reports a range on the object; only answer 206 when the client asked for one.
  if (range && obj.range && 'offset' in obj.range) {
    const off = obj.range.offset ?? 0;
    const len = obj.range.length ?? obj.size - off;
    headers.set('content-range', `bytes ${off}-${off + len - 1}/${obj.size}`);
    headers.set('content-length', String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}
