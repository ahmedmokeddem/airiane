# RE clinician portal foundation

Next.js App Router with reusable report rendering and the existing Stitch Restorative Horizon palette. The dashboard is server-rendered; no third-party scripts, analytics, patient report exports or browser persistence are included. This preserves `docs/design/*` as references, without copying unsupported clinical claims.

## Development

```sh
cd portal
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `PORTAL_DATA_MODE=mock` is the explicit default. The visible demonstration banner identifies fictional reports and simulated authorization. `fixtures/clinician.json` derives its report from the shared `contracts/fixtures/report.json`; canonical types are generated in `contracts/generated/api.ts`. No API or provider is contacted in mock mode.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Node >=20.9 is required by the selected Next.js baseline; the package lock pins resolved dependencies. See [official Next.js installation guidance](https://nextjs.org/docs/app/getting-started/installation).

## Live backend integration

Set `PORTAL_DATA_MODE=api` and `RE_API_URL=http://127.0.0.1:8000` in `.env.local`. Open `/login`. Password sign-in uses server-only `RE_SUPABASE_URL` and `RE_SUPABASE_ANON_KEY`, then FastAPI `/v1/me` must return a verified clinician. The HttpOnly, SameSite=Lax cookie expires after at most one hour (Secure in production). Sign-out clears it; refresh-token rotation and global Supabase logout are not implemented. Every report read still rechecks the current backend role, care link, consent expiry/revocation and report period.

For the fictional local integration only, enable `PORTAL_DEMO_AUTH=true` and backend `RE_DEMO_AUTH=true` in development. Provision its trusted application identity explicitly:

```sh
uv run --directory backend python -m app.seed_clinician --fictional-demo
```

The command returns a doctor connection code. The portal's development sign-in button is blocked in production. Its banner identifies the development identity; report data is read from PostgreSQL, not fixtures. For a real clinician, the operator uses `--auth-subject <SUPABASE_USER_UUID>` instead; no public endpoint can grant clinician role or verification.

In the mobile Reports screen, the patient sends a connection invitation using that code. The clinician accepts in the portal. The patient then explicitly grants report sharing for the displayed history window and access duration. Generate a report in mobile, refresh the portal, and verify the persisted report. Stopping sharing or revoking the link denies subsequent reads. No clinician report access exists merely because an invitation was accepted.

Implemented canonical reads: doctor patients, report list and individual report; care-link participant list/acceptance. API calls use no-store, reject redirects, and do not fall back to fixtures after an authorization or backend error. Mock mode remains available explicitly for isolated UI work.

## Verification and limits

Typecheck, lint, six portal tests and production build pass. Browser sign-in and actual stored report rendering have been exercised against FastAPI/Tiger Data with fictional development identities. Backend tests separately verify completed activity/feedback reports, source references, period restrictions, expiry, revocation and cross-patient denial on PostgreSQL. Real Supabase account sign-in and production cookie/proxy deployment remain unverified. Alerts, PDF/export and clinical claims are outside this slice.

## AIriane report presentation

The clinician UI uses the official horizontal AIriane mark (`public/brand/airiane-wordmark.png`), rendered from the unchanged source SVG with Inter by the shared brand export workflow. Report sections distinguish direct patient records, patient-approved interpretations and deterministic summaries. Charts show actual confirmed numeric samples only and appear with at least two samples; they do not interpolate missing days or establish clinical improvement. Source details and record cut-off are inspectable. Empty themes, goals and assessments remain explicit.

Authorization remains server-enforced through `ClinicianApi`: bearer credentials stay on the server, reads disable caching and redirects, and permission failures never fall back to fixture data. `PORTAL_DATA_MODE=mock` is explicitly labelled fictional. Existing care-link acceptance and report grant/revocation requirements are unchanged.

Hosted development database latency can exceed ten seconds. Backend identity and report reads have a bounded 30-second timeout; independent identity, care-link and patient-list reads run concurrently. This does not bypass clinician verification or patient consent. The Supabase credential exchange retains its existing ten-second timeout.
