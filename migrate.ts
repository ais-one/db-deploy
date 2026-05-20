#!/usr/bin/env tsx
// =============================================================================
// scripts/migrate.ts
// =============================================================================
// Runs pending Drizzle migrations against a single instance/database.
// Called by GitHub Actions with secrets injected as environment variables.
//
// Usage:
//   INSTANCE=instance-1 DB=db-orders DEPLOY_ENV=development \
//   DB_HOST=localhost DB_PORT=5432 DB_USER=app DB_PASS=secret \
//   tsx scripts/migrate.ts
// =============================================================================

import { drizzle as drizzlePg }    from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { migrate as migratePg }    from 'drizzle-orm/node-postgres/migrator';
import { migrate as migrateMysql } from 'drizzle-orm/mysql2/migrator';
import pg      from 'pg';
import mysql   from 'mysql2/promise';
import { loadRegistry, resolveDatabase } from '../config/loader.js';

const { Pool } = pg;

// ── Read target from environment ───────────────────────────────────────────
const INSTANCE   = process.env.INSTANCE   ?? '';
const DB         = process.env.DB         ?? '';
const DEPLOY_ENV = process.env.DEPLOY_ENV ?? 'development';

if (!INSTANCE || !DB) {
  console.error('ERROR: INSTANCE and DB environment variables are required.');
  process.exit(1);
}

// ── Resolve config ─────────────────────────────────────────────────────────
const registry = loadRegistry();
const instanceCfg = registry.instances[INSTANCE];
if (!instanceCfg) {
  console.error(`ERROR: Instance '${INSTANCE}' not found in databases.yml`);
  process.exit(1);
}

const dbCfg = instanceCfg.databases.find((d) => d.name === DB);
if (!dbCfg) {
  console.error(`ERROR: Database '${DB}' not found in instance '${INSTANCE}'`);
  process.exit(1);
}

const resolved = resolveDatabase(INSTANCE, instanceCfg, dbCfg, DEPLOY_ENV);

// ── Banner ─────────────────────────────────────────────────────────────────
console.log('═'.repeat(56));
console.log('  Drizzle Migration Runner');
console.log(`  Instance    : ${resolved.instance}`);
console.log(`  Database    : ${resolved.name}`);
console.log(`  Type        : ${resolved.db_type}`);
console.log(`  Environment : ${resolved.deploy_env}`);
console.log(`  Host        : ${resolved.host}:${resolved.port}`);
console.log(`  Migrations  : ${resolved.migrations_path}`);
console.log('═'.repeat(56));

// ── Run migrations ─────────────────────────────────────────────────────────
async function run() {
  const migrationsFolder = resolved.migrations_path;

  if (resolved.db_type === 'postgres') {
    const pool = new Pool({
      host:     resolved.host,
      port:     resolved.port,
      user:     resolved.user,
      password: resolved.pass,
      database: resolved.name,
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    });

    try {
      const db = drizzlePg({ client: pool });
      console.log('\n── Running migrations ──────────────────────────────');
      await migratePg(db, { migrationsFolder });
      console.log(`\n✓ Migrations complete for ${INSTANCE}/${DB}`);
    } finally {
      await pool.end();
    }

  } else if (resolved.db_type === 'mysql' || resolved.db_type === 'mariadb') {
    const connection = await mysql.createConnection({
      host:     resolved.host,
      port:     resolved.port,
      user:     resolved.user,
      password: resolved.pass,
      database: resolved.name,
      ssl:      process.env.DB_SSL === 'true' ? {} : undefined,
    });

    try {
      const db = drizzleMysql({ client: connection });
      console.log('\n── Running migrations ──────────────────────────────');
      await migrateMysql(db, { migrationsFolder });
      console.log(`\n✓ Migrations complete for ${INSTANCE}/${DB}`);
    } finally {
      await connection.end();
    }

  } else {
    console.error(`ERROR: Unsupported db_type '${resolved.db_type}'`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});
