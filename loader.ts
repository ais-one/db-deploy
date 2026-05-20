// =============================================================================
// config/loader.ts
// =============================================================================
// Reads databases.yml and provides typed access to the registry.
// Used by all scripts and drizzle config generators.
// =============================================================================

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, 'databases.yml');

// ── Types ──────────────────────────────────────────────────────────────────

export type DbType = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

export interface EnvConfig {
  host_secret: string;
  port: number;
}

export interface DatabaseConfig {
  name: string;
  schema_path: string;
  migrations_path: string;
  user_secret: string;
  pass_secret: string;
  snapshot_enabled: boolean;
}

export interface InstanceConfig {
  description: string;
  type: DbType;
  environments: Record<string, EnvConfig>;
  databases: DatabaseConfig[];
}

export interface Registry {
  instances: Record<string, InstanceConfig>;
}

// ── Resolved (runtime secrets injected) ───────────────────────────────────

export interface ResolvedDatabase extends DatabaseConfig {
  instance: string;
  db_type: DbType;
  host: string;
  port: number;
  user: string;
  pass: string;
  deploy_env: string;
}

// ── Loader ─────────────────────────────────────────────────────────────────

export function loadRegistry(): Registry {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8');
  return yaml.load(raw) as Registry;
}

/**
 * Resolve a single database config by injecting environment secrets.
 * Secrets are read from process.env using the secret names in databases.yml.
 */
export function resolveDatabase(
  instanceName: string,
  instanceCfg: InstanceConfig,
  dbCfg: DatabaseConfig,
  deployEnv: string
): ResolvedDatabase {
  const envCfg = instanceCfg.environments[deployEnv];
  if (!envCfg) {
    throw new Error(
      `No environment config for '${deployEnv}' in instance '${instanceName}'`
    );
  }

  const host = process.env[envCfg.host_secret];
  const user = process.env[dbCfg.user_secret];
  const pass = process.env[dbCfg.pass_secret];

  if (!host) throw new Error(`Missing env var: ${envCfg.host_secret}`);
  if (!user) throw new Error(`Missing env var: ${dbCfg.user_secret}`);
  if (!pass) throw new Error(`Missing env var: ${dbCfg.pass_secret}`);

  return {
    ...dbCfg,
    instance: instanceName,
    db_type: instanceCfg.type,
    host,
    port: envCfg.port,
    user,
    pass,
    deploy_env: deployEnv,
  };
}

/**
 * Get all databases for a given environment, with secrets resolved.
 */
export function getAllResolvedDatabases(deployEnv: string): ResolvedDatabase[] {
  const registry = loadRegistry();
  const resolved: ResolvedDatabase[] = [];

  for (const [instanceName, instanceCfg] of Object.entries(registry.instances)) {
    for (const dbCfg of instanceCfg.databases) {
      resolved.push(resolveDatabase(instanceName, instanceCfg, dbCfg, deployEnv));
    }
  }

  return resolved;
}
