#!/usr/bin/env tsx
// =============================================================================
// scripts/detect_changed_dbs.ts
// =============================================================================
// Reads the Git diff to find which migration or schema directories changed,
// then builds a GitHub Actions matrix JSON blob written to GITHUB_OUTPUT.
//
// Watches two path types:
//   migrations/instances/<instance>/<db>/**   ← generated SQL files
//   src/schemas/<instance>/<db>/**            ← TypeScript schema source
//
// Usage (GitHub Actions):
//   DEPLOY_ENV=development tsx scripts/detect_changed_dbs.ts
// =============================================================================

import { execSync }  from 'child_process';
import { appendFileSync } from 'fs';
import { loadRegistry }  from '../config/loader.js';

const DEPLOY_ENV    = process.env.DEPLOY_ENV    ?? 'development';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT ?? '/dev/stdout';
const BASE_REF      = process.env.GITHUB_BASE_REF ?? '';

// ── Get changed files from git ─────────────────────────────────────────────
const diffTarget = BASE_REF ? `origin/${BASE_REF}...HEAD` : 'HEAD~1...HEAD';

let changedFiles: string[] = [];
try {
  const out = execSync(`git diff --name-only ${diffTarget}`, { encoding: 'utf-8' });
  changedFiles = out.trim().split('\n').filter(Boolean);
} catch {
  console.error('WARN: git diff failed — assuming all databases changed.');
}

console.error('Changed files:\n  ' + changedFiles.join('\n  '));

// ── Parse changed paths → (instance, db) pairs ────────────────────────────
function parseChangedDbs(files: string[]): Set<string> {
  const changed = new Set<string>();
  for (const path of files) {
    const parts = path.split('/');

    // migrations/instances/<instance>/<db>/...
    if (parts[0] === 'migrations' && parts[1] === 'instances' && parts.length >= 4) {
      changed.add(`${parts[2]}/${parts[3]}`);
    }

    // src/schemas/<instance>/<db>/...
    if (parts[0] === 'src' && parts[1] === 'schemas' && parts.length >= 4) {
      changed.add(`${parts[2]}/${parts[3]}`);
    }

    // config/databases.yml → treat as all databases changed
    if (path === 'config/databases.yml') {
      changed.add('__all__');
    }
  }
  return changed;
}

const changedDbs = parseChangedDbs(changedFiles);
const allChanged = changedDbs.has('__all__');
console.error('Affected DB pairs:', [...changedDbs]);

// ── Build matrix ───────────────────────────────────────────────────────────
const registry = loadRegistry();

interface MatrixEntry {
  instance:         string;
  db:               string;
  db_type:          string;
  host_secret:      string;
  port:             number;
  user_secret:      string;
  pass_secret:      string;
  snapshot_enabled: boolean;
  migrations_path:  string;
  schema_path:      string;
  drizzle_config:   string;
}

const includes: MatrixEntry[] = [];

for (const [instanceName, instanceCfg] of Object.entries(registry.instances)) {
  const envCfg = instanceCfg.environments[DEPLOY_ENV];
  if (!envCfg) {
    console.error(`WARN: No env config for '${DEPLOY_ENV}' in '${instanceName}' — skipping`);
    continue;
  }

  for (const dbCfg of instanceCfg.databases) {
    const key = `${instanceName}/${dbCfg.name}`;
    if (!allChanged && !changedDbs.has(key)) continue;

    includes.push({
      instance:         instanceName,
      db:               dbCfg.name,
      db_type:          instanceCfg.type,
      host_secret:      envCfg.host_secret,
      port:             envCfg.port,
      user_secret:      dbCfg.user_secret,
      pass_secret:      dbCfg.pass_secret,
      snapshot_enabled: dbCfg.snapshot_enabled,
      migrations_path:  dbCfg.migrations_path,
      schema_path:      dbCfg.schema_path,
      drizzle_config:   `config/drizzle/${instanceName}.${dbCfg.name}.ts`,
    });
  }
}

const matrix = { include: includes };
console.error('Matrix:\n' + JSON.stringify(matrix, null, 2));

// ── Write to GITHUB_OUTPUT ─────────────────────────────────────────────────
appendFileSync(GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
appendFileSync(GITHUB_OUTPUT, `has_changes=${includes.length > 0 ? 'true' : 'false'}\n`);

if (includes.length === 0) {
  console.error('No database changes detected.');
}
