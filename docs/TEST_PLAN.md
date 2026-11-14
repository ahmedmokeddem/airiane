# RE:SONANCE — Prospective test plan

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

## Test boundaries and tooling choices

These are tests to implement, not passing application tests. The only checks run in this turn concern planning artifacts and are recorded separately in planning-validation/consistency.json. Proposed tools: pytest/httpx for Python units/API, real disposable PostgreSQL for constraints/concurrency, typed mobile reducer tests and platform UI automation, and Playwright for Next.js. Pin versions after the toolchain spike. Do not substitute SQLite for PostgreSQL FK/index/locking behavior.

Default automated suites use mocked provider/Auth JWKS/time/transport and fictional fixtures. A separately invoked capability test may contact ElevenLabs on a fictional device/account; label its cost/network requirement and never run it implicitly as a unit test. No real patient data, externally sent notification or shared production database is used.

## Required fixtures

Two patients, verified and unverified clinicians, an active and revoked care link, grants covering different scopes/periods/expiry, an empty patient, three guided fields, all five catalog families, current/expired recommendation batches, complete/abandoned activities, consented/off-history sessions, a partial transcription, corrected/superseded fact and a nonclinical versioned assessment. Fix UUIDs and clocks in tests; don't make dates rely on host timezone.

## Test matrix

| ID | Level / owner | Assertions |
| --- | --- | --- |
| T-AUTH-01 | API/DB, D3 | For every owned endpoint, another patient's parent/child IDs fail without existence leakage; composite FKs reject cross-patient source/session/link references. |
| T-AUTH-02 | API, D3 | Valid/expired/wrong issuer/audience/algorithm/signature/unknown-key JWTs; key rotation; disabled user; role chosen in editable metadata or UI cannot create verified clinician access. |
| T-CONSENT-01 | API/concurrency, D3/D4 | Revoke/expire during transcript ingestion, report read, idempotent replay and alert visibility; race outcomes follow documented authorization ordering. No future data escapes denied scope. |
| T-CONSENT-02 | DB/service, D3 | Concurrent grant replacements leave one unrevoked grant per scope/link; accepting a link grants no reports; revocation of one scope does not revoke unrelated patient records. |
| T-TOOL-01 | Contract/bridge, D1/D2 | All six exact tool names/arguments/results match canonical schemas; dispatch maps to the same use case as touch UI. Repeated call ID cannot duplicate effects. |
| T-TOOL-02 | Security/unit, D1/D3 | Unknown tools, extra args, forged activity/source IDs, prompt-requested SQL/consent/confirmation are rejected; review request waits for patient confirmation tap. |
| T-GUIDE-01 | Unit/API, D1/D3 | Read-next-question never advances; answer validates flow version/question/value, stores confirmed structured source once; skip endpoint preserves missing data and marks skipped; resume retains state. |
| T-ACT-01 | Integration/concurrency, D2/D3 | Visible and spoken options have identical recommendation_id/activity_id/version/order; touch/voice race gives one running session, stale batch rejected and duplicate completion/feedback does not double-count. |
| T-ACT-02 | Mobile, D2 | Each of five allowlisted renderers runs locally, can stop, emits legal complete/abandon event, accepts feedback only when complete, and returns to same conversation. |
| T-HISTORY-01 | API/provider adapter, D1/D3 | Mixed audio/transcript events, incremental chunks, speaker separation, epochs and duplicates reconcile; changed existing client ID conflicts; interrupted turns are partial, not invented final speech. |
| T-HISTORY-02 | Privacy/API, D1/D2/D3 | History off sends no text retention upload; revoked grant rejects entire batch; no hidden transcript in summaries/cache/logs; metadata-only lineage works without retained messages. |
| T-OBS-01 | Unit/API, D1/D3 | Assistant speech and speculative affect never become confirmed patient facts. Patient can confirm/reject, edit through correction flow, preserve source revisions and supersede old head once. |
| T-DATA-02 | Real PG, D3/D4 | Two corrections, completions, duplicate messages and grant writes serialize safely; stale expected_version fails; job lease token rejects late worker commit; retry after crash creates no duplicate reports/alerts. |
| T-REPORT-01 | Golden unit/API, D4 | Correct confirmed heads, periods/timezone, counts/means/deltas/coverage, assessment version/answer data, source references and stale refresh. No pending/superseded/abandoned values counted as accepted current facts. |
| T-REPORT-02 | API, D3/D4 | Doctor grant covers entire report period; report owner matches URL patient; wrong scope denied; source ID cannot fetch transcript; private/no-store present; report-too-large is explicit, not silent truncation. |
| T-MOBILE-01 | Device/navigation, D2 | Login/onboarding → voice/text → cards → activity → feedback → conversation → reports/consent; back/relaunch/interruption; microphone denied still allows typed mode; no microphone/audio track or playback in genuine textOnly mode. |
| T-MOBILE-02 | UI/accessibility, D2 | Labels/contrast/tap targets/reduced motion, avatar bounds and empty/error/loading states; unknown renderer or remote script config rejected. |
| T-PORTAL-01 | Browser, D4 | Verified clinician sees only linked authorized patients, reports, alert states and acknowledgement; unverified doctor denied; empty/no-scope state explained without patient leakage. |
| T-PORTAL-02 | Browser/API, D3/D4 | Alternate user sessions and revocation cannot reuse shared Next.js cached reports; stale UI clears on authorization failure; no client-only authorization. |
| T-PRIVACY-01 | Log/storage audit, all | Canary raw text/credentials/media absent from ordinary logs, crash/analytics attachments, idempotency bodies and object storage; current retention cleanup purges authorized bodies safely. |
| T-DEMO-01 | E2E, all | Real vs mock status visible, no fake synchronization/physiology claim, explicit help recorded without delivery promise; first slice and provider-down scenario rehearsed. |

## Report golden example

Period [2026-11-13T00:00:00Z,2026-11-14T00:00:00Z): confirmed mood values 2 and 6 initially mean 4. Correct the first value to 8 through the correction endpoint: report becomes stale, refresh gives count 2 and mean 7; original value is excluded and source lineage retained. Proposed mood 10 does not enter the mean. Two completed activities and one abandoned give activity_completions count 2. Ratings 2 and 4 give rating mean 3. A missing prior period produces delta null, not 0 or a recovery claim. An observation exactly at period_end belongs to the next period. Test Europe/Helsinki display labels separately from UTC interval boundaries and DST-sensitive buckets.

Assessment sections contain pinned definition version, title, answers, completeness and observed time; do not invent a diagnostic aggregate. No trend substitutes activity feedback for mood. Oversized report detail returns an explicit error rather than omitting records while claiming complete coverage.

## End-to-end demo scenarios

1. **First live slice:** fictional patient signs in → active session → ElevenLabs asks one optional question → patient confirms fact → backend recommendations render then ElevenLabs speaks same IDs → breathing complete/rating → own factual JSON → link accepted/share → verified doctor reads same report → revoke → subsequent clinician read denied.
2. **History/correction:** start with history off, verify no message rows; enable transcript grant, collect patient/assistant turns; disconnect mid-utterance, partial summary; confirm and correct a fact; refresh report; revoke history, queued/replayed upload denied.
3. **Failure honesty:** provider unavailable or microphone denied → visible AI unavailable/text fallback as supported → local activity/report access stays truthful → no fabricated stored completion or guaranteed clinician notification. Mock demonstration remains visibly simulated.

## Gates and execution evidence

G0 needs actual native/provider compatibility and SQL execution; documentation validation is insufficient. G1/G2 require real API/PG and at least one actual ElevenLabs/device path. G3 covers full MVP functions and recovery. G4 requires authorization/consent/privacy regression plus demo rehearsal. No arbitrary coverage percentage is a substitute for these behavior checks. Capture operation/schema versions, device/OS, ElevenAgents agent/SDK/configuration version and fixture IDs in future test evidence without health content or tokens.

## V1 phased rollout test additions

| ID | Owner / scope | Required result |
| --- | --- | --- |
| T-CAMERA-01 | D2, native lifecycle | Voice start/reconnect never requests camera; preview toggle never starts/stops voice. Exercise camera denied/off, mic denied, background/focus and permission revocation independently. |
| T-CAMERA-02 | D1/D2/D3, egress/storage | While preview is active, outgoing WebRTC has zero video tracks and all API/provider/text requests contain no frame/image/video/URI/base64/camera state. No files/capture/record APIs, preview crash screenshots or telemetry copies. |
| T-CAMERA-03 | D1/D2, UI/agent | Exact disclosure “Camera preview only — RE cannot see your video yet.” is visible/accessibly labeled; agent never claims to see patient surroundings, even when prompted to look. |
| T-ADAPTER-01 | D1, contract | V1 composition selects ElevenLabsAdapter through VoiceAgentAdapter; no Gemini SDK/key required, no base camera method, same controller/context across separate voice/text connections. |
| T-ELEVEN-01 | D1/D2, actual development build | Pin/test published RN SDK/LiveKit/Rive peers with candidate Expo SDK 57, physical device audio/interruption, matching blocking client tools and same activity IDs. Documentation support alone cannot pass. |
| T-TEXT-01 | D1/D2/D3, integration | Close voice provider connection, create textOnly signed WebSocket under same application session; no mic/audio capture; preserve question/recommendation/accepted activity context and return to voice without resetting it. |
| T-PROVIDER-PRIVACY-01 | D1/D3, configuration | Actual saved voice/text agent settings disable recordings and enforce reviewed transcript retention/deletion; confirm ZRM semantics separately. Unverified policy blocks bootstrap; no secret/content in evidence. |
| T-JOURNEY-01 | D2/D3/D4, E2E | Accepted activity completion/feedback immediately appears through getMyJourney, survives relaunch and remains visible while JSON report refresh is pending. Failed writes stay pending/error. |

Primary V1 E2E: fictional patient opens ElevenAgents voice call → natural speech → optionally enables a strictly local preview → blocking client tool fetches backend recommendations → exact cards render before spoken presentation → voice/touch chooses current activity → complete/feedback → accepted My Journey item. Repeat with camera denied and voice reconnect. No model visual-access claim, image egress, Gemini dependency or hidden text-mode microphone is acceptable. Existing observation/source/correction, reports, consent, clinician authorization and no-PDF tests remain mandatory.

New tests are specified, not run: no app/build/account configuration is available in this documentation task. Use synthetic camera content and content-free track/egress metadata; do not record real preview media as test evidence.
