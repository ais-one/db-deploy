// =============================================================================
// userland/drizzle/instance-1.db-inventory.ts
// =============================================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema:  '../schemas/instance-1/db-inventory/index.ts',
  out:     '../migrations/instances/instance-1/db-inventory',
  dialect: 'postgresql',

  dbCredentials: {
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     process.env.DB_USER     ?? '',
    password: process.env.DB_PASS     ?? '',
    database: 'db-inventory',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  },

  migrations: {
    table:  '__drizzle_migrations',
    schema: 'public',
  },

  verbose: true,
  strict:  true,
});
