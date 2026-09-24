import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../auth';
import type { AppEnv } from '../env';
import { getDb } from './db';
import { httpError } from './http';

/** Resolves the session (optional). Anonymous visitors can read public data and estimate runs. */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null);
  c.set('workspaceId', null);
  c.set('role', null);
  const cookie = c.req.header('cookie') ?? '';
  if (!cookie.includes('better-auth')) return next();
  const auth = createAuth(c.env, getDb(c));
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session) {
    const u = session.user;
    c.set('user', { id: u.id, name: u.name, email: u.email, image: u.image ?? null });
    const m = await getDb(c).query.workspaceMembers.findFirst({
      where: (m, { eq }) => eq(m.userId, u.id),
      orderBy: (m, { asc }) => asc(m.createdAt),
    });
    if (m) {
      c.set('workspaceId', m.workspaceId);
      c.set('role', m.role as 'owner' | 'editor' | 'viewer');
    }
  }
  return next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user') || !c.get('workspaceId')) throw httpError(401, 'unauthenticated', 'Sign in to continue');
  return next();
};

export const requireEditor: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw httpError(401, 'unauthenticated', 'Sign in to continue');
  if (c.get('role') === 'viewer') throw httpError(403, 'forbidden', 'Viewers cannot edit');
  return next();
};
