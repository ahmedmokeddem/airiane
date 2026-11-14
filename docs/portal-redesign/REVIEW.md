# AIriane website and clinician workspace redesign

14 November 2026. Implemented locally for review. **Not deployed or pushed.** The original public deployment was inspected read-only; all patient screenshots and mutation tests use fictional fixtures or an isolated SQLite FastAPI database.

## Experience and design system

The public homepage now introduces AIriane rather than opening the clinician dashboard. A continuous teal thread frames the companion preview, followed by the interactive Ariadne story, voice/text explanation, existing guided activities, Journey illustration, sharing sequence and clinician report introduction. All product previews are labelled illustrations. No company address, testimonials, partners, usage counts, regulatory credentials or treatment-effect claims were invented.

The approved logo exports are unchanged. Existing Plus Jakarta Sans and Manrope files provide display/body typography. The palette follows Stitch/mobile: midnight `#001325`, teal `#166a61`, mint `#a3eee2`, ivory `#faf9f6`, mist `#e8efed`, and accessible slate/green secondary text. `portal/app/premium.css` supplies reusable tokens, buttons, navigation, surfaces, responsive layouts and focus/motion rules. Existing report styles remain compatible through the original stylesheet.

Small client components handle navigation, product preview, story selection, reveal, login visibility/loading and directory filtering. Layouts and data loading remain server-rendered. No animation dependency, new AI provider, database migration, mobile change or ElevenLabs configuration change was introduced.

## Routes

| Route | Experience and boundary |
| --- | --- |
| `/` | Public editorial homepage; old `?patient=…&report=…` bookmarks redirect into protected routes without rendering patient data. |
| `/how-it-works` | Public conversation, activities, Journey and sharing explanation. |
| `/for-clinicians` | Public clinician introduction with an illustrative report preview and explicit limitations. |
| `/privacy` | Current controls, provider-retention limitations, local-only camera and nonclinical boundaries. |
| `/login` | Branded responsive form; labelled fields, password visibility, loading/error states; development sign-in hidden in production. |
| `/dashboard` | Verified clinician overview, invitations, accessible patient counts, searchable directory and shared reports. Counts describe the returned directory page only. |
| `/patients` | Search/filter current authorized directory page; server-driven next-page cursor. |
| `/patients/[patientId]` | Reports and current access, shared alerts/questionnaires, existing connected-patient reminder form. |
| `/reports` | Shared reports for up to 12 report-authorized patients on the current directory page; directory link for others. No unsupported date or chronology is invented from receipts that lack dates. |
| `/reports/[patientId]/[reportId]` | Focused document with actual period/timezone/cutoff, sections, sources, limitations and Export PDF. Pending/stale/denied states remain explicit. |
| `/reports/[patientId]/[reportId]/pdf` | Existing authenticated, no-store PDF URL retained. |

Public and protected route-group layouts are separate. `lib/workspace.ts` is server-only. Each protected data page calls the request-scoped clinician loader, verifies `/v1/me` role and verification, and reads backend data with `cache: no-store`. Tokens are never passed to client components. Protected page metadata is generic. Production never falls back to fixtures. Patient lookup traverses at most 20 authorized directory pages; this bound avoids unlimited backend work.

Care actions keep origin checks, idempotency headers and backend authorization. Alerts/reminder handlers now open the encrypted production session cookie before forwarding the bearer token, matching the existing PDF/auth boundary. Successful sign-in routes to `/dashboard`; care actions return to the relevant patient page. A backend denial removes the report instead of substituting a cached or fictional record.

## Screenshot comparison

| View | Before | After |
| --- | --- | --- |
| Homepage | [Deployed signed-out root](screenshots/before-desktop.png) | [Desktop](screenshots/home-desktop.png), [tablet](screenshots/home-tablet.png), [mobile](screenshots/home-mobile.png) |
| Authentication | [Deployed login](screenshots/before-login.png) | [Desktop](screenshots/login-desktop.png), [tablet](screenshots/login-tablet.png), [mobile](screenshots/login-mobile.png) |
| Clinician workspace | Previous workspace inspected in source; no real patient baseline captured | [Desktop](screenshots/dashboard-desktop.png), [tablet](screenshots/dashboard-tablet.png), [mobile](screenshots/dashboard-mobile.png) |
| Patient detail | Existing controls preserved | [Desktop](screenshots/patient-desktop.png), [mobile](screenshots/patient-mobile.png) |
| Backend-generated document | Existing canonical stored report/PDF | [Desktop](screenshots/report-api-desktop.png), [tablet](screenshots/report-api-tablet.png), [mobile](screenshots/report-api-mobile.png) |
| Revocation | Existing backend denial preserved | [Record removed after grant revocation](screenshots/revoked-report.png) |

Screenshots were actually rendered and inspected. An initial waveform hydration warning was corrected with stable positive integer geometry. Reveals now keep content visible before observation rather than fading unread content. Small-screen toolbar fit and secondary-text contrast were refined from the rendered results. Screenshots contain fictional records only.

## Verified results

- Portal TypeScript, ESLint and **17 unit/transport tests** passed. Tests include production session sealing/expiry/tampering, origin enforcement, role denial, cursor encoding and existing report/assessment presentation.
- **30 route/viewport combinations** at 1440, 820 and 390 px: no horizontal overflow, broken in-page anchors or unexpected page/console errors. Product-mode controls, mobile menu, story navigation, password visibility, directory search and reduced motion checked. Additional 320 px overflow checks passed. [Responsive receipt](responsive-verification.json).
- Keyboard skip navigation targets the main region; login inputs have accessible labels. [Keyboard receipt](keyboard-verification.json). Visible-tab refresh ran once and retained the authorized report; polling coalesces RSC transitions and pauses in hidden tabs. [Refresh receipt](refresh-verification.json).
- Local axe-core checks cover WCAG 2 A/AA and 2.1 AA rule tags; contrast issues found during the pass were corrected. [Accessibility receipt](accessibility-verification.json). This is automated coverage, not a complete accessibility certification or a manual screen-reader audit.
- **Real isolated FastAPI + Chromium:** verified fictional clinician sign-in; HttpOnly/SameSite session; unauthorized dashboard redirect and PDF 401; actual reminder save; authorized PDF 200 and export-button download; consent revocation 204; subsequent PDF 403; old report removed; patient-role cookie denied. No mocked report fallback. [Authorization receipt](authorization-verification.json).
- Next.js production build and existing standalone portal Dockerfile build passed. The final image booted as UID 1000; ten public/anonymous route checks passed, with production development sign-in hidden. [Container receipt](container-verification.json). Next.js can emit the sign-in redirect in a streamed HTTP 200 response after a loading boundary; the browser follows it to `/login`, protected responses are private/no-store and contain no patient records. The PDF transport still returns HTTP 401 when signed out. No hosted deployment is claimed. Real Supabase account login and production HTTPS cookie behavior remain separate operator checks; the development identity is not evidence of those.

The browser checks are Chromium-only. No Safari/WebKit, manual assistive-technology matrix, large hospital directory load test, production performance benchmark or full clinical workflow validation is claimed. The existing PDF bytes and backend report generation were preserved, not redesigned by a second renderer.

## Run and deploy

Existing configured local backend mode:

```sh
npm --prefix portal run dev
```

For the explicitly fictional visual preview, choose an unused port and separate generated cache:

```sh
PORTAL_DATA_MODE=mock PORTAL_DEMO_AUTH=false PORTAL_BUILD_DIR=.next-redesign \
  npm --prefix portal run dev -- --port 3012
```

The mock override is development-only and is ignored for production access. `PORTAL_BUILD_DIR` is a local preview convenience; **leave it unset on Aiven** so the Dockerfile uses `.next/standalone`.

Review/verification:

```sh
npm --prefix portal run typecheck
npm --prefix portal run lint
npm --prefix portal test
npm --prefix portal run build
docker build -f portal/Dockerfile -t airiane-portal:reviewed .
```

After review and a separate publish/redeployment decision, deploy the approved commit to the **existing portal service only**, internal port 3000. Keep current production variables: `PORTAL_DATA_MODE=api`, `PORTAL_DEMO_AUTH=false`, existing session key, Supabase URL/public key, `RE_API_URL=https://openly-evolving-hog.eur-1.aiven.app`, and `PORTAL_PUBLIC_URL=https://commonly-patient-drum.eur-1.aiven.app`. Do not rotate the session key just for this redesign. No new secret, API service redeploy, migration or agent change is required.

After deployment, verify public `/`, `/how-it-works`, `/for-clinicians`, `/privacy`, login, anonymous dashboard denial, actual verified clinician access, authorized PDF and revocation. The existing Aiven startup validation, standalone output, non-root runtime and health routes are retained. No deployment was performed by this task.

## Changed files

See [exact source file list](CHANGED_FILES.md). Generated `.next-*` preview directories are excluded from Git, lint and Docker context. Earlier unrelated local implementation-status/TLS artifacts are preserved.
