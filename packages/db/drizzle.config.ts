import { defineConfig } from 'drizzle-kit';

// Migrations run with the DIRECT (unpooled) connection string (Neon: "Use a direct connection
// for schema migrations"). Column names are snake_case in SQL, camelCase in TypeScript.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
