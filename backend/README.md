# FastAPI first vertical slice

Run from the repository root. Python 3.12+, uv, and PostgreSQL 16+ are required for the integrated path.

```sh
uv sync --project backend --group dev --frozen
cp backend/.env.example backend/.env
docker run --rm --name re-postgres -e POSTGRES_USER=re -e POSTGRES_PASSWORD=re_local_development_only -e POSTGRES_DB=re -p 127.0.0.1:55432:5432 postgres:16
docker exec -i re-postgres psql -U re -d re -v ON_ERROR_STOP=1 < database/migrations/0001_baseline.sql
uv run --directory backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The migration is the existing 32-table baseline, versioned unchanged. Apply once to an **empty disposable database**; it deliberately fails on a populated schema. No startup PostgreSQL DDL runs. For quick isolated development, use `RE_DATABASE_URL=sqlite+aiosqlite:///./re-local.db`: only mapped slice tables are created; this mode does not validate PostgreSQL constraints and is blocked outside development. The first startup seeds Calm Breathing; later startups retain saved records.

`RE_DEMO_AUTH=true` accepts `Bearer demo-patient-token` and `demo-other-patient-token`, **fictional identities only**, only with `RE_ENVIRONMENT=development`. POST `/v1/me/onboarding` before authenticated domain requests. Tokens are explicit integration fixtures, not passwords or production credentials. Production verifies Supabase issuer/audience/expiry/signature against JWKS and checks disabled/current application roles in PostgreSQL. No user-editable JWT metadata authorizes access. Actual Supabase account validation remains untested.

All writes require UUID `Idempotency-Key`. Create session → PATCH active using expected_version → POST recommendations → POST activity session with returned IDs → POST complete event → POST feedback → GET my-journey. Responses and request bodies are validated against committed OpenAPI. Current catalog contains one optional breathing activity; other activities, transcript persistence, observations, reports and clinician permissions remain later slices. Backend never supplies mocked report or clinician data.

Four client tool paths are wired: recommendations, selection, patient context, next guided question. Observation/review tools remain unimplemented and fail validation rather than inventing writes. A live tool dispatch requires an active owned provider connection. Camera state/media are absent from all contracts and persistence.

## ElevenLabs configuration and verification

Provider credentials belong only in the local environment. Actual saved-agent privacy readback and the first physical Android voice/tool test are now recorded in docs/IMPLEMENTATION_STATUS.md. Bootstrap returns `503 PROVIDER_PRIVACY_UNVERIFIED` until an operator verifies actual saved recording/transcript retention policy and sets the versioned server configuration. Then private voice token or text-only signed URL provisioning uses the server-only ElevenLabs key. This configuration flag is a release gate, not proof of provider settings; never set it merely to bypass the blocker. A real SDK/provider voice connection is verified on one Android device; actual retention/deletion behavior and complete microphone/camera isolation coverage remain untested. Provider credentials are never written to SQL or logs; Credential retries use a bounded encrypted in-process cache (128 entries), recheck ownership, and expire at the local connection-start guard or an earlier known provider expiry. SQL stores only key/hash/resource metadata. Restart/eviction produces CREDENTIAL_EXPIRED for an existing key; request a new connection explicitly. Provider connection state is separate from application session state.

```sh
uv run --directory backend ruff check app tests
uv run --directory backend ruff format --check app tests
uv run --directory backend pytest tests -q
TEST_DATABASE_URL=postgresql+asyncpg://re:re_local_development_only@127.0.0.1:55432/re uv run --directory backend pytest tests -q
```

The PostgreSQL run was executed against the disposable local PostgreSQL baseline. Tests verify persisted completion/feedback/My Journey, ownership, optimistic versions, replay/conflict, privacy gate and camera field rejection. SQLite tests are convenience checks, never evidence of PostgreSQL behavior. This is a first local development foundation, not a production-ready or clinical deployment.

CI migration alternative (without a psql installation): `RE_DATABASE_URL=postgresql+asyncpg://... uv run --directory backend python -m app.migrate`. Set TEST_DATABASE_URL only to an explicitly disposable local/CI database; tests create fictional patient rows and do not reset or delete existing records. Unique fictional test subjects prevent journey accumulation across cases.

## Tiger Data connection URLs

Set `RE_DATABASE_URL` in `backend/.env` to the provider's connection URL. `postgres://`, `postgresql://`, and `postgresql+asyncpg://` are accepted. Keep Tiger Data's `?sslmode=require` parameter; the native asyncpg connection parses it for both runtime and migrations. The previous `?ssl=require` spelling is also normalized. URL-encode password characters when composing a URL manually. Never place credentials in mobile environment variables.

Apply the baseline once to a new database with `uv run --directory backend python -m app.migrate`. Existing populated `re` schemas must be inspected before migrating; the baseline does not overwrite tables.

## Stored reports and clinician authorization

The existing report, care-link, consent and doctor-report endpoints are now routed without changing OpenAPI or the baseline migration. `POST /v1/reports` creates a pending record and processes its bounded factual projection within the same application transaction, returning the canonical 202 receipt (currently ready on success). No separate worker/microservice was added. Reports include accepted activities/feedback and available confirmed observations/completed assessments with source links. Missing data and unavailable prior-period comparisons are explicit; transcripts and raw media are not report inputs. Oversized periods/record sets fail instead of silently truncating.

Patient → invite verified clinician → clinician accepts → patient separately grants report scope → clinician reads. Every read verifies the enabled trusted clinician role, current active relationship, unexpired/unrevoked report grant and its entire report-period coverage. Revoking a care link revokes its grants so re-invitation cannot revive earlier permission. Sharing/relationship changes lock the relationship row; audit records contain metadata only. The bounded report generation does not yet refresh older reports automatically after new data/corrections.

Clinician provisioning is an explicit operator command, never an API/model tool: `uv run --directory backend python -m app.seed_clinician --fictional-demo` for local development, or `--auth-subject <UUID> --display-name <NAME>` for an operator-verified real Supabase identity. `demo-clinician-token` works only under the existing development auth gate and only after provisioning. Real Supabase login remains to be verified with an actual configured project.

Report/consent lists have opaque actor/filter-bound cursors. Cursors expire after an hour and become invalid after an API process restart. Transcript consent remains unavailable because history capture is not implemented; alert sharing does not imply a notification was sent.

### Evidence-grounded reports and PDF export

Reports now store an optional deterministic dual-perspective document in the existing JSON payload. No external LLM/provider or new migration is required. Read [report implementation and deployment dependencies](../docs/REPORTS_IMPLEMENTATION.md) for authenticated PDF endpoints, full comparison-period grants, correction/withdrawal behavior and WeasyPrint's native font dependencies. Old snapshots must be regenerated before PDF export. Fictional PDF specimens can be recreated with `uv run --directory backend python -m app.reports.examples --output ../docs/implementation-validation/reports/examples` from the repository root.
