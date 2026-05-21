# GitHub Issue Labels — Database Changes

Labels for tracking schema migrations, data changes, and deployment issues in this repository.

---

## Label Definitions

### Type — what kind of change is this?

| Label | Color | Description |
|---|---|---|
| `type: migration` | `#0075ca` | Drizzle schema migration (add/alter/drop tables, columns, indexes) |
| `type: data-fix` | `#e4e669` | One-off correction to existing row data |
| `type: seed-data` | `#cfd3d7` | Reference or initial data changes |
| `type: query-optimization` | `#d4edda` | Performance tuning with no schema change |
| `type: config` | `#f9d0c4` | Changes to `databases.yml`, Drizzle configs, or CI workflows |

### Risk — what could go wrong?

| Label | Color | Description |
|---|---|---|
| `risk: breaking-change` | `#d93f0b` | Removes or renames a column/table that existing app code depends on |
| `risk: requires-downtime` | `#e11d48` | Migration cannot run while the app is live |
| `risk: large-table` | `#f97316` | Targets a table with significant row counts — expect slow migration |
| `risk: backfill-required` | `#fb923c` | New column or constraint requires existing rows to be updated |
| `risk: checksum-sensitive` | `#fbbf24` | Touches committed migration files — checksum guard will be triggered |

### Stage — where is this issue in the workflow?

Each issue should have exactly one `stage:` label at any given time.

| Label | Color | Description |
|---|---|---|
| `stage: backlog` | `#cfd3d7` | Identified but not yet scheduled for work |
| `stage: in-progress` | `#0075ca` | Actively being worked on |
| `stage: in-review` | `#d4edda` | PR open, awaiting code or DBA review |
| `stage: blocked` | `#b60205` | Cannot proceed — waiting on another migration, PR, or deployment |
| `stage: deploying` | `#f97316` | Merged and running through dev → staging → prod pipeline |
| `stage: complete` | `#006b75` | Deployed to production and verified |
| `stage: cancelled` | `#e4e4e4` | Will not be done — superseded or no longer needed |

### Gate — approval requirements before promoting

| Label | Color | Description |
|---|---|---|
| `gate: needs-rollback-plan` | `#6f42c1` | Destructive enough to require a documented rollback before merging |
| `gate: ready-for-review` | `#0e8a16` | Migration generated, checksums recorded, ready for DBA/tech-lead review |
| `gate: approved-for-prod` | `#1a7f37` | Reviewed and cleared to promote through staging → production |

### Environment — where does this apply?

| Label | Color | Description |
|---|---|---|
| `env: dev-only` | `#bfd4f2` | Intentionally scoped to development — will not be promoted |
| `env: staging` | `#0075ca` | Applied to staging (add alongside `env: dev-only` once staging is reached) |
| `env: production` | `#e11d48` | Applied to production (add alongside the others once prod is reached) |

---

## Applying Labels to Issues

**Minimum labels per issue:** one `type:` + one `stage:` + any applicable `risk:` labels.

- `stage:` — **exactly one** at a time; update it as work progresses.
- `env:` — **one or more**; add each environment label as the migration is applied there. An issue that has reached production will carry all three: `env: dev-only` is mutually exclusive with the others.
- `type:`, `risk:`, `gate:` — set at creation and stay fixed.

**Example: adding a nullable column**
- `type: migration`, `risk: backfill-required`, `gate: needs-rollback-plan`, `stage: backlog`

**Example: dropping a table**
- `type: migration`, `risk: breaking-change`, `risk: requires-downtime`, `gate: needs-rollback-plan`, `stage: in-progress`

**Example: updating lookup data**
- `type: seed-data`, `env: production`, `stage: in-review`

**Example: index creation on large table**
- `type: migration`, `risk: large-table`, `gate: needs-rollback-plan`, `stage: deploying`

---

## Setting Up Labels in GitHub

Run the following with the [GitHub CLI](https://cli.github.com/) to create all labels at once:

```bash
# Type labels
gh label create "type: migration"           --color "0075ca" --description "Drizzle schema migration"
gh label create "type: data-fix"            --color "e4e669" --description "One-off data correction"
gh label create "type: seed-data"           --color "cfd3d7" --description "Reference or initial data changes"
gh label create "type: query-optimization"  --color "d4edda" --description "Performance tuning, no schema change"
gh label create "type: config"              --color "f9d0c4" --description "databases.yml, Drizzle configs, or CI workflows"

# Risk labels
gh label create "risk: breaking-change"     --color "d93f0b" --description "Removes or renames something app code depends on"
gh label create "risk: requires-downtime"   --color "e11d48" --description "Cannot run while the app is live"
gh label create "risk: large-table"         --color "f97316" --description "Targets a high-row-count table — expect slow migration"
gh label create "risk: backfill-required"   --color "fb923c" --description "Existing rows must be updated"
gh label create "risk: checksum-sensitive"  --color "fbbf24" --description "Touches committed migration files"

# Stage labels
gh label create "stage: backlog"     --color "cfd3d7" --description "Identified but not yet scheduled"
gh label create "stage: in-progress" --color "0075ca" --description "Actively being worked on"
gh label create "stage: in-review"   --color "d4edda" --description "PR open, awaiting review"
gh label create "stage: blocked"     --color "b60205" --description "Cannot proceed — waiting on dependency"
gh label create "stage: deploying"   --color "f97316" --description "Running through dev → staging → prod pipeline"
gh label create "stage: complete"    --color "006b75" --description "Deployed to production and verified"
gh label create "stage: cancelled"   --color "e4e4e4" --description "Will not be done"

# Gate labels
gh label create "gate: needs-rollback-plan"  --color "6f42c1" --description "Requires documented rollback before merging"
gh label create "gate: ready-for-review"     --color "0e8a16" --description "Ready for DBA or tech-lead review"
gh label create "gate: approved-for-prod"    --color "1a7f37" --description "Cleared for staging → production promotion"

# Environment labels
gh label create "env: dev-only"    --color "bfd4f2" --description "Not for staging or production"
gh label create "env: staging"     --color "bfd4f2" --description "Validated in staging, pending production gate"
gh label create "env: production"  --color "e11d48" --description "Affects or has been applied to production"
```

> Run this from inside the repository with a GitHub remote configured, or pass `--repo owner/repo` explicitly.
