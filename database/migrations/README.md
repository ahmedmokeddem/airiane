# Database migrations

`0001_baseline.sql` is a byte-for-byte copy of `database/schema.sql`, the established baseline. Apply exactly once to an empty PostgreSQL 16+ database using `psql -v ON_ERROR_STOP=1`. It is transactional and preserves existing ownership constraints, private schema privileges, sources and indexes. It is not a reset or populated-database upgrade command. No destructive rollback is automated.

Use a separate migration-owner role; deployers must grant a non-owner runtime role only needed operations as specified in the architecture. The local Docker owner login is fictional development convenience. Future schema changes require new numbered migrations plus contract/schema review; do not edit this initial migration after a shared environment adopts it.

`0002_confirmed_insights.sql` is an additive upgrade for an existing baseline database. It adds patient-approved short insight summaries and source/correction ownership constraints. Rejected or pending proposals remain client memory only. Apply once after reviewing the migration, using the migration-owner credential:

```sh
uv run --directory backend python -m app.migrate --migration 0002_confirmed_insights.sql
```

Do not rerun the baseline on an existing service. Runtime PostgreSQL schemas are never auto-created. The insight API and new report generation require migration 0002; old stored report reads remain compatible. Deletion removes approved text from its whole correction lineage and stored report payloads, preserving only metadata tombstones/audit IDs. Database backups follow the operator's independent retention policy; deletion here does not promise immediate backup erasure.


`0003_companion_continuity.sql` adds backend-owned relationship state, explicit memory preference and once-per-patient-local-day check-in uniqueness. It stores no raw conversation history. Apply only after 0001 and 0002 have been recorded in the migration ledger:

```sh
uv run --directory backend python -m app.migrate --migration 0003_companion_continuity.sql
```

V2 API readiness requires these tables only when `RE_COMPANION_V2_ENABLED=true`. Keep that flag off until migration and the matching mobile client have been validated. This migration was tested on disposable PostgreSQL; it has **not** been applied to the configured Tiger Data production service. For a pre-ledger populated database, review existing DDL and the migration runner's explicit adoption options first; never rerun the baseline blindly.
