import { isServiceError, ServiceError } from '@annie3d/contracts';

export interface ErrorPresentation {
  title: string;
  message: string;
  code: string;
  recovery: 'retry' | 'signin' | 'reconnect' | 'upgrade' | 'back' | 'none';
}

export function presentError(e: unknown): ErrorPresentation {
  if (isServiceError(e)) {
    switch (e.code) {
      case 'network':
        return { title: 'You are offline', message: e.message, code: e.code, recovery: 'reconnect' };
      case 'timeout':
        return { title: 'Request timed out', message: e.message, code: e.code, recovery: 'retry' };
      case 'rate_limited':
        return { title: 'Slow down a moment', message: e.message, code: e.code, recovery: 'retry' };
      case 'session_expired':
      case 'unauthorized':
        return { title: 'Sign in to continue', message: e.message, code: e.code, recovery: 'signin' };
      case 'forbidden':
        return { title: 'You need a different role', message: e.message, code: e.code, recovery: 'none' };
      case 'not_found':
        return { title: 'Not found', message: e.message, code: e.code, recovery: 'back' };
      case 'usage_limit':
        return { title: 'Plan limit reached', message: e.message, code: e.code, recovery: 'upgrade' };
      case 'conflict':
        return { title: 'Already changed', message: e.message, code: e.code, recovery: 'retry' };
      case 'invalid_input':
      case 'upload_rejected':
        return { title: 'Check your input', message: e.message, code: e.code, recovery: 'none' };
      case 'not_configured':
        return { title: 'Not configured', message: e.message, code: e.code, recovery: 'none' };
      default:
        return { title: 'Something went wrong', message: e.message, code: e.code, recovery: 'retry' };
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  return { title: 'Something went wrong', message: msg, code: 'unknown', recovery: 'retry' };
}

export function fieldError(e: unknown, field: string): string | undefined {
  return isServiceError(e) && e.details?.field === field ? e.message : undefined;
}

export { ServiceError };
