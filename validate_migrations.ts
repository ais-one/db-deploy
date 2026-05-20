#!/usr/bin/env tsx
// =============================================================================
// scripts/validate_migrations.ts
// =============================================================================
// Validates Drizzle migration files for naming conventions and consistency.
// Run on PRs — no DB connection needed.
//
// Drizzle generates migrations named like:
//   0000_initial_schema.sql
//   0001_add_order_items.sql
//   meta/_journal.json           ← Drizzle's own manifest
//
// Rules enforced:
//   1. Numeric prefix is zero-padded to 4 digits
//   2. Description uses only [a-z0-9_]
//   3. No duplicate prefixes within a database
//   4. _journal.json exists and is consistent with SQL files present
//   5. No SQL files present without a journal entry (orphans)
// =============================================================================

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join }  from 'path';
import { loadRegistry } from '../config/loader.js';

const MIGRATION_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

interface JournalEntry {
  idx:  number;
  when: number;
  tag:  string;   // e.g. "0001_add_order_items"
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const errors:   string[] = [];
const warnings: string[] = [];
let   totalFiles = 0;

function validateDatabase(instance: string, db: string, migrationsPath: string) {
  if (!existsSync(migrationsPath)) {
    warnings.push(`[${instance}/${db}] Migration directory not found: ${migrationsPath}`);
    return;
  }

  const allFiles = readdirSync(migrationsPath);
  const sqlFiles = allFiles.filter((f) => f.endsWith('.sql') && !f.startsWith('_')).sort();
  const metaDir  = join(migrationsPath, 'meta');
  const journalPath = join(metaDir, '_journal.json');

  // ── Parse journal ────────────────────────────────────────────────────────
  let journal: Journal | null = null;
  if (existsSync(journalPath)) {
    try {
      journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as Journal;
    } catch {
      errors.push(`[${instance}/${db}] Failed to parse meta/_journal.json`);
    }
  } else {
    warnings.push(`[${instance}/${db}] meta/_journal.json not found — run drizzle-kit generate`);
  }

  const journalTags = new Set(journal?.entries.map((e) => e.tag) ?? []);
  const prefixesSeen = new Map<string, string>(); // prefix → filename

  // ── Validate each SQL file ───────────────────────────────────────────────
  for (const file of sqlFiles) {
    totalFiles++;

    if (' '.includes(file)) {
      errors.push(`[${instance}/${db}] Filename contains spaces: '${file}'`);
      continue;
    }

    const match = MIGRATION_RE.exec(file);
    if (!match) {
      errors.push(
        `[${instance}/${db}] Invalid migration filename: '${file}'\n` +
        `  Expected: {NNNN}_{description}.sql  e.g. 0001_add_orders_table.sql\n` +
        `  (Drizzle generates these automatically — don't rename manually)`
      );
      continue;
    }

    const prefix = match[1]!;
    const tag    = file.replace('.sql', ''); // e.g. "0001_add_orders_table"

    // Duplicate prefix check
    if (prefixesSeen.has(prefix)) {
      errors.push(
        `[${instance}/${db}] Duplicate prefix '${prefix}': ` +
        `'${prefixesSeen.get(prefix)}' and '${file}'`
      );
    } else {
      prefixesSeen.set(prefix, file);
    }

    // Journal consistency check
    if (journal && !journalTags.has(tag)) {
      errors.push(
        `[${instance}/${db}] '${file}' exists on disk but has no entry in meta/_journal.json.\n` +
        `  This migration is an orphan — regenerate or remove it.`
      );
    }

    // Warn about suspiciously short descriptions
    const description = match[2]!;
    if (description.length < 4) {
      warnings.push(`[${instance}/${db}] Very short description in '${file}'`);
    }
  }

  // ── Check journal entries with no corresponding SQL file ─────────────────
  if (journal) {
    for (const entry of journal.entries) {
      const expectedFile = `${entry.tag}.sql`;
      if (!sqlFiles.includes(expectedFile)) {
        errors.push(
          `[${instance}/${db}] Journal references '${entry.tag}' but '${expectedFile}' is missing.\n` +
          `  Don't delete migration files after they've been committed.`
        );
      }
    }
  }

  const latestIdx = prefixesSeen.size > 0
    ? Math.max(...[...prefixesSeen.keys()].map(Number))
    : -1;

  console.log(
    `  ✓ ${(instance + '/' + db).padEnd(42)} ` +
    `${sqlFiles.length} migration(s)` +
    (latestIdx >= 0 ? `, latest: ${String(latestIdx).padStart(4, '0')}` : '')
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║   Drizzle Migration Validation                   ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const registry = loadRegistry();
for (const [instanceName, instanceCfg] of Object.entries(registry.instances)) {
  for (const dbCfg of instanceCfg.databases) {
    validateDatabase(instanceName, dbCfg.name, dbCfg.migrations_path);
  }
}

console.log();

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} warning(s):\n`);
  warnings.forEach((w) => console.log(`  ⚠  ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.error(`❌ ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error(`  ✗  ${e}\n`));
  process.exit(1);
} else {
  console.log(`✅ All ${totalFiles} migration file(s) are valid.\n`);
}
