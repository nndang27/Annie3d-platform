import type { ERROR_CODES } from '@annie3d/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

type Code = (typeof ERROR_CODES)[number];

export class HttpError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: Code,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const httpError = (status: ContentfulStatusCode, code: Code, message: string, details?: unknown) =>
  new HttpError(status, code, message, details);

/** Parses and validates a JSON body with the shared contract schema. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw httpError(400, 'bad_request', 'Body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw httpError(400, 'bad_request', 'Invalid request body', parsed.error.issues.slice(0, 20));
  return parsed.data;
}

export function query<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) throw httpError(400, 'bad_request', 'Invalid query', parsed.error.issues.slice(0, 20));
  return parsed.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(c: Context, name: string): string {
  const v = c.req.param(name);
  if (!v || !UUID_RE.test(v)) throw httpError(404, 'not_found', `Unknown ${name}`);
  return v;
}
