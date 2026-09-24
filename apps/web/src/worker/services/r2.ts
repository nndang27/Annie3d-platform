import { AwsClient } from 'aws4fetch';
import type { Env } from '../env';

/**
 * Presigned URLs for direct browser ↔ R2 transfers (R2 docs: aws4fetch example; bytes never
 * pass through the Worker). Multipart for large files uses the S3 API end to end.
 */
function client(env: Env) {
  return new AwsClient({
    service: 's3',
    region: 'auto',
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
}
const endpoint = (env: Env, bucket: string, key: string) =>
  `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

export const BUCKET_NAMES = {
  uploads: 'annie3d-uploads',
  artifacts: 'annie3d-artifacts',
  public: 'annie3d-public',
} as const;

export async function presignPut(
  env: Env,
  bucket: string,
  key: string,
  mime: string,
  expiresSec = 900,
): Promise<string> {
  const url = new URL(endpoint(env, bucket, key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(
    new Request(url, { method: 'PUT', headers: { 'content-type': mime } }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export async function createMultipart(env: Env, bucket: string, key: string, mime: string): Promise<string> {
  const res = await client(env).fetch(`${endpoint(env, bucket, key)}?uploads`, {
    method: 'POST',
    headers: { 'content-type': mime },
  });
  if (!res.ok) throw new Error(`createMultipart ${res.status}`);
  const xml = await res.text();
  const id = /<UploadId>([^<]+)<\/UploadId>/.exec(xml)?.[1];
  if (!id) throw new Error('createMultipart: no UploadId');
  return id;
}

export async function presignPart(
  env: Env,
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresSec = 3600,
): Promise<string> {
  const url = new URL(endpoint(env, bucket, key));
  url.searchParams.set('partNumber', String(partNumber));
  url.searchParams.set('uploadId', uploadId);
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(new Request(url, { method: 'PUT' }), { aws: { signQuery: true } });
  return signed.url;
}

export async function completeMultipart(
  env: Env,
  bucket: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  const body = `<CompleteMultipartUpload>${parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(
      (p) =>
        `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag.replace(/[<>&]/g, '')}</ETag></Part>`,
    )
    .join('')}</CompleteMultipartUpload>`;
  const res = await client(env).fetch(
    `${endpoint(env, bucket, key)}?uploadId=${encodeURIComponent(uploadId)}`,
    { method: 'POST', body },
  );
  if (!res.ok) throw new Error(`completeMultipart ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
