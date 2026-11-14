# Aiven Runtime preparation and deployment runbook

**Prepared, not deployed.** No Aiven resources, paid plans, remote branch pushes or hosted database writes were performed. Read [readiness checklist](DEPLOYMENT_CHECKLIST.md), [environment matrix](ENVIRONMENT_VARIABLES.md), [initial audit](AUDIT.md) and the verification receipts before choosing to deploy.

## Build boundaries

Use the **repository root** as build context for both images: API imports shared contracts/migrations/logo/fonts; portal imports generated types. Dockerfile-specific ignore files exclude environment files, node_modules, build caches, PDF files, native outputs and verification artifacts. `backend/.dockerignore` and `portal/.dockerignore` also document exclusions, but root-context builds use `Dockerfile.dockerignore` alongside each Dockerfile.

```sh
docker build -f backend/Dockerfile -t airiane-api:reviewed .
docker build -f portal/Dockerfile -t airiane-portal:reviewed .
```

The API uses Python 3.12.12, uv 0.9.8 and frozen `backend/uv.lock`, excluding dev dependencies. Native Pango/HarfBuzz/fontconfig, CA certificates and Noto/DejaVu fonts support WeasyPrint; the approved logo and licensed Manrope font are copied at their existing paths. The portal uses Node 24.11.1, `npm ci`, Next standalone output and only traced runtime dependencies/static/public assets. Both run as non-root, bind all interfaces, receive SIGTERM directly and log to stdout/stderr. Review base-image security updates regularly; version pins are reproducible selections, not a vulnerability-free certification.

No private values are build arguments. Generate a portal encryption key locally with `openssl rand -base64 32` and enter it as a Console Secret; do not paste it into Git, chat or build logs.

## Console sequence (manual, after approval)

The following UI labels and workflow were checked in current [Aiven deployment documentation](https://aiven.io/docs/products/runtime/deploy-apps). Availability/region/plan/quota and tenant UI remain operator checks.

1. Have an organization administrator connect the intended GitHub account; ensure repository/branch permissions. Review the exact commit externally; nothing here pushes it.
2. In the project, choose **Runtime → Deploy application**, select **Account**, **Repository**, **Branch**, then **Next**. Select a manifest and **Scan**.
3. For independent deployment, select `backend/Dockerfile`, repository-root context (`build_path=.`; `containerfile_path=backend/Dockerfile`). For the portal separately, use `portal/Dockerfile`, same root context. The documented API source fields identify these paths; if Console cannot select root context separately, use the checked-in root `compose.aiven.yaml` and select the application(s) for review, or confirm the source fields with support. Do not pretend the Console has an unverified “Root directory” field.
4. `compose.aiven.yaml` describes only `airiane-api` and `airiane-portal`. **Do not select an existing development Compose or add any data-service integration.** Tiger Data remains external. Confirm Scan proposes **no PostgreSQL, Valkey, Kafka or other managed data service** before continuing. The manifest has no `image: postgres`, no `depends_on` data services and no embedded secret.
5. Review application name, available cloud/region and plan. Prefer a region near Tiger Data/Supabase and the patient population, subject to actual privacy/residency decisions. An available plan and cost must be confirmed by the operator.
6. Configure the API's complete runtime matrix using **Overview → Environment variables → Edit → Add variable**, marking credentials **Secret**, then **Save**. Some required URLs depend on assigned endpoints; finalize settings before treating the service as ready. Missing production configuration intentionally stops startup.
7. Expose internal port **8000**, protocol **HTTP**, name `http`. Aiven's public endpoint is HTTPS:443 and terminates TLS before forwarding HTTP to the container. The **Connection information** section contains the public domain. Do not configure the app to bind 443 or enable debug proxy-header trust.
8. Review configuration before clicking **Deploy**. If the initial wizard does not expose environment editing, initial startup will fail closed; configure variables from the created app Overview and manually redeploy. The documented Overview editor does not prove a pre-deploy wizard secret editor exists. Verify `https://API_DOMAIN/health/live` returns 200 and `/health/ready` returns 200. If required configuration is absent, startup should fail. If Tiger Data is unavailable/unmigrated, liveness remains healthy but readiness returns sanitized 503.
9. Create/configure the portal independently with internal port **3000** HTTP. Set `RE_API_URL` to the actual deployed HTTPS API endpoint, `PORTAL_PUBLIC_URL` to the actual external portal origin, the same Supabase project, public auth key and unique session encryption key. Keep real API mode and demo disabled. Then the operator can deploy it.
10. Finalize API `RE_CORS_ORIGINS` for the actual portal/web origins; native Android HTTP is not governed by browser CORS. All production URLs must use HTTPS. Configure any custom domain through Aiven's documented port/domain management. Use separate application identities/secrets per environment.
11. Supabase: configure actual project asymmetric signing keys, real patient accounts, and operator-reviewed verified clinician records. Review Site URL/allowed redirects for portal and the existing `re-patient` app scheme if email/social flows are enabled. Current app uses password sign-in; OAuth/magic-link callbacks and account recovery flows are not implemented by this preparation. Aiven optional Identity/OIDC edge login must not unexpectedly intercept mobile bearer/API requests; application-level Supabase authentication remains required.
12. Review actual saved ElevenLabs private-agent access, client-tool schema/wait settings and privacy retention configuration. Do not enable recording. `retention_days=0` schedules deletion; it does not prove zero retention. Leave native voice/LiveKit/Bluetooth and local-only camera boundaries unchanged.
13. Configure the mobile production environment and build the app outside Aiven (below). Smoke-test actual accounts: voice → exact recommendation cards → activity → feedback → Journey; patient confirmation → report → explicit grant → portal PDF → revoke → denial. This hosted/native production test remains a release gate.
14. Observe sanitized runtime logs. Docker health checks are included for local use; current reviewed Aiven docs do **not** establish configurable readiness probe semantics or Console probe field names. Verify platform monitoring behavior with Aiven; monitor the explicit health URLs without assuming Docker HEALTHCHECK is an orchestration readiness gate.

[Aiven ports](https://aiven.io/docs/products/runtime/ports), [variables](https://aiven.io/docs/products/runtime/secrets-and-variables), [Compose discovery](https://aiven.io/docs/products/runtime/manifest-files/compose-files) and [public-access defaults](https://aiven.io/docs/products/runtime/authentication/apps-authentication-overview) support the deployment choices. No Console screenshots were available or fabricated.

## Database safety and explicit operator commands

Use only the existing Tiger Data PostgreSQL service, a restricted application role, URL-encoded password and `sslmode=verify-full`. Public CA roots are installed; configure reviewed `RE_DATABASE_CA_PEM` if necessary. Confirm network/DNS/outbound access from the actual Aiven region; no cloud reachability claim is made here. Default pool maximum is three connections per process, connect timeout 10s, command timeout 15s and pool recycle 300s. Budget separate admin/migration connections.

The production process performs **no migration or catalogue write at startup**. Readiness checks schema and an available catalogue. On a new empty approved database, later run explicitly from the API image with a reviewed operator environment:

```sh
docker run --rm --env-file /SECURE/PATH/api-operator.env --entrypoint python airiane-api:reviewed -m app.migrate --migration 0001_baseline.sql
docker run --rm --env-file /SECURE/PATH/api-operator.env --entrypoint python airiane-api:reviewed -m app.migrate --migration 0002_confirmed_insights.sql
docker run --rm --env-file /SECURE/PATH/api-operator.env --entrypoint python airiane-api:reviewed -m app.seed_catalog
```

**Do not run that baseline against populated Tiger Data.** The existing service has already had baseline/0002 applied in earlier approved development work. This preparation does not query or change it. The new runner records checksums in a private-permission `public.airiane_schema_migrations` ledger and locks migrations. Repeated tracked migration execution is a no-op; changed checksums fail. `--check` only reads the ledger. An existing untracked schema is refused by default.

Before adopting an existing schema: take a verified backup, manually compare committed DDL/constraints/indexes and the existing schema, obtain approval for ledger metadata writes, then explicitly add `--adopt-existing` to each migration command in order. The tool checks required table presence; **that check alone does not certify DDL equivalence**. Adoption records history without rerunning baseline DDL. No adoption has been run against Tiger Data in this task. Clinician provisioning similarly remains a trusted operator action using `app.seed_clinician --auth-subject REAL_SUPABASE_UUID --display-name 'Reviewed clinician'`; do not use `--fictional-demo` in production.

## Independent redeployment and rollback

Aiven does **not** automatically redeploy on GitHub push in the documented workflow. For each application, **Runtime → application → Overview → Actions → Deploy latest commit** deploys the selected branch head. Environment/port edits can also redeploy the previously deployed commit. Review target commit and configuration before either action.

Keep an operator-maintained record of the last known-good backend commit, portal commit, runtime values and migration checksums. Current docs do not establish a one-click arbitrary-commit rollback. Restore a reviewed earlier application tree on a dedicated release branch (outside this task), select that branch using Aiven's branch controls, then manually redeploy. Never rewrite the remote default branch as an automatic rollback. Verify the earlier code is compatible with the still-current schema; rollbacks do not reverse SQL or restore withdrawn patient text. Rotating `PORTAL_SESSION_KEY` invalidates portal sessions. API restart loses process-local bootstrap replay and may leave an abandoned provider connection; normal End call is distinct from crash recovery.

Run one Uvicorn worker and one application replica until shared replay/pagination ownership and stale-connection recovery are implemented/tested. Aiven rollout overlap, forced-kill recovery and cross-instance reconnection are **not** certified by local tests. For a hackathon this is an explicit availability limitation, not an exactly-once or seamless rollout guarantee.

## Mobile production build (outside Aiven)

Keep approved AIriane icons/name, app IDs and native SDK versions. The current generated Android release variant uses the debug keystore; it is **not** a signed production release. No EAS project is currently linked/configured for this task. Do not run EAS init/build/submit or create signing credentials as part of preparation.

Create a private local environment from `mobile/.env.production.example`, fill actual **public** URLs/key, then source it in the build shell. Never put database/provider/session secrets in Expo variables. Release runtime fails closed on missing production configuration; app config rejects mock/local endpoints/private auth keys when production is selected.

```sh
cd mobile
# Export reviewed public production values in this shell first.
# For example: set -a; . /SECURE/PATH/mobile-production.env; set +a
npx --yes @expo/agent-cli@latest prebuild --platform android --no-clean
node scripts/prepare-unsigned-release.mjs
cd android
ANDROID_HOME="$HOME/Android/Sdk" ./gradlew :app:assembleRelease
```

This yields an **unsigned** release artifact for separate reviewed signing; it cannot be presented as store-ready or installed normally until appropriately signed. The preparation script removes only the debug signing line from the release block and refuses unexpected generated source. For actual distribution, use approved Android signing or a separately authorized EAS project/build profile and verify certificate identity, release microphone permissions and live voice on a device. No signed production artifact or store publication was created here.

## Local verification and resource estimates

```sh
docker build -f backend/Dockerfile -t airiane-api:deployment-check .
docker build -f portal/Dockerfile -t airiane-portal:deployment-check .
bash scripts/deployment/verify-containers.sh
```

The harness reads no repository `.env`, generates one-day **local fixture** TLS/JWT keys under `/tmp`, uses only a new isolated Docker PostgreSQL and HTTPS gateway, and cleans its containers/network. The gateway is a test fixture, not an Aiven service or real Supabase implementation. Native audio goes directly between the existing client SDK and ElevenLabs; Aiven hosts authenticated HTTP bootstrap/business APIs, not a new WebRTC relay. Tests exercise actual production code, certificate-verifying SQL, signed JWT/JWKS verification, HttpOnly encrypted Secure cookies, CSRF, CORS, patient ownership, clinician grants/revocation and the actual portal PDF proxy. They cannot verify a real Supabase project, hosted Tiger Data reachability or ElevenLabs audio. Synthetic PDFs are generated at runtime with networking disabled, never baked into images. Successful runs remove their short-lived private keys; failed-run `/tmp` fixtures should be removed after inspection. Never trust the fixture CA in production.

Start with estimates of **1 vCPU / 1 GiB RAM for API**, **1 vCPU / 512 MiB–1 GiB RAM for portal**, one PDF render slot and one replica. Validate against actual plan CPU throttling, concurrent PDFs, report sizes and traffic before launch. See [local verification](verification/) for observed image sizes, memory, shutdown and PDF results; these are smoke measurements, not throughput/SLA guarantees. No extra queue/cache/database infrastructure was added.
