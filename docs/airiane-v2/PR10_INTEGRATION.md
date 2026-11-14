# PR #10 integration — 14 November 2026

PR #10 (`1b76bc5`, “Fix failed CI/CD quality gate pipeline (deploy checks)”) overlaps the prior main merge. Its history is retained as a merge parent. Existing V2 and original-main features remain present; no provider agent or hosted database settings were edited.

- Added the missing portal `output: standalone`; verified `.next/standalone/portal/server.js`, matching Dockerfile expectations.
- Kept main's tested database-outage/liveness handling and V2-aware checksum-ledger runner rather than replacing them with older versions.
- Retained original migration 0003, V2 migration 0004 and reminder table migration 0005. The PR's second CREATE TABLE migration 0004 is superseded, preventing duplicate table creation and numbering collisions.
- New additive migration **0006_medication_reminder_constraints.sql** preserves the PR's UUID/time/active defaults, 1–500-character message constraint, clinician-profile foreign key, active-patient index and table comment. Apply explicitly after 0005. Existing invalid data causes transactional failure; no automatic data removal is performed.
- CI and container verification apply all six migrations. Hosted migrations were not run.

Validation: all six migrations applied and replayed on disposable PostgreSQL; FK/check/index inspected; **86 backend PostgreSQL tests**, **14 portal tests**, portal lint/typecheck and standalone production build passed; backend Ruff lint/format passed. Mobile source and approved artwork are unchanged by this PR integration. Existing local-only environment/diagnostic files are excluded.
