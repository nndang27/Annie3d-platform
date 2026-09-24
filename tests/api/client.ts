// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

/** Real Worker (workerd via Vite) + real Neon test branch + real R2 buckets. */
export const BASE = process.env.API_BASE ?? 'http://localhost:5190';

export class Client {
  cookie = '';
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    headers.set('origin', BASE);
    if (this.cookie) headers.set('cookie', this.cookie);
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(init.json);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length)
      this.cookie = [this.cookie, ...set.map((c) => c.split(';')[0])].filter(Boolean).join('; ');
    return res;
  }
  async json<T = any>(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<{ status: number; body: T; res: Response }> {
    const res = await this.req(path, init);
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T, res };
  }
  static async signedUp(name = 'Tester') {
    const c = new Client();
    const r = await c.json('/api/auth/sign-up/email', {
      method: 'POST',
      json: { email: `api-${randomUUID()}@example.com`, password: 'correct-horse-battery', name },
    });
    expect(r.status).toBe(200);
    return c;
  }
}
