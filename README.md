# Database Migration Management (Drizzle ORM)

Schema version control and CI/CD for multiple database instances using **Drizzle ORM** and **GitHub Actions**.

---

## Daily Workflow

### Changing a schema

```bash
# 1. Edit the TypeScript schema file (this is the source of truth)
vim src/schemas/instance-1/db-orders/index.ts

# 2. Generate the SQL migration file
drizzle-kit generate --config=config/drizzle/instance-1.db-orders.ts
#   → writes migrations/instances/instance-1/db-orders/0003_add_payment_method.sql

# 3. Checksums are auto-updated by the pre-commit hook when you commit
git add .
git commit -m "feat: add payment_method to orders"
# → pre-commit hook fires → checksums.json auto-updated and staged

# 4. Open a PR → validate-pr.yml runs automatically
# 5. Merge → migrate.yml promotes dev → staging → prod (with approval gate)
```

### Running migrations locally

```bash
export INSTANCE=instance-1
export DB=db-orders
export DEPLOY_ENV=development
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=myuser
export DB_PASS=mypassword

npm run migrate
```

---

## Repository Structure

```
.
├── .github/
│   ├── actions/
│   │   └── setup-node/         # Composite action: Node + npm ci
│   └── workflows/
│       ├── migrate.yml         # Main pipeline: dev → staging → prod
│       └── validate-pr.yml     # PR checks: types, naming, checksums
│
├── .githooks/
│   └── pre-commit              # Auto-records checksums on migration commits
│
├── config/
│   ├── databases.yml           # ← Add new instances/databases here
│   ├── loader.ts               # Typed config reader (used by all scripts)
│   └── drizzle/
│       ├── instance-1.db-orders.ts      # One config per database
│       ├── instance-1.db-inventory.ts
│       └── instance-2.db-users.ts
│
├── src/
│   └── schemas/
│       ├── instance-1/
│       │   ├── db-orders/index.ts       # ← Edit these to change schema
│       │   └── db-inventory/index.ts
│       └── instance-2/
│           └── db-users/index.ts
│
├── migrations/
│   └── instances/
│       ├── instance-1/
│       │   ├── db-orders/               # Generated SQL + meta/_journal.json
│       │   └── db-inventory/
│       └── instance-2/
│           └── db-users/
│
├── schemas/                    # Auto-generated post-deploy snapshots
│   └── instance-1/
│       └── db-orders/
│           ├── schema_latest.sql
│           └── schema_2025-01-20_14-30-22.sql
│
├── scripts/
│   ├── migrate.ts              # Runs Drizzle migrator for one DB
│   ├── snapshot_schema.ts      # pg_dump / mysqldump after deploy
│   ├── detect_changed_dbs.ts   # Builds GitHub Actions matrix from git diff
│   ├── validate_migrations.ts  # PR validator: naming, journal consistency
│   └── checksum_guard.ts       # Compensates for Drizzle's no-checksum gap
│
├── checksums.json              # Committed SHA-256 map of all migration files
├── package.json
└── tsconfig.json
```

---

## Adding a New Database

1. **Edit `config/databases.yml`** — add the database under the correct instance
2. **Create the Drizzle config**:
   ```bash
   cp config/drizzle/instance-1.db-orders.ts config/drizzle/instance-1.db-newdb.ts
   # Edit the new file: update schema, out, and database fields
   ```
3. **Create the schema file**:
   ```bash
   mkdir -p src/schemas/instance-1/db-newdb
   # Write your schema in src/schemas/instance-1/db-newdb/index.ts
   ```
4. **Generate first migration**:
   ```bash
   drizzle-kit generate --config=config/drizzle/instance-1.db-newdb.ts
   ```
5. **Add GitHub Secrets** for each environment (see below)
6. Commit everything — the pre-commit hook handles checksums automatically

---

## Checksums — Drizzle's Missing Safety Net

Drizzle does not checksum migration files. If someone edits a past migration
file, Drizzle silently skips it (it's already marked as applied).

`checksums.json` fills this gap:

| Command | When to run |
|---|---|
| `npm run checksum record` | After `drizzle-kit generate` (pre-commit hook does this automatically on commit) |
| `npm run checksum verify` | Before `migrate` in CI (all three environments) |

The CI pipeline **always runs `verify` before migrating** — a tampered file
blocks deployment.

---

## GitHub Secrets Required

For each database, add these to GitHub (scoped per environment):

| Secret | Description |
|---|---|
| `INSTANCE1_DEV_HOST` | Postgres host (development) |
| `INSTANCE1_STG_HOST` | Postgres host (staging) |
| `INSTANCE1_PRD_HOST` | Postgres host (production) |
| `INSTANCE1_ORDERS_USER` | DB username |
| `INSTANCE1_ORDERS_PASS` | DB password |

Secret names are defined in `config/databases.yml`.

---

## GitHub Environments Setup

1. **Settings → Environments** → create `development`, `staging`, `production`
2. For **production**:
   - Add **Required reviewers** (DBAs, tech leads)
   - Enable **Prevent self-review**
   - Optional: **Wait timer** (e.g. 30 min after staging)

---

## Rollback

### Preferred: write a new migration
```typescript
// src/schemas/instance-1/db-orders/index.ts
// Remove the column you added, then:
drizzle-kit generate --config=config/drizzle/instance-1.db-orders.ts
```

### Emergency: restore from snapshot
```bash
# Postgres
psql -h $HOST -U $USER -d db-orders < schemas/instance-1/db-orders/schema_latest.sql

# MySQL
mysql -h $HOST -u $USER -p db-users < schemas/instance-2/db-users/schema_latest.sql
```

---

## Drizzle Kit Commands (per database)

```bash
# Generate migration from schema diff
drizzle-kit generate --config=config/drizzle/instance-1.db-orders.ts

# Browse schema in Drizzle Studio (local DB)
drizzle-kit studio --config=config/drizzle/instance-1.db-orders.ts

# Check pending migrations (read-only)
drizzle-kit check --config=config/drizzle/instance-1.db-orders.ts
```
