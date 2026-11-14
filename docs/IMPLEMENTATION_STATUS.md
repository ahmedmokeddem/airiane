# RE implementation status

Updated 14 November 2026. Work continued from the existing slice; canonical OpenAPI/tool wire contracts, the baseline migration, and Stitch assets are preserved. This is a tested development integration, not a production or clinical validation.

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
| Mobile / agent | Real native ElevenLabs voice and recommendation tool verified on one Android device; provider adapter; separate text-only connection; committed card acknowledgement before tool response; local preview; breathing/feedback/Journey; running-activity recovery; patient reports and explicit doctor sharing. | Separate text mode has regression coverage but no new complete real-device text conversation recorded in this pass. Rive artwork remains a labeled placeholder. Session transcripts remain in memory; history persistence is not implemented. |
| FastAPI / PostgreSQL | Existing slice plus report generation/read/list, trusted clinician identity, participant care links, report grants/revocation, doctor report list/read, audit metadata and actor/filter-bound cursors. Stored reports aggregate accepted activities/feedback, available confirmed observations and complete assessments with source references. | New observation/assessment input and correction workflows remain deferred. Reports are bounded synchronous projections in the same application transaction; automatic refresh/background processing and prior-period deltas are not implemented. |
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
- Mobile: TypeScript, ESLint and five named unit tests pass. Covers committed cards, exact selection IDs, strict mock shapes, and no audio controls in text mode, and no context update to a disconnected provider. Web export passed in the preceding foundation; this pass additionally built and installed Android.
- Portal: TypeScript, ESLint, six tests and production build pass. Tests cover protected transport, denial/pending states, clinician-role verification and same-origin login/session mutation.
- Six shared fixture payloads validate against canonical OpenAPI 2.0.0. OpenAPI, tool contracts and SQL baseline hashes remain unchanged; numbered migration matches schema byte-for-byte. Hosted CI execution is not claimed.

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
