// =============================================================================
// drizzle.instance-2.db-users.config.ts
// =============================================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schemas/instance-2/db-users/index.ts',
  out:    './migrations/instances/instance-2/db-users',
  dialect: 'mysql',

  dbCredentials: {
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 3306),
    user:     process.env.DB_USER     ?? '',
    password: process.env.DB_PASS     ?? '',
    database: 'db-users',
    ssl:      process.env.DB_SSL === 'true' ? {} : undefined,
  },

  migrations: {
    table: '__drizzle_migrations',
  },

  verbose: true,
  strict:  true,
});
