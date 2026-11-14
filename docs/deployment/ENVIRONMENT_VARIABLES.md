# Production environment matrix

Configure backend/portal runtime values in Aiven **Overview → Environment variables → Edit → Add variable**, mark private values **Secret**, then **Save**. Do not put credentials in Compose, Docker ARGs, Git or `NEXT_PUBLIC_*`. Values below are names/placeholders only. [Aiven variable documentation](https://aiven.io/docs/products/runtime/secrets-and-variables) (checked 14 November 2026).

All Python settings use the existing `RE_` prefix. `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, and a backend public-app URL are **not** consumed. This JWT implementation requires Supabase ES256/RS256 signing keys exposed through its project JWKS; legacy HS256 projects need signing-key migration, not an invented JWT-secret fallback.

| Variable | Service / purpose | Required / default | Secret? | Production vs development / location |
|---|---|---|---|---|
| RE_ENVIRONMENT | API mode | production | No | Console variable; default development only outside image |
| RE_DATABASE_URL | Existing Tiger Data DSN | Required; `postgresql://USER:ENCODED_PASSWORD@HOST:PORT/tsdb?sslmode=verify-full` | **Yes** | Console Secret; no SQLite or encryption-only `require` in production |
| RE_DATABASE_CA_PEM | Optional private-CA trust chain | Empty = system CA roots | Public certificate | Console multiline variable or Secret; never disable hostname verification |
| RE_DATABASE_POOL_SIZE | Connections per single API process | 2, range 1–10 | No | Console; reserve DB capacity for migrations/admin |
| RE_DATABASE_MAX_OVERFLOW | Extra connections | 1, range 0–5 | No | Console; default process maximum 3 |
| RE_DATABASE_POOL_TIMEOUT | Pool wait seconds | 5 | No | Console |
| RE_DATABASE_CONNECT_TIMEOUT | PostgreSQL connect seconds | 10 | No | Console |
| RE_DATABASE_COMMAND_TIMEOUT | Query seconds | 15 | No | Console; explicit migration runner uses 60s |
| RE_READINESS_TIMEOUT | Total readiness seconds | 3 | No | Console; no service detail in response |
| RE_PDF_MAX_CONCURRENT | Render slots per process | 1 (maximum 2) | No | Console; keep 1 on small plans |
| RE_DEMO_AUTH | Fictional authentication | **false** | No | True rejected outside development |
| RE_SUPABASE_URL | Supabase Auth project | Required HTTPS origin | No | API and portal Console variables; use identical project |
| RE_JWT_AUDIENCE | JWT audience | authenticated | No | API Console; issuer derived as project `/auth/v1` |
| RE_CORS_ORIGINS | Approved browser origins | Required HTTPS comma-separated origins | No | API Console; portal URL, plus actual web app if used; no wildcard/local URL |
| RE_ELEVENLABS_API_KEY | Provider bootstrap credential | Required | **Yes** | API Console Secret only; never Expo/portal |
| RE_ELEVENLABS_AGENT_ID | Deployed private agent | Required | No | API Console |
| RE_PROVIDER_PRIVACY_VERIFIED | Reviewed saved provider configuration attestation | Required true after real review | No | False fails production startup; local flag alone is not proof |
| RE_PROVIDER_PRIVACY_POLICY_VERSION | Reviewed policy evidence/version | Required | No | API Console; existing saved settings do not prove zero retention |
| PORT | Internal HTTP listener | API 8000 / portal 3000 | No | Console variable must match exposed service port |
| LOG_LEVEL | Uvicorn server log level | info | No | API Console: critical/error/warning/info; no debug/access log payloads |
| NODE_ENV | Portal mode | production, image default | No | Console; do not override to development |
| PORTAL_DATA_MODE | Portal real API reads | api | No | Console; production entry rejects fixtures and page forces API |
| PORTAL_DEMO_AUTH | Fictional portal login | false | No | Console; true rejected in production |
| RE_API_URL | Portal → API server URL | Required deployed API HTTPS origin | No | Portal Console; never `localhost` or Compose service DNS in Aiven |
| PORTAL_PUBLIC_URL | Browser portal origin / CSRF | Required HTTPS origin | No | Portal Console; exact external origin including nondefault port if any |
| RE_SUPABASE_ANON_KEY | Supabase publishable/legacy anon key | Required | Public key | Portal Console, server-only usage; **never** service-role/secret key |
| PORTAL_SESSION_KEY | AES-256-GCM cookie encryption | Required, 32 random bytes base64 | **Yes** | Portal Console Secret; unique per environment; rotate to invalidate portal cookies |
| HOSTNAME | Next.js bind address | 0.0.0.0 | No | Image default; do not set to public DNS name |
| NEXT_TELEMETRY_DISABLED | Next telemetry | 1 | No | Build/runtime image default |
| EXPO_PUBLIC_APP_ENV | Mobile release guard | production | Public | Expo build environment/local shell, **not Aiven** |
| EXPO_PUBLIC_API_MODE | Mobile backend mode | live | Public | Mock rejected by release guard |
| EXPO_PUBLIC_API_URL | Android API URL | Required public HTTPS API origin | Public | Build-time; requires rebuilt app for changes |
| EXPO_PUBLIC_DEMO_AUTH | Mobile fictional sign-in | false | Public | Never true in production |
| EXPO_PUBLIC_SUPABASE_URL | Mobile Supabase Auth | Required HTTPS origin | Public | Build-time, same project as API/portal |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Mobile public Auth key | Required publishable or legacy anon | Public | Validator rejects secret/service-role keys; all Expo public values enter bundle |
| EXPO_PUBLIC_VOICE_PROVIDER | Existing native adapter | elevenlabs | Public | No SDK or routing version changes |

Runtime-generated Fernet bootstrap replay keys and pagination signatures remain process-local, not deploy-time variables. Use one worker and one instance; restart/replay/abandoned connection recovery needs further work before multi-replica operation. There is no Redis session dependency. Portal stores an encrypted bearer cookie, HttpOnly, Secure and SameSite=Lax, for at most one hour; refresh rotation/global sign-out remain unimplemented. Backend JWT and current clinician/link/grant authorization are checked on requests.

Other tool-only variables: `TEST_DATABASE_URL` selects an isolated test DB and is never a production API setting. `ANDROID_HOME` selects the local Android SDK. `CI`, `NODE_ENV`, and Expo tooling's build flags are tool controls, not private API keys. `SSL_CERT_FILE` / `NODE_EXTRA_CA_CERTS` are used **only by local TLS fixtures** in verification; deploy ordinary system trust or a reviewed CA chain, not the fixture CA.

Safe templates: [API](../../backend/.env.production.example), [portal](../../portal/.env.production.example), [mobile](../../mobile/.env.production.example). These placeholders deliberately do not constitute a working production configuration. Existing `.env` files are unchanged and excluded from image contexts.
