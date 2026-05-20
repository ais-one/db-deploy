// =============================================================================
// drizzle.instance-1.db-orders.config.ts
// =============================================================================
// Drizzle Kit config for instance-1 / db-orders (Postgres).
//
// Usage:
//   drizzle-kit generate --config=config/drizzle/instance-1.db-orders.ts
//   drizzle-kit studio  --config=config/drizzle/instance-1.db-orders.ts
//
// Connection is read from environment variables (injected by CI or .env.local).
// =============================================================================

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Path to the schema file for this database
  schema: './src/schemas/instance-1/db-orders/index.ts',

  // Where generated migration SQL files will be written
  out: './migrations/instances/instance-1/db-orders',

  dialect: 'postgresql',

  dbCredentials: {
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     process.env.DB_USER     ?? '',
    password: process.env.DB_PASS     ?? '',
    database: 'db-orders',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  },

  // Migration table name (one per database, like Flyway's schema_history)
  migrations: {
    table:  '__drizzle_migrations',
    schema: 'public',
  },

  // Print every SQL statement Drizzle generates
  verbose: true,

  // Fail loudly on breaking changes rather than silently skipping
  strict: true,
});
