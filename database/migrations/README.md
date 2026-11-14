# Database migrations

`0001_baseline.sql` is a byte-for-byte copy of `database/schema.sql`, the established baseline. Apply exactly once to an empty PostgreSQL 16+ database using `psql -v ON_ERROR_STOP=1`. It is transactional and preserves existing ownership constraints, private schema privileges, sources and indexes. It is not a reset or populated-database upgrade command. No destructive rollback is automated.

Use a separate migration-owner role; deployers must grant a non-owner runtime role only needed operations as specified in the architecture. The local Docker owner login is fictional development convenience. Future schema changes require new numbered migrations plus contract/schema review; do not edit this initial migration after a shared environment adopts it.

`0002_confirmed_insights.sql` is an additive upgrade for an existing baseline database. It adds patient-approved short insight summaries and source/correction ownership constraints. Rejected or pending proposals remain client memory only. Apply once after reviewing the migration, using the migration-owner credential:

```sh
uv run --directory backend python -m app.migrate --migration 0002_confirmed_insights.sql
```

Do not rerun the baseline on an existing service. Runtime PostgreSQL schemas are never auto-created. The insight API and new report generation require migration 0002; old stored report reads remain compatible. Deletion removes approved text from its whole correction lineage and stored report payloads, preserving only metadata tombstones/audit IDs. Database backups follow the operator's independent retention policy; deletion here does not promise immediate backup erasure.
