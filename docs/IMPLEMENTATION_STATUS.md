# AIriane implementation status

Updated 14 November 2026. Work continued from the existing slice; the baseline migration, existing API operations, technical package identifiers and Stitch assets are preserved. Additive confirmed-insight schemas are documented below. This is a tested development integration, not a production or clinical validation.


## Evidence-grounded reports and PDF export — 14 November 2026

Implemented the current-stack-only brief: **no new LLM provider**. Reports now store a deterministic-v3.1 evidence snapshot, patient/clinician narratives, traceable findings, explicit goals/questions, conditional charts and qualified equal-period reporting comparisons. Existing patient-confirmed note review/correction/rejection/withdrawal is reused. Missing conversation data remains explicitly missing; no symptom change, diagnosis or treatment effect is inferred. Existing wire/tool version 2.0.0 and baseline migrations are preserved; the optional document and PDF operations are additive. No hosted migration was needed.

| Classification | Actual result |
| --- | --- |
| **VERIFIED ON DEVICE** | Samsung SM-G998B / Android 15; Expo development APK rebuilt and installed, **BUILD SUCCESSFUL in 32s**. Fictional sign-in, actual backend report creation, new-ID version-2 regeneration, authenticated PDF download, native share chooser (cancelled without recipient), A4 six-page print preview and Samsung local file save passed. The saved PDF was read back: six selectable-text pages and the correct report ID. |
| **VERIFIED LIVE POSTGRESQL + BROWSER** | Report `b328f6a2-2076-401d-8bd3-039a7a327480`, version 2, deterministic-v3.1, contains 11 evidence records: one confirmed note, five completions and five feedback records. Direct PostgreSQL metadata read and real authorized portal presentation/download passed. Proxy returned HTTP 200 PDF with private/no-store; no session returned HTTP 401. Existing live grants were preserved. |
| **VERIFIED AUTOMATED** | 28 backend tests on disposable SQLite and PostgreSQL 16; mobile 32 tests, lint/typecheck; portal 10 tests, lint/typecheck and production build; eight shared contract fixtures. Security tests include ownership, prior-period bounds, revocation/withdrawal during rendering, prior-only withdrawal, invented claims, Unicode and local-midnight dates. |
| **VERIFIED PDF REVIEW** | Four fictional A4 specimens (empty, activities only, confirmed experiences, longitudinal clinician edition) generated and visually inspected. Selectable text, Latin/Finnish/Greek extraction and structure trees checked. Official logo and existing licensed font used. This is not PDF/UA certification. |
| **NOT TESTED / LIMITS** | iOS share/save; production account auth; all writing systems/assistive technologies; low-memory and multi-worker stress. No new real voice/Bluetooth/camera verification is claimed in this report pass. Earlier evidence and existing force-kill recovery gap remain below. No sharing recipient was selected. |

PDFs render in memory with exact embedded assets, escaped patient text and no public storage/URL. Authorization, source revisions and snapshot hashes are rechecked after rendering. Comparison consent covers the complete earlier evidence window. Withdrawing/correcting a note removes affected documents and denies stale exports. Old/unsupported report documents remain readable but require regeneration for export. Mobile download, Save / print and Share are separate explicit actions; private cache expires while running and is swept on the next export, while saved/shared copies cannot be remotely revoked. OS termination can defer cache cleanup.

Read [implementation, exact launch commands, changed files and limits](REPORTS_IMPLEMENTATION.md), [verification receipt](implementation-validation/reports/verification.json) and [PostgreSQL receipt](implementation-validation/reports/postgresql.json). Example PDFs: [activities](implementation-validation/reports/examples/activities.pdf), [confirmed experiences](implementation-validation/reports/examples/confirmed.pdf), [longitudinal clinician report](implementation-validation/reports/examples/longitudinal.pdf). WeasyPrint's native Pango/HarfBuzz/font dependencies must be present in deployment; the current Linux host is verified.

## Ariadne opening — 14 November 2026

Implemented a skippable, approximately 2.5-second cold-launch opening using the approved SVG's exact two strokes and original horizontal wordmark. Native splash retention is tied to local readiness, with bounded fallback; authentication, APIs and the mounted app do not await animation completion. Reduced motion skips the drawing, and backgrounding cancels playback. Standard navigation and providers retain their existing ownership.

**VERIFIED ON DEVICE:** Samsung SM-G998B / Android 15, optimized ARM64 release APK (`debuggable=false`), **BUILD SUCCESSFUL in 5m33s**. Actual system mask, thread reveal, lighting and handoff inspected; physical skip, reduced-motion signal and same-process foreground/no-replay passed. Android's mask cropped the initial horizontal system image, so that layer now uses the approved symbol; the wordmark appears in the RN animation. The native light asset replaces platform-dependent SVG/shadow rendering. Original logos, API contracts and backend files are unchanged.

**VERIFIED IN WEB PREVIEW:** drawing, wordmark, fade, skip, reduced motion, interaction passthrough and delayed-font fallback. Port-8082 browser sign-in is blocked by the existing CORS allowlist, separately from animation; no successful web-auth claim. **Automated:** 29 mobile tests, lint and typecheck pass. Low-end frame timing/iOS are not verified; sampled screenshots are not an every-frame or FPS certification.

The development APK was then rebuilt (**3m53s**) and restored on the phone. Real fictional sign-in/Home and Activities → Home passed with no intro replay; the 2-second runtime error window was empty. Metro 8082/FastAPI remain available, and temporary phone settings were restored. No new voice conversation was claimed in this opening-only pass.

Read [Opening implementation, exact commands and native/web differences](OPENING_EXPERIENCE.md) and [native evidence](implementation-validation/opening/native-verification.json). The opening reveals Welcome while signed out; it never bypasses authentication to invent a Home session.

## AIriane product upgrade — 14 November 2026

The existing app now uses the two official AIriane assets, native launcher/adaptive icon inputs and horizontal welcome/splash/portal artwork. Original SVGs are unchanged; Inter 600 is loaded for wordmark rasterization. Technical IDs and the existing audio SDK versions are retained. Home, Companion, Activities, Journey, reports and profile use the Stitch ivory/navy/teal language, shared typography and persistent four-destination navigation. Companion opens text; immersive calls keep their own toolbar. See [gap analysis](AIRIANE_PRODUCT_GAP_ANALYSIS.md) and [screen review with comparisons](AIRIANE_PRODUCT_REVIEW.md).

| Classification | Actual result in this upgrade |
| --- | --- |
| **VERIFIED ON DEVICE** | Samsung SM-G998B / Android 15: AIriane development APK built and installed; `BUILD SUCCESSFUL in 3m 31s`. Native Home, Activities, chat, animated Journey and real saved-record details rendered. Journey's missing scroll wrapper was found during screenshot review and fixed; tab text fits narrow destinations. |
| **VERIFIED ON DEVICE + POSTGRESQL** | Real ElevenLabs **text** conversation invoked the new transient `propose_conversation_insight` client tool. Before UI confirmation, database query returned zero insights. The fictional draft was edited, then Confirm & save created confirmed insight `21b2daf3-d252-426b-8ef7-3baa13ae2b1f`; the exact patient-edited summary appeared as the fourth Journey milestone. A second real agent draft was rejected; the database still contained only that one confirmed row. |
| **VERIFIED ON DEVICE (patient confirmation)** | New AIriane build established a native voice call after the text session. Patient confirmed: “Yes, I hear AIriane and see the card” after saying Help me relax through the headset. This is an actual provider conversation/recommendation, not the mock tool button. Earlier native Bluetooth input/output and hotplug evidence remains below. |
| **VERIFIED LIVE BACKEND + BROWSER** | Explicitly approved additive migration `0002_confirmed_insights.sql` applied to configured Tiger Data development database. Newly generated facts-v2 report `a16fe94d-24e0-4b83-b64b-1d0a3542fae9` included the approved insight, its confirmation/source, three completed activities and three feedback rows. Authenticated authorized portal rendered it; temporary grant revoked HTTP 204, same report denied HTTP 403, browser refresh removed it. [Receipt](../portal/verification/confirmed-insight-report-check.json). |
| **VERIFIED AUTOMATED** | Backend 20 tests pass on disposable SQLite; backend workstream also ran all 20 on disposable PostgreSQL 16. Ruff check/format pass. Mobile typecheck/lint and 27 tests pass. Portal typecheck/lint, 10 tests and production build pass. Seven shared fixtures validate against canonical OpenAPI 2.0.0. |
| **MOCKED / FIXTURES** | Explicit mock API/simulated-agent modes and fixed report-preview fixtures remain development options. They were not used for the real Android text proposal/confirmation, voice confirmation or live report authorization above. |
| **NOT TESTED / PARTIAL** | Release splash rendering, launcher masking on a device matrix, iOS, release animation frame times, large-font/keyboard matrix, wired headset and competing-call interruption matrix. Original Rive asset remains absent; the companion is the documented animated native fallback. Supabase production account auth remains unconfigured here. |

The current voice recommendation `8cb61bfe-08bd-4832-ab1d-25d57e98e0e1` was accepted on a real WebRTC voice connection; its activity `ad60e966-8493-4684-bcb9-07e5aafd3020` completed with rating 4 in PostgreSQL. An additional standalone minute `02d987cf-d071-43dd-b55d-d82aa8f2132f` was completed and saved after a later reload. Both appeared as native Journey stars. The observed voice provider connection is closed; cleanup inspection found no live RE audio-focus entry and no active camera clients. [Sanitized upgrade receipt](implementation-validation/airiane/verification.json). CLI actions call handlers; physical gesture geometry and an uninterrupted lifetime after the phone left the app are not inferred.

The text provider now uses the installed public `@elevenlabs/client` TextConversation API, declared at its already installed exact 1.36.1 version. Native voice stays on ElevenLabs React Native 1.2.40 with the reproducible routing patch. Text never invokes native microphone mute/AudioSession methods. No audio SDK version was upgraded.

Insight proposals live only in mobile memory and return `persisted:false` to the agent. Only authenticated patient UI confirmation calls the new backend endpoint. Numeric `propose_observation` retains its existing separate planned contract; neutral narrative summaries have an additive UI-only contract in `contracts/client_ui_tools.json`, not a model backend write. Current rows retain reported/confirmed time, statement origin, source and correction lineage. Corrections preserve prior approved versions; deletion scrubs the lineage and affected stored report text. Backups/provider retention require their separate operator policies. Correction reason is validated but not stored as free text; this limitation is explicit.

Reports aggregate current confirmed data deterministically and disclose missing assessments/observations; no diagnosis, treatment effect, recovery score or unsupported prior-period change is introduced. Only current complete records become Journey milestones; feedback is attached to its actual activity rather than assigned an invented timestamp. Charts require sufficient actual numeric points.

New/changed product files: `mobile/App.tsx`, `mobile/app.json`, `mobile/package*.json`, `mobile/src/theme.ts`; `mobile/src/features/product/*`, `journey/*`, `insights/*`, `reports/patient-report*.tsx`, `reports/patient-report-model.ts`, `reports/reports-sharing.tsx`; routes `activities.tsx`/`profile.tsx`; integration `api.ts`, `eleven-provider.tsx`, `voice-agent-adapter.ts`; patient-visible call branding; seven new test modules and `tests/run.ts`. Shared artwork/fonts are under `assets/brand/`, `mobile/assets/brand/`, `mobile/assets/fonts/` and `portal/public/`. Backend changes: `app/insights.py`, `storage.py`, `services.py`, `replay.py`, `reporting.py`, `care_routes.py`, `main.py`, `migrate.py`, `configure_airiane_agent.py`, `tests/test_insights.py`; additive migration 0002 and migration README. Contract additions: `openapi.yaml`, `generated/api.ts`, UI tool contract/reference, confirmed-insight fixture. Portal changes: report view/presentation, layout/global styles/login/page, API/auth timeout, tests/README and verification artifacts. Existing native-call files changed earlier in this working tree are documented separately below.

Exact launch commands below still apply; do not rerun the baseline against the populated service. For another configured development database, apply the additive migration once with `uv run --directory backend python -m app.migrate --migration 0002_confirmed_insights.sql`. This service is already migrated. To inspect deployed AIriane agent configuration use `uv run --directory backend python -m app.configure_airiane_agent`; `--apply` was used in this upgrade and saved privacy settings were verified unchanged.

## Earlier native call refactor — retained evidence

The call now has a dedicated navy full-screen composition based on the actual Stitch HTML, a persistent native animated orb, fixed floating controls, a local camera PiP, an Audio menu and an in-call breathing/feedback panel. The original `.riv` asset is absent: this is a native animated fallback, not the original Rive character. Provider labels, configuration navigation and generic “Working…” text are absent from the call. Existing business APIs, tool contracts, migrations and provider privacy settings are preserved.

| Classification | Actual result |
| --- | --- |
| **VERIFIED ON DEVICE** | Samsung SM-G998B / Android 15; development APK rebuilt and installed, **BUILD SUCCESSFUL in 2m46s**. Real RE voice and real recommendation card; patient confirmed headset audio. Android active RE UID audio-policy entries prove **Bluetooth SCO output and Bluetooth headset microphone input**. |
| **VERIFIED ON DEVICE** | Audio menu exposes Automatic, Bluetooth, earpiece and speaker on this phone. Manual speaker selection changed active output to speaker and input to the phone microphone. Automatic routing restored Bluetooth. Device samples are in the sanitized evidence receipt. Independent microphone selection is not claimed. |
| **VERIFIED ON DEVICE** | Voice worked with **camera permission denied**. Camera prompt appeared only after the camera control was tapped. After the permission-dialog lifecycle correction, the first tap/allow displayed a PiP, RE remained mounted, microphone stayed unmuted, and the same backend connection ID/epoch remained active. Physical camera-off removed PiP and Android reported `Active Camera Clients: []`. No screenshot was taken with preview active. |
| **VERIFIED ON DEVICE** | Real recommendation → breathing → completion + rating 4 persisted to PostgreSQL in this pass (`ed4bf049-7acc-43bc-9597-e4481e8db5b2`); My Journey/report displayed the resulting saved records. The in-call activity layout was adjusted after inspection to prevent overlap. An unfinished activity was resumed within the call and saved as `7f0fabc0-f82e-4827-99ce-3b169399ba80` with rating 4; the same connection remained active and the UI returned to its saved-call state. End/cleanup inspection found no active RE audio tracks, no RE audio-focus entry, and an empty camera client list. |
| **VERIFIED IN WEB PREVIEW** | Original `code.html` voice state rendered for visual comparison. This is reference inspection, not proof of native audio or camera isolation. |
| **MOCKED** | Existing explicitly selected mock API/simulated-agent development modes remain available. They were not used for the native voice/DB evidence above. Unit tests also use fixtures/fake SDK events. |
| **NOT TESTED / PARTIAL** | Release-build frame timing; lowest-end hardware; iOS; wired headset; telephony/competing-audio focus; full reduced-motion/large-font device matrix; exhaustive media/HTTP egress audit. Code boundaries exclude camera capture/transmission, but UI/native client inspection alone is not a complete network privacy audit. |
| **VERIFIED ON DEVICE (patient confirmation)** | User initially reported quiet earpiece fallback; native policy confirmed it. Automatic preference was corrected to **Bluetooth → wired → speaker → earpiece**. User then confirmed “Yes—speaker, then headset” on disconnect/reconnect. Final OS polling sampled restored Bluetooth input/output; the brief speaker interval was not captured by that polling pass. |
| **BLOCKED / RECOVERY GAP** | Force-killing the app during permission testing left a backend provider connection active while the native process was gone. Resuming an unfinished activity then hit existing `CONNECTION_ACTIVE`. The one known test connection was closed through the authenticated existing API with its exact version. Automatic crash/force-kill recovery remains unimplemented; no backend takeover semantics or new contract was invented. Normal End call is distinct from force-kill. |

Checks in this pass: contract validation **6 fixtures**, backend tests **17 passed** (temporary SQLite test databases), mobile tests **9 passed**, mobile lint and typecheck passed. Live PostgreSQL persistence is independently verified by the device receipts.

Read [Native call review](NATIVE_CALL_REVIEW.md) for before/after differences, component boundaries, patch mechanism, exact changed files and screenshot comparison. [Sanitized device evidence](implementation-validation/native-call/verification.json) contains metadata, not media or transcripts.

The installed ElevenLabs **1.2.40** speaker-only override is patched by `mobile/scripts/patch-elevenlabs.mjs` on **npm postinstall**. The dependency is pinned; unexpected versions/source patterns fail rather than silently skipping. No native dependency versions were upgraded. LiveKit remains responsible for communication audio focus/session release. Its installed public JS API lacks selected-route/focus-change events; availability is polled while the native AudioSwitch monitors devices. App backgrounding pauses microphone and stops camera. The app does not claim control of an independent headset input selector.

## Verified on a physical Android device

- Expo SDK 58 development APK built successfully in 2m56s and installed on Samsung SM-G998B / Android 15. This was a native LiveKit development build, not Expo Go.
- A real ElevenLabs voice connection exchanged audio. The user confirmed hearing RE reply and introduce Calm Breathing. Content-free SDK statistics showed connected ICE/DTLS, inbound/outbound audio bytes, and only audio track kinds in the observed samples.
- The phone displayed the backend-generated Calm Breathing card. PostgreSQL recorded `present_activity_recommendations` on the real voice connection at 06:23:57 UTC. The simulated recommendation button was not used for that evidence.
- A repeated voice/touch selection produced `INVALID_TRANSITION` during the first full-flow attempt. The backend now returns the same running activity for the same selection; repeated recommendations retain its recommendation. The app preserves the timer for that activity and offers Resume. A second failure was isolated after successful persistence: updating an ended voice connection threw “No active conversation.” Context updates are now guarded and optional; provider notification cannot reverse a successful save. Sign-in restores an existing running activity from My Journey after a cold reload; elapsed participation is conservatively restarted rather than invented.
- A clean native-runtime observation window had zero JavaScript errors before the selection-race reproduction. This is limited evidence, not blanket device certification. The Android recovery/save path subsequently passed: the linked voice recommendation produced a completed activity and rating 4/5 in Tiger Data, and native My Journey displayed the same result. A clean uninterrupted repeat after both fixes is still recommended.

[Android evidence](implementation-validation/android-voice.json) records sanitized metadata only. No voice recording, camera image/video, or transcript was collected as test evidence. Two cold-start RE UI screenshots were inspected only with camera inactive and kept outside the repository.

## Current implementation

| Area | Implemented and checked | Remaining mocks / limits |
| --- | --- | --- |
| Mobile / agent | Real native ElevenLabs voice and recommendation tool verified on one Android device; provider adapter; separate text-only connection; committed card acknowledgement before tool response; local preview; breathing/feedback/Journey; running-activity recovery; patient reports and explicit doctor sharing. | Real native text conversation and a transient insight tool call are verified in the AIriane upgrade above. The original Rive asset is absent; the native Stitch-style orb is a documented fallback. Session transcripts remain in memory; history persistence is not implemented. |
| FastAPI / PostgreSQL | Existing slice plus report generation/read/list, trusted clinician identity, participant care links, report grants/revocation, doctor report list/read, audit metadata and actor/filter-bound cursors. Stored reports aggregate accepted activities/feedback, available confirmed observations and complete assessments with source references. | Narrative confirmed-insight input/correction/deletion is implemented. Numeric observation/assessment input remains deferred. Reports are bounded synchronous projections in the same application transaction; automatic refresh/background processing and prior-period deltas are not implemented. |
| Doctor Portal | Real-backend mode, server-side clinician password sign-in, role verification through `/v1/me`, HttpOnly session cookie, explicit development identity, invitation acceptance, stored authorized report rendering and no fixture fallback after denial. | Actual Supabase project/account sign-in is not tested because no Supabase project is configured locally. Development verification uses explicitly fictional identities; production sign-in requires configured Supabase and operator-provisioned verified clinician records. Refresh-token rotation/global logout is deferred; portal sessions expire within one hour. |
| Camera | Existing preview remains independent of voice, with the exact preview-only disclosure. No capture, recording, frame callback, image/URI or camera input is passed into adapter/API/persistence. Preview on/off was observed on the phone. | A complete concurrent-preview track/HTTP egress audit, permission denial/revocation, background and interruption matrix remains pending. Audio-only statistics from sampled voice intervals do not alone prove every camera lifecycle case. |

## Provider privacy: actual configuration checked

The agent initially had recording enabled, unlimited retention and public access despite the local attestation flag. With explicit user approval, its saved settings were changed and read back: authenticated access required, `record_voice=false`, `retention_days=0`, audio/transcript deletion flags enabled, and application to existing conversation history disabled. [Saved-setting evidence](implementation-validation/elevenlabs-saved-settings.json).

Zero-day retention schedules deletion; it is not a zero-retention guarantee. ZRM is off, and actual provider-side deletion timing/residual retention has not been demonstrated. Existing provider conversation history was not deleted. Never treat the local flag alone as proof of saved provider configuration.

## Backend and portal authorization verification

The PostgreSQL suite passes with factual activity/feedback report content, source links, cross-patient denial, inactive/unverified role checks, entire-period grant restrictions, expiry and revocation, replay, bound cursors, and the voice/touch selection regression. Relationships are row-locked during grant/revocation; revoking a care link also revokes its grants so re-invitation cannot revive old permission.

A browser signed in as the provisioned fictional development clinician through FastAPI. The portal rendered a report read from the configured Tiger Data service after a separate patient report grant. The initial report correctly showed missing data. After Android completion, a regenerated stored report displayed one completed activity, rating 4/5 and two source references in the browser. Revoking its report grant returned HTTP 403 for the same report, and portal refresh removed accessible reports without fixture fallback. Report sharing in this smoke test used canonical HTTP APIs with fictional identities; the mobile invitation/share controls were implemented and report generation was exercised on-device, but their full manual invitation/acceptance sequence was not separately repeated end to end.

## Automated checks

- Backend: 17 tests passed against a separately migrated disposable PostgreSQL 16 instance; Ruff lint/format pass. Two upstream deprecation warnings remain (Starlette TestClient/httpx and JSON Schema RefResolver).
- Earlier foundation mobile checks: TypeScript, ESLint and five named unit tests passed; the current upgrade suite has 27 passing tests. Covers committed cards, exact selection IDs, strict mock shapes, and no audio controls in text mode, and no context update to a disconnected provider. Web export passed in the preceding foundation; this pass additionally built and installed Android.
- Portal: TypeScript, ESLint, ten tests and production build pass. Tests cover protected transport, denial/pending states, clinician-role verification and same-origin login/session mutation.
- Six shared fixture payloads validate against canonical OpenAPI 2.0.0. In that earlier pass the OpenAPI/tool contracts and SQL baseline were unchanged. This upgrade adds optional report fields, confirmed-insight operations and migration 0002; baseline 0001 still matches schema.sql byte-for-byte. Hosted CI execution is not claimed.

## Exact launch commands

See [DEVICE_VERIFICATION.md](DEVICE_VERIFICATION.md) for USB setup, Android SDK path, Metro port selection, native test cases and portal integration. Current workstation commands, from repository root (the existing backend may already own port 8000; do not start a second copy):

```sh
uv run --directory backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal, replace `SERIAL` with your `adb devices -l` serial:

```sh
adb -s SERIAL reverse tcp:8000 tcp:8000
adb -s SERIAL reverse tcp:8082 tcp:8082
cd mobile
ANDROID_HOME="$HOME/Android/Sdk" EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 \
  npx --yes @expo/agent-cli@latest dev --android --device SERIAL \
  --local --dev-client --detach --wait-ready --port 8082 --localhost --json
```

Use Development demo sign in only for this fictional local environment. Backend and mobile environment files are configured locally; no credentials appear in this document. A stale reload may require closing/reopening RE. USB forwarding must remain active; a physical device without USB requires a reachable LAN backend and Metro address.

Portal, separate terminal:

```sh
uv run --directory backend python -m app.seed_clinician --fictional-demo
npm --prefix portal run dev
```

The portal is currently running at http://localhost:3000/login; reuse it rather than starting a second instance. `portal/.env.local` is locally configured for `PORTAL_DATA_MODE=api`, backend port 8000, and development-only fictional sign-in. That identity still requires actual backend role/link/consent records. Do not use the development token in production.

## Remaining acceptance gates

1. Repeat the repaired Android activity → feedback → PostgreSQL → My Journey scenario without an interrupted reload. The recovered path and matching persistence/UI evidence passed in this session.
2. Complete camera/voice coexistence, denial/revocation, mute, background/reconnect and permission tests on the physical device.
3. Verify actual Supabase patient/clinician authentication and production cookie/hosting behavior.
4. Verify provider-side deletion behavior and any workspace/model/region limitations separately from saved settings.

Real Android voice, recommendation client tool, recovered activity completion/feedback, persisted My Journey and authorized stored-report display/revocation are verified with fictional identities. The complete multimodal/device acceptance suite is not yet complete; Gemini remains future V2 with no V1 camera transmission or SDK dependency.
