# Original-main integration — 14 November 2026

Before integration, original `khoidm2004/Junction` main was 17 commits ahead of the local base; `ahmedmokeddem/Junction` main remained at that base. Local V2 changes overlapped seven files: backend main/migration/replay, canonical OpenAPI, migration README, mobile App and test runner.

Both histories are retained. Original assessments, daily check-in flows, nature/audio activities, noise filter, reminders and portal changes are preserved alongside opt-in V2 continuity. Original migration 0003 remains unchanged; V2 continuity is renamed 0004. New migration 0005 supplies the reminder table that existed in runtime metadata but was missing from PostgreSQL migrations. The migration runner retains its checksum ledger, explicit adoption and TLS verification. Production liveness survives catalogue-refresh database failures; readiness continues reporting dependency failure.

Verified merged code: PostgreSQL **86 passed**; SQLite **85 passed, one PostgreSQL-only skip**; mobile **63 passed**, lint/typecheck; portal **14 passed**, lint/typecheck and production build; Ruff lint/format; **10 canonical fixtures**. Both new migration sequences applied/replayed on a disposable PostgreSQL database. No Tiger Data migration, Aiven environment update or new native-device verification occurred during this merge. Feature flags remain off by default. Deployments need explicit migrations and a matching rebuilt mobile client.

Private environment files and earlier local TLS/device receipts are excluded from this merge commit. V2 evidence refers to the earlier isolated provider checks, not a new provider/native conversation after integration. The saved provider prompt was not changed by this Git merge.
