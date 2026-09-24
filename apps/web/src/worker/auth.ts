import { FREE_RUN_CREDITS, newId } from '@annie3d/contracts';
import {
  accounts,
  type Db,
  openAccount,
  sessions,
  users,
  verifications,
  workspaceMembers,
  workspaces,
} from '@annie3d/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Env } from './env';

/**
 * Better Auth on Workers + Drizzle + Hyperdrive (better-auth.com/docs/adapters/drizzle,
 * hono.dev/examples/better-auth-on-cloudflare). Built per request because bindings and the
 * db client are request-scoped on Workers.
 */
export function createAuth(env: Env, db: Db) {
  return betterAuth({
    appName: 'Annie 3D',
    baseURL: env.APP_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    // Local dev and the API test server run on fixed localhost ports; production trusts APP_URL only.
    trustedOrigins:
      env.APP_ENV === 'development'
        ? [env.APP_URL, 'http://localhost:4173', 'http://localhost:5190', 'http://localhost:5191']
        : [env.APP_URL],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    advanced: {
      database: { generateId: () => newId() },
      useSecureCookies: env.APP_URL.startsWith('https://'),
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    // Only automated tests sign in with a password; production is Google-only.
    emailAndPassword: { enabled: env.ANNIE3D_TEST_AUTH === '1', autoSignIn: true, minPasswordLength: 12 },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Signed session data in a short-lived cookie: most requests skip the sessions query
      // (Better Auth "cookie cache").
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await provisionWorkspace(db, user.id, user.name);
          },
        },
      },
    },
  });
}

/** Personal workspace, owner membership and the free-run credit grant. Idempotent. */
export async function provisionWorkspace(db: Db, userId: string, name: string) {
  const existing = await db.query.workspaceMembers.findFirst({ where: (m, { eq }) => eq(m.userId, userId) });
  if (existing) return existing.workspaceId;
  const workspaceId = newId();
  await db
    .insert(workspaces)
    .values({ id: workspaceId, name: `${name.slice(0, 80) || 'My'} workspace`, createdBy: userId });
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner' });
  await openAccount(db, workspaceId, FREE_RUN_CREDITS, `free:${workspaceId}`);
  return workspaceId;
}
