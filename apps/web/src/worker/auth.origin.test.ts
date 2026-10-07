// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { publicOrigin } from './auth';
import type { Env } from './env';

const prod = { APP_ENV: 'production', APP_URL: 'https://annie3d.app' } as Env;

describe('sign-in origin in production', () => {
  it('is annie3d.app, or the old workers.dev address for requests that came there (desktop apps)', () => {
    expect(publicOrigin(prod, new Request('https://annie3d.app/api/auth/session'))).toBe(
      'https://annie3d.app',
    );
    expect(publicOrigin(prod, new Request('https://annie3d.nndang2701.workers.dev/api/auth/session'))).toBe(
      'https://annie3d.nndang2701.workers.dev',
    );
    // Any other host never becomes an auth origin.
    expect(publicOrigin(prod, new Request('https://evil.example/api/auth/session'))).toBe(
      'https://annie3d.app',
    );
  });
});
