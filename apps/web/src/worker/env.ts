import type { Db } from '@annie3d/db';

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ASSETS: Fetcher;
  UPLOADS: R2Bucket;
  ARTIFACTS: R2Bucket;
  PUBLIC: R2Bucket;
  HYPERDRIVE: Hyperdrive;
  RL_WRITE: RateLimiter;
  RL_RUN: RateLimiter;
  RL_UPLOAD: RateLimiter;
  RUN_ROOM: DurableObjectNamespace;
  SIM_ROOM: DurableObjectNamespace;
  APP_ENV: string;
  APP_URL: string;
  R2_KEY_PREFIX: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  /** Simulator speed multiplier (1 = realistic, 0.05 in tests). */
  SIM_SPEED?: string;
  /** "1" only in local/test: enables email+password sign-in used by automated tests. */
  ANNIE3D_TEST_AUTH?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Vars {
  db: Db | undefined;
  dbClient: import('pg').Client | undefined;
  user: SessionUser | null;
  workspaceId: string | null;
  role: 'owner' | 'editor' | 'viewer' | null;
  requestId: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
