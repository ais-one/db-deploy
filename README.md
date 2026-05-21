# Database Migration Management (Drizzle ORM)

Schema version control and CI/CD for multiple database instances using **Drizzle ORM** and **GitHub Actions**.

---

## Repository Layout

```
.
├── scripts/                    # Framework — do not edit (sync from upstream)
│   ├── loader.ts               # Typed config reader for databases.yml
│   ├── migrate.ts              # Runs Drizzle migrator for one DB
│   ├── validate_migrations.ts  # PR validator: naming, journal consistency
│   ├── checksum_guard.ts       # SHA-256 integrity guard for migration files
│   ├── detect_changed_dbs.ts   # Builds GitHub Actions matrix from git diff
│   └── snapshot_schema.ts      # pg_dump / mysqldump after deploy
│
├── userland/                   # Your code — edit freely
│   ├── databases.yml           # ← Add new instances/databases here
│   ├── drizzle/                # One Drizzle Kit config per database
│   │   ├── instance-1.db-orders.ts
│   │   ├── instance-1.db-inventory.ts
│   │   └── instance-2.db-users.ts
│   ├── schemas/                # TypeScript schema files (source of truth)
│   │   ├── instance-1/
│   │   │   ├── db-orders/index.ts
│   │   │   └── db-inventory/index.ts
│   │   └── instance-2/
│   │       └── db-users/index.ts
│   ├── migrations/             # Generated SQL (committed, never hand-edited)
│   │   └── instances/
│   ├── snapshots/              # Auto-generated post-deploy schema dumps
│   └── checksums.json          # SHA-256 map of all migration files
│
├── .github/
│   ├── actions/setup-node/     # Composite action: Node + npm ci
│   └── workflows/
│       ├── migrate.yml         # Main pipeline: dev → staging → prod
│       ├── validate-pr.yml     # PR checks: types, naming, checksums
│       └── update-template.yml # Pulls upstream template changes via PR
│
├── .githooks/
│   └── pre-commit              # Auto-records checksums on migration commits
│
├── package.json
└── tsconfig.json
```

---

## Daily Workflow

### Changing a schema

```bash
# 1. Edit the TypeScript schema file (this is the source of truth)
vim userland/schemas/instance-1/db-orders/index.ts

# 2. Generate the SQL migration file
drizzle-kit generate --config=userland/drizzle/instance-1.db-orders.ts
#   → writes userland/migrations/instances/instance-1/db-orders/0003_add_payment_method.sql

# 3. Checksums are auto-updated by the pre-commit hook when you commit
git add .
git commit -m "feat: add payment_method to orders"
# → pre-commit hook fires → userland/checksums.json auto-updated and staged

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

## Adding a New Database

1. **Edit `userland/databases.yml`** — add the database under the correct instance
2. **Create the Drizzle config**:
   ```bash
   cp userland/drizzle/instance-1.db-orders.ts userland/drizzle/instance-1.db-newdb.ts
   # Edit the new file: update schema, out, and database fields
   ```
3. **Create the schema file**:
   ```bash
   mkdir -p userland/schemas/instance-1/db-newdb
   # Write your schema in userland/schemas/instance-1/db-newdb/index.ts
   ```
4. **Generate first migration**:
   ```bash
   drizzle-kit generate --config=userland/drizzle/instance-1.db-newdb.ts
   ```
5. **Add GitHub Secrets** for each environment (see below)
6. Commit everything — the pre-commit hook handles checksums automatically

---

## Checksums — Drizzle's Missing Safety Net

Drizzle does not checksum migration files. If someone edits a past migration
file, Drizzle silently skips it (it's already marked as applied).

`userland/checksums.json` fills this gap:

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

Secret names are defined in `userland/databases.yml`.

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
// userland/schemas/instance-1/db-orders/index.ts
// Remove the column you added, then:
drizzle-kit generate --config=userland/drizzle/instance-1.db-orders.ts
```

### Emergency: restore from snapshot
```bash
# Postgres
psql -h $HOST -U $USER -d db-orders < userland/snapshots/instance-1/db-orders/schema_latest.sql

# MySQL
mysql -h $HOST -u $USER -p db-users < userland/snapshots/instance-2/db-users/schema_latest.sql
```

---

## Drizzle Kit Commands (per database)

```bash
# Generate migration from schema diff
drizzle-kit generate --config=userland/drizzle/instance-1.db-orders.ts

# Browse schema in Drizzle Studio (local DB)
drizzle-kit studio --config=userland/drizzle/instance-1.db-orders.ts

# Check pending migrations (read-only)
drizzle-kit check --config=userland/drizzle/instance-1.db-orders.ts
```
