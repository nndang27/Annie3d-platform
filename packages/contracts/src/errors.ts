export type ServiceErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'upload_rejected'
  | 'payment_pending'
  | 'usage_limit'
  | 'not_configured'
  | 'internal';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly retryAfterMs?: number;
  readonly details?: Record<string, string>;
  constructor(
    code: ServiceErrorCode,
    message: string,
    opts: { retryAfterMs?: number; details?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryAfterMs = opts.retryAfterMs;
    this.details = opts.details;
  }
}

export function isServiceError(e: unknown, code?: ServiceErrorCode): e is ServiceError {
  return e instanceof ServiceError && (code === undefined || e.code === code);
}

/** Only transient, read-type failures are retried automatically. */
export function isRetryable(e: unknown): boolean {
  return isServiceError(e) && (e.code === 'network' || e.code === 'timeout' || e.code === 'rate_limited');
}
