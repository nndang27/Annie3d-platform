import { createDb, type Db } from '@annie3d/db';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * One pg client per request through Hyperdrive, closed after the response
 * (Cloudflare "Connect to PostgreSQL" guide: create the client in the handler, close it with
 * ctx.waitUntil). Created lazily so routes that never query pay nothing. node-postgres queues
 * queries issued while the connection is still being established.
 */
export function getDb(c: Context<AppEnv>): Db {
  let db = c.get('db');
  if (!db) {
    const made = createDb(c.env.HYPERDRIVE.connectionString);
    const connecting = made.client.connect();
    connecting.catch(() => {}); // surfaced by the first query instead
    c.set('db', made.db);
    c.set('dbClient', made.client);
    c.set(
      'dbConnecting',
      connecting.catch(() => {}),
    );
    db = made.db;
  }
  return db;
}

export const closeDb: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    await next();
  } finally {
    const client = c.get('dbClient');
    // A route that never queried (get-session without a cookie) still opened a client: end it
    // only once its connection is up. pg's end() on a socket still connecting throws at once,
    // outside its promise, which used to turn the response into a 500.
    if (client)
      c.executionCtx.waitUntil(
        (async () => {
          await c.get('dbConnecting');
          await client.end();
        })().catch(() => {}),
      );
  }
};
