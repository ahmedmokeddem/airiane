# Database migrations

`0001_baseline.sql` is a byte-for-byte copy of `database/schema.sql`, the established baseline. Apply exactly once to an empty PostgreSQL 16+ database using `psql -v ON_ERROR_STOP=1`. It is transactional and preserves existing ownership constraints, private schema privileges, sources and indexes. It is not a reset or populated-database upgrade command. No destructive rollback is automated.

Use a separate migration-owner role; deployers must grant a non-owner runtime role only needed operations as specified in the architecture. The local Docker owner login is fictional development convenience. Future schema changes require new numbered migrations plus contract/schema review; do not edit this initial migration after a shared environment adopts it.
