# RE:SONANCE — Security and privacy plan

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

## Trust boundaries and identities

Use fictional patients only. A hackathon app is not a validated medical device or a compliant real-patient deployment. All controls below are requirements, not implemented guarantees. Supabase Auth issues identities; Tiger Data application authorization is separate. The mobile app, browser, model output, tool args, camera frames, transcript text and user-controlled IDs are untrusted inputs.

Validate JWT signature with trusted issuer JWKS and a pinned allowlist of accepted algorithms; verify iss/aud/exp and relevant timing claims. Cache keys with bounded freshness and refresh on unknown kid, without treating key-fetch failures as authorization success. Never accept alg=none, decode-only tokens, a browser-supplied role, or editable user_metadata. Map sub to users.auth_subject and read current trusted role/disabled status. Clinician verification is an out-of-band fixture/operator step. JWT/session revocation semantics differ from app sharing revocation; do not claim logout instantly invalidates all issued JWTs. Real account-disable guarantees need an explicit policy beyond this fictional demo.

Clients sign in/refresh/logout with Supabase. Mobile tokens belong in platform-protected storage; Next.js server session cookies use the provider-supported server integration with secure/httpOnly/SameSite settings as appropriate. Reverify identity server-side. If browser-to-FastAPI bearer calls are chosen, keep access token in memory and use provider-supported refresh; never place tokens in URLs, analytics or logs. Next.js must not cache one patient's report for another user. Exact client auth library/SDK versions remain a spike gate.

## V1 provider credentials and client tools

Permanent ElevenLabs API key stays in backend secrets. Private voice sessions use server-provisioned WebRTC conversation tokens; separate text sessions use signed WebSocket URLs with textOnly. Server selects agent and returns only the matching bootstrap variant; no V1 Gemini fields/provider choice exist. Return no-store; keep tokens/URLs out of SQL/idempotency payloads/logs. connect_before is a RE guard, not provider TTL. Use actual provider expiry only if reported/verified.

Every client tool remains allowlisted, typed, owner/session/connection scoped and idempotent. Model/bridge origin is not trusted proof. Configure matching client tools with Wait for response; render exact backend cards before callback resolution/narration. Native tool ID exposure is not assumed; normalize callback identity and keep backend uniqueness checks. Closed connections cannot authorize new tools. Confirmation, correction, memories and sharing remain explicit patient UI operations.

## V1 local camera isolation

Camera images/video are strictly on-device: no transmission, upload, recording, persistence, screenshots/session replay, frame processing, image URI/base64, video tracks or screen sharing. LocalCameraPreviewController is separate from VoiceAgentAdapter and API state; no camera_enabled field is accepted/stored. Native preview does not request microphone; voice does not request camera. Inspect outgoing WebRTC senders while preview is active: audio only. Release local preview on explicit off, unfocus/background and permission revocation independently of voice status.

Display “Camera preview only — RE cannot see your video yet.” Agent prompt must deny visual access and never claim surroundings recognition. V2 video transmission needs a new explicit consent/capability path, not inherited preview permission. Existing fake design assets are not camera content or proof of an implemented preview.

## Patient and clinician access

Patient own-record access uses authenticated ownership. Clinician access requires verified role + active care link + active unrevoked/unexpired scope + resource patient and period match. Patient list and counts must not reveal unshared patients. A care-link invitation/acceptance is not a sharing grant. Reports and alerts are distinct grants. Transcripts/private memories are never clinician-accessible in MVP, including through source IDs embedded in report JSON.

The report route has one access-check entry: owner branch or authorized clinician branch. No API-to-Report request path bypasses it. Reauthorize every read, before JSON response authorization, on idempotent outcome replay and before alert visibility. Serialize grant creation/revocation against ingestion/delivery as needed with consistent lock ordering and short transactions; no locks across network streaming. The authorization transaction is the linearization point: revocation committed first denies the read; an earlier authorized in-flight response or already viewed data cannot be retracted. Portal polls to detect lost scope and clears local views; this is not a claim of remote erasure.

Use private,no-store on report/health/credential responses. If cookie-authenticated browser mutations exist, add CSRF protection/Origin checks; CORS alone is not authentication. Restrict CORS to configured origins, bound requests/rates and reject oversized batches. Use TLS and parameterized DB access with a least-privilege non-owner runtime role. Runtime cannot create/alter/drop tables or modify audit history. Private schema re is not exposed via Supabase Data API; no implicit auth.uid() or RLS protection is claimed.

## Retention and sensitive information

Transcript consent is opt-in and separate from sharing. The bridge sends no conversation text for retention when history is off; backend rejects revoked/expired grants. Keep transient text/audio buffers bounded and clear them on interruption/end/revocation. No raw audio/video storage by default, including debugging logs, crash attachments, request tracing and object storage. V1 camera content never reaches any provider. ElevenLabs processes authorized voice/text only; its recording/retention policy is a separate release gate from RE history consent.

Proposed fictional-demo cleanup: consented transcripts and idempotency metadata expire after 24h; all fictional demo records removed within 7 days after judging. These are documented assumptions requiring working cleanup, not legal guarantees. Before any real data: approve region, provider terms, retention/deletion, access/audit governance, backup expiry and clinical response policies. Removing a sharing grant does not delete a patient's records; removing retained text must also purge sensitive cached responses and refresh any derived summary containing it. Source tombstones preserve permitted lineage without leaking removed content.

Confirmations and corrections are explicit patient actions. Use only patient-reported facts; no emotion inference from voice/video, automated diagnosis, recovery score or relapse prediction. Current confirmed heads enter factual trends. Preserve source IDs/revisions and correction lineage; never include an unshared transcript excerpt as a report source. Audit action/actor/resource/request/time metadata; avoid raw observations, prompts, generated health text, tokens or freeform exception strings in operational logs.

## Threat scenarios

| Threat | Required mitigation | Future validation |
| --- | --- | --- |
| Change patient/report/session UUID | Scope every parent/child read; composite ownership FKs; conceal unknown/other-owned IDs. | T-AUTH-01 cross-patient matrix. |
| Public doctor/demo role toggle | Trusted server role and verification; operator fixtures only. | T-AUTH-02 editable metadata and unverified account. |
| Prompt injection requests history/SQL/sharing | Six-tool allowlist, no consent/confirmation tools, independent service checks. | T-TOOL-02 disallowed names/args. |
| Transcript upload after revocation / replay | Recheck current grant, atomic batch, clear queue, sanitize idempotency metadata. | T-CONSENT-01 race and replay. |
| Two active grants preserve access after revocation | Serialize replacements, retire old grant, unique current-grant indexes. | T-CONSENT-02 concurrent grants. |
| Stale/forged activity IDs | Validate current batch, version, eligibility and one running activity. | T-ACT-01 voice/touch race. |
| Duplicate jobs/calls/corrections | Idempotency keys, unique successors/events, row versions and fenced job leases. | T-DATA-02 concurrency suite. |
| Cached report leaks across users | Private/no-store, per-request current authorization, no shared Next.js cached health payload. | T-PORTAL-02 alternate users/revoke. |
| Tokens or patient text in logs/telemetry | Redaction/no body logging, content-free errors and audit metadata. | T-PRIVACY-01 canary scan. |
| Malicious avatar/activity config | Versioned allowlisted renderer/assets and bounded settings; no remote scripts or arbitrary URLs. | T-MOBILE-02 unknown config. |
| Misleading clinical safety claim | Fictional fixtures, explicit no-diagnosis/emergency boundary, visible mock status. | T-DEMO-01 copy and behavior audit. |

## Demo operations and limits

No real emails/messages, external notifications, real medical records or clinician enrollment are triggered by documentation generation. Notification MVP is authorized in-portal visibility and acknowledgement. Provider real-time content may still leave the device for ElevenLabs; never describe direct streaming as local-only AI. Use fictional scripts and disclose live versus mock mode in the UI and demo.

The preexisting design HTML includes a clinical-token entry, role toggles, illustrative outcomes and alert-based simulated synchronization. Do not reuse these as real auth or persistence. Keep the assets intact as references, but replace unsupported physiological wording and fake success behavior in any future implementation.

Production readiness is explicitly absent: no clinical validation, penetration test, real-data legal review, device security audit, disaster recovery test or incident-response process has been completed.

## Provider-side retention is a separate gate

Do not accept provider defaults. Confirm actual saved private-agent configuration for voice and text: disable audio saving (record_voice=false), set zero-day transcript deletion with the appropriate deletion flags, disable content webhooks/debug exports, and verify residual deletion semantics. Zero-day scheduled deletion is not a ZRM guarantee. Record actual ZRM availability/model/region restrictions if used. PostgreSQL transcript opt-in does not change ElevenLabs processing/retention. Fail credential bootstrap with PROVIDER_PRIVACY_UNVERIFIED until redacted configuration/version and deletion-behavior evidence is approved. No account is connected here; this gate is explicitly unverified. See PROVIDER_VERIFICATION.md.

Add threat checks for SDK publishing a camera track while preview permission is granted, analytics capturing the preview, provider prompt claiming vision, default provider audio/transcript storage, and text mode silently activating a microphone. Deny these behaviors; do not rely solely on a UI label.
