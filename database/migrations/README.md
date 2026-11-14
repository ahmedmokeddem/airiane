# Database migrations

`0001_baseline.sql` is a byte-for-byte copy of `database/schema.sql`, the established baseline. Apply exactly once to an empty PostgreSQL 16+ database using `psql -v ON_ERROR_STOP=1`. It is transactional and preserves existing ownership constraints, private schema privileges, sources and indexes. It is not a reset or populated-database upgrade command. No destructive rollback is automated.

Use a separate migration-owner role; deployers must grant a non-owner runtime role only needed operations as specified in the architecture. The local Docker owner login is fictional development convenience. Future schema changes require new numbered migrations plus contract/schema review; do not edit this initial migration after a shared environment adopts it.

`0002_confirmed_insights.sql` is an additive upgrade for an existing baseline database. It adds patient-approved short insight summaries and source/correction ownership constraints. Rejected or pending proposals remain client memory only. Apply once after reviewing the migration, using the migration-owner credential:

```sh
uv run --directory backend python -m app.migrate --migration 0002_confirmed_insights.sql
```

Do not rerun the baseline on an existing service. Runtime PostgreSQL schemas are never auto-created. The insight API and new report generation require migration 0002; old stored report reads remain compatible. Deletion removes approved text from its whole correction lineage and stored report payloads, preserving only metadata tombstones/audit IDs. Database backups follow the operator's independent retention policy; deletion here does not promise immediate backup erasure.

`0003_clinical_questionnaires.sql` lifts the baseline's "no clinical instrument" check so the product-owner-approved PHQ-9 and extended depression questions can be stored, and lets a questionnaire sent after a positive Q9 reach a connected doctor without a separate alerts grant. It changes no data. Apply once after 0001 (and 0002):

```sh
uv run --directory backend python -m app.migrate --migration 0003_clinical_questionnaires.sql
```

`0004_medication_reminders.sql` adds `re.medication_reminders`, a doctor-set reminder shown on the patient's Home while the connection stays active (one row per patient/clinician pair). Additive: no existing data is changed. Apply once after 0001 (and 0002, 0003):

```sh
uv run --directory backend python -m app.migrate --migration 0004_medication_reminders.sql
```
