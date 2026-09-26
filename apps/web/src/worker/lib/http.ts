import type { ERROR_CODES } from '@annie3d/contracts';
import { en, type MessageKey, type Params } from '@annie3d/i18n';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { LocalizedError, tFor } from './i18n';

type Code = (typeof ERROR_CODES)[number];
type Values = Record<string, string | number>;

/**
 * An API error: `code` is the stable value clients branch on; the message is a key translated
 * into the request's language by the error handler (`errorResponse`).
 */
export class HttpError extends LocalizedError {
  constructor(
    public status: ContentfulStatusCode,
    public code: Code,
    key: MessageKey,
    params?: Values,
    public details?: unknown,
  ) {
    super(key, params);
  }
}

const hasPlaceholders = (key: MessageKey) => {
  const m = en[key] as string | { other: string };
  return /\{\w+\}/.test(typeof m === 'string' ? m : m.other);
};

/**
 * `httpError(404, 'not_found', 'api.board.notFound')`. After the key: its placeholders (only
 * when the text has some, checked by the compiler), then optional `details` for the JSON body.
 */
export function httpError<K extends MessageKey>(
  status: ContentfulStatusCode,
  code: Code,
  key: K,
  ...rest: [...Params<K>, details?: unknown]
): HttpError {
  const [params, details] = hasPlaceholders(key) ? [rest[0] as Values, rest[1]] : [undefined, rest[0]];
  return new HttpError(status, code, key, params, details);
}

/** The JSON error body, with the message in the request's language (app.onError). */
export function errorResponse(err: Error, c: Context<AppEnv>) {
  const t = tFor(c);
  if (err instanceof HttpError)
    return c.json({ error: { code: err.code, message: err.in(t), details: err.details } }, err.status);
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: c.get('requestId'),
      path: c.req.path,
      message: String(err),
      stack: err.stack?.split('\n').slice(0, 5),
    }),
  );
  return c.json(
    {
      error: {
        code: 'internal',
        message: t('api.error.internal'),
        details: { requestId: c.get('requestId') },
      },
    },
    500,
  );
}

export const unknownEndpoint = (c: Context<AppEnv>) =>
  c.json({ error: { code: 'not_found', message: tFor(c)('api.error.unknownEndpoint') } }, 404);

/** Parses and validates a JSON body with the shared contract schema. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw httpError(400, 'bad_request', 'api.http.bodyNotJson');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw httpError(400, 'bad_request', 'api.http.invalidBody', parsed.error.issues.slice(0, 20));
  return parsed.data;
}

export function query<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success)
    throw httpError(400, 'bad_request', 'api.http.invalidQuery', parsed.error.issues.slice(0, 20));
  return parsed.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(c: Context, name: string): string {
  const v = c.req.param(name);
  if (!v || !UUID_RE.test(v)) throw httpError(404, 'not_found', 'api.http.unknownParam', { name });
  return v;
}
