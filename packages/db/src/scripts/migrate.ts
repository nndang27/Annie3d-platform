// Applies SQL migrations with the DIRECT connection string (never the pooled one).
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.MIGRATE_URL ?? process.env.DATABASE_URL_DEV;
if (!url) throw new Error('Set MIGRATE_URL or DATABASE_URL_DEV');
if (new URL(url).hostname.includes('-pooler'))
  throw new Error('Use the direct (unpooled) connection string for migrations');
const u = new URL(url);
u.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: u.toString() });
await client.connect();
const started = Date.now();
await migrate(drizzle({ client }), {
  migrationsFolder: new URL('../../migrations', import.meta.url).pathname,
});
const { rows } = await client.query(
  "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
);
console.log(`migrations applied in ${Date.now() - started} ms; ${rows[0].n} tables in public`);
await client.end();
