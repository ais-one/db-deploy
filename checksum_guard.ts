#!/usr/bin/env tsx
// =============================================================================
// scripts/checksum_guard.ts
// =============================================================================
// Drizzle does NOT checksum migration files — it will silently skip an
// already-applied migration even if its contents change. This script
// fills that gap by maintaining a checksums.json file alongside each
// migration directory. It:
//
//   1. On RECORD mode: computes SHA-256 of every .sql file in every
//      migrations directory and writes/updates checksums.json.
//      Run this after `drizzle-kit generate` in CI.
//
//   2. On VERIFY mode: re-computes checksums and compares against the
//      committed checksums.json. Fails if any file has changed.
//      Run this before `migrate` in CI — protects production.
//
// Usage:
//   tsx scripts/checksum_guard.ts verify   ← run before migrate (CI gate)
//   tsx scripts/checksum_guard.ts record   ← run after drizzle-kit generate
// =============================================================================

import { createHash }                    from 'crypto';
import { readFileSync, writeFileSync,
         readdirSync, existsSync }        from 'fs';
import { join, basename }                from 'path';
import { loadRegistry }                  from '../config/loader.js';

const MODE = (process.argv[2] ?? 'verify') as 'verify' | 'record';
const CHECKSUM_FILE = 'checksums.json';

// ── Types ──────────────────────────────────────────────────────────────────
type ChecksumMap = Record<string, string>; // filename → sha256

interface ChecksumStore {
  generated_at: string;
  databases: Record<string, ChecksumMap>; // "instance/db" → map
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function getMigrationFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function computeChecksums(dir: string): ChecksumMap {
  const files = getMigrationFiles(dir);
  const result: ChecksumMap = {};
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    result[file] = sha256(content);
  }
  return result;
}

function loadStore(): ChecksumStore {
  if (!existsSync(CHECKSUM_FILE)) {
    return { generated_at: '', databases: {} };
  }
  return JSON.parse(readFileSync(CHECKSUM_FILE, 'utf-8')) as ChecksumStore;
}

function saveStore(store: ChecksumStore): void {
  writeFileSync(CHECKSUM_FILE, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

// ── Main ───────────────────────────────────────────────────────────────────
const registry = loadRegistry();
const errors: string[] = [];
let totalFiles = 0;

if (MODE === 'record') {
  // ── RECORD: compute and write checksums ──────────────────────────────
  console.log('Recording checksums for all migration files...\n');
  const store: ChecksumStore = {
    generated_at: new Date().toISOString(),
    databases: {},
  };

  for (const [instanceName, instanceCfg] of Object.entries(registry.instances)) {
    for (const dbCfg of instanceCfg.databases) {
      const key = `${instanceName}/${dbCfg.name}`;
      const checksums = computeChecksums(dbCfg.migrations_path);
      store.databases[key] = checksums;
      const count = Object.keys(checksums).length;
      totalFiles += count;
      console.log(`  ✓ ${key.padEnd(40)} ${count} file(s)`);
    }
  }

  saveStore(store);
  console.log(`\n✓ Checksums written to ${CHECKSUM_FILE} (${totalFiles} total files)`);
  console.log('  Commit this file alongside your migration SQL files.\n');

} else if (MODE === 'verify') {
  // ── VERIFY: compare current files against stored checksums ───────────
  console.log('Verifying migration file integrity...\n');
  const store = loadStore();

  if (!store.generated_at) {
    console.error(`ERROR: ${CHECKSUM_FILE} not found.`);
    console.error('Run: tsx scripts/checksum_guard.ts record');
    process.exit(1);
  }

  console.log(`  Checksums recorded at: ${store.generated_at}\n`);

  for (const [instanceName, instanceCfg] of Object.entries(registry.instances)) {
    for (const dbCfg of instanceCfg.databases) {
      const key = `${instanceName}/${dbCfg.name}`;
      const stored  = store.databases[key] ?? {};
      const current = computeChecksums(dbCfg.migrations_path);

      // Check for modified files
      for (const [file, currentHash] of Object.entries(current)) {
        totalFiles++;
        if (!stored[file]) {
          // New file not yet recorded — warn but don't fail
          // (it's a new migration not yet committed with checksums)
          console.log(`  ⚠  ${key}/${file} — new file (not yet recorded)`);
        } else if (stored[file] !== currentHash) {
          errors.push(
            `TAMPERED: ${key}/${file}\n` +
            `  Stored : ${stored[file]}\n` +
            `  Current: ${currentHash}`
          );
        } else {
          console.log(`  ✓ ${key}/${basename(file)}`);
        }
      }

      // Check for deleted files that are still in the store
      for (const storedFile of Object.keys(stored)) {
        if (!(storedFile in current)) {
          errors.push(`DELETED: ${key}/${storedFile} — was in checksums.json but file is gone`);
        }
      }
    }
  }

  console.log();

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} integrity violation(s) detected:\n`);
    for (const e of errors) {
      console.error(`  ✗ ${e}\n`);
    }
    console.error(
      'Migration files must never be edited after generation.\n' +
      'If this was intentional, delete the migration and regenerate it,\n' +
      'then run: tsx scripts/checksum_guard.ts record\n'
    );
    process.exit(1);
  }

  console.log(`✓ All ${totalFiles} migration file(s) are intact.\n`);

} else {
  console.error(`Unknown mode '${MODE}'. Use: verify | record`);
  process.exit(1);
}
