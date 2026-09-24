import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export type Db = ReturnType<typeof createDb>['db'];

/**
 * One client per request on Workers: Hyperdrive pools connections at the edge, so the Worker
 * opens a cheap local connection (Cloudflare "Connect to PostgreSQL" guide). In Node scripts
 * and tests the same function is used with a direct Neon URL.
 */
export function createDb(connectionString: string, opts: { explicitTls?: boolean } = {}) {
  const client = new pg.Client({
    connectionString: opts.explicitTls ? explicitSsl(connectionString) : connectionString,
  });
  const db = drizzle({ client, schema, casing: 'snake_case' });
  return { db, client };
}

/** Neon URLs say `sslmode=require`; pg 8 treats it as verify-full. Make that explicit. */
export function explicitSsl(url: string): string {
  const u = new URL(url);
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return url;
  u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}
