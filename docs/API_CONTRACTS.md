# RE:SONANCE — API contracts


Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.


## Canonical source

[OpenAPI 3.1](../contracts/openapi.yaml) is the field/schema authority. [Tool contracts](../contracts/tool_contracts.json) use the same definitions. No endpoint below is implemented. Supabase clients own registration, login, password reset, refresh and logout; FastAPI accepts only validated access tokens and maps identity through getMe/onboardPatient. A new authenticated clinician is not automatically provisioned as a patient.

## Shared HTTP semantics

All routes are /v1, HTTPS, Bearer JWT. UUIDs identify application records, not email addresses; timestamps are RFC3339 UTC, periods half-open. Request objects reject unknown keys. Nullable fields use explicit null, not empty strings. MemoryUpsert.source_id may be null: an explicit preference UI submission then creates a structured-input source atomically; provided sources must already be permitted same-patient confirmed evidence. Lists return items + next_cursor; timestamped owned records use descending (created_at,id), catalog/assessment definitions use ascending id, doctor patient lists use ascending patient_id, and transcript messages use ascending (connection_epoch,sequence,id); cursors are opaque, patient/filter-bound and integrity checked. Default limit 20, maximum 100. API validates IANA timezone and all cross-field/domain rules. Responses use application/json; secrets/health responses are private, no-store.
Every mutation including DELETE and generic tool dispatch requires Idempotency-Key UUID. Scope = authenticated actor + method + canonical path + key; canonical request hash detects changed body (409 IDEMPOTENCY_CONFLICT). Proposed demo metadata retention 24h, not a clinical retention rule. Business outcome/resource identity deduplicates; current authorized representation may reflect later state. Reauthorize before replay. Retain resource/version metadata, not full transcript or private report bodies; recommendations must still be usable/current. Credential tokens are only in a bounded encrypted transient cache until expiry; an expired same-key replay gives CREDENTIAL_EXPIRED, new request key may provision a new credential. No secret response goes into SQL idempotency metadata.

## Errors and permissions

Every failure uses Error {code,message,request_id,retryable}. 401 AUTH_INVALID; 403 ROLE_REQUIRED, CONSENT_REQUIRED or AUTHORIZATION_REVOKED; 404 RESOURCE_NOT_FOUND (also conceals other-patient IDs); 409 VERSION_CONFLICT, INVALID_TRANSITION, STALE_RECOMMENDATION, IDEMPOTENCY_CONFLICT, REPORT_NOT_READY, CREDENTIAL_EXPIRED or ANSWER_EXISTS; 422 VALIDATION_ERROR; 429 RATE_LIMITED with Retry-After; 500 INTERNAL_ERROR; 503 PROVIDER_UNAVAILABLE or DATABASE_UNAVAILABLE. Do not echo prompts, transcript text, tokens or internal SQL errors. Every authenticated endpoint rejects a disabled user.
A successful identity check is insufficient for record access. patient owner = JWT maps to that patient; clinician = verified trusted application role + active care link + active, unexpired, unrevoked grant for the resource and period. Role and consent are read from current application records, not editable JWT user_metadata. Every child ID is checked through parent ownership.

## Operation inventory

| Method/path | operationId | Contract |
| --- | --- | --- |
| `POST /v1/me/onboarding` | `onboardPatient` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/me` | `getMe` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `PATCH /v1/me` | `updateProfile` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/patient-context` | `getPatientContext` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `PATCH /v1/patient-context` | `updatePatientContext` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/memories` | `upsertMemory` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `DELETE /v1/memories/{memory_id}` | `deleteMemory` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions` | `createConversation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/conversation-sessions` | `listConversations` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/conversation-sessions/{session_id}` | `getConversation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `PATCH /v1/conversation-sessions/{session_id}` | `updateConversation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions/{session_id}/messages` | `ingestMessages` | V1 normalized ElevenLabs user/agent text events only. connection_id and allocated connection_epoch must match the owned provider connection. Active transcript grant required at ingestion; accept bounded late final messages from a closed connection only with event time at/before recorded close and current consent. No provider audio-history download, camera bytes, image/video URIs or hidden text retention. |
| `GET /v1/conversation-sessions/{session_id}/messages` | `listMessages` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/conversation-sessions/{session_id}/summary` | `getSummary` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/conversation-sessions/{session_id}/guided-question` | `getGuidedQuestion` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions/{session_id}/guided-answers` | `submitGuidedAnswer` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions/{session_id}/guided-skips` | `skipGuidedQuestion` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions/{session_id}/tools/{tool_name}` | `dispatchTool` | Validate connection_id belongs to session and is active; normalize client invocation identity without assuming SDK callback exposes native tool_call_id. ElevenLabs blocking client tool resolves only after authorized result is applied to UI. All trusted business rules remain in FastAPI. |
| `POST /v1/observations` | `createObservation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/observations` | `listObservations` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/observations/{observation_id}/confirmation` | `confirmObservation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/observations/{observation_id}/corrections` | `correctObservation` | Create new confirmed row and correction source; supersede original atomically; never edit source transcript. |
| `GET /v1/activities` | `listActivities` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/activity-recommendations` | `createRecommendation` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/activity-sessions` | `startActivity` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/activity-sessions/{activity_session_id}` | `getActivitySession` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/activity-sessions/{activity_session_id}/events` | `recordActivityEvent` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/activity-sessions/{activity_session_id}/feedback` | `submitFeedback` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/assessments` | `listAssessments` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/assessments/{assessment_id}/responses` | `submitAssessment` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/reports` | `requestReport` | Creates pending report; optional durable jobs process it; same report gets a new version after accepted corrections. |
| `GET /v1/reports` | `listReports` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/reports/{report_id}` | `getReport` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/care-links` | `inviteClinician` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/care-links` | `listCareLinks` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `PATCH /v1/care-links/{care_link_id}` | `updateCareLink` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/consents` | `grantConsent` | transcripts requires null care_link_id/data_from; reports/alerts require active owned care_link_id; data_from null means explicitly selected all history. |
| `GET /v1/consents` | `listConsents` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `DELETE /v1/consents/{consent_grant_id}` | `revokeConsent` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/doctor/patients` | `listDoctorPatients` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/doctor/patients/{patient_id}/reports` | `listDoctorReports` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/doctor/patients/{patient_id}/reports/{report_id}` | `getDoctorReport` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `GET /v1/doctor/patients/{patient_id}/alerts` | `listDoctorAlerts` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `PATCH /v1/doctor/patients/{patient_id}/alerts/{alert_id}` | `updateDoctorAlert` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/review-requests` | `requestReview` | Creates review record even without authorized recipient; UI must distinguish recorded request from clinician notification. |
| `GET /v1/alerts` | `listPatientAlerts` | See x-permission and shared semantic rules in docs/API_CONTRACTS.md. |
| `POST /v1/conversation-sessions/{session_id}/agent-connections` | `createAgentConnection` | V1 only: ElevenLabs WebRTC conversation token for voice, authenticated signed WebSocket URL with textOnly for separate text mode. Server chooses provider/agent. Both use same application session context. No images, video, camera state, Gemini fields or permanent API keys. Secrets are transient/no-store; connect_before is a RE connection-start guard, not asserted provider expiry. credential_expires_at is null unless provider reports a verified expiry. Refuse 503 PROVIDER_PRIVACY_UNVERIFIED until agent privacy settings are attested; old connection must close before replacement. 409 CONNECTION_ACTIVE/CONNECTION_EXPIRED/VERSION_CONFLICT are explicit. |
| `PATCH /v1/conversation-sessions/{session_id}/agent-connections/{connection_id}` | `updateAgentConnection` | Provider ID reported by SDK is metadata, not authentication. Voice ID must match provisioning response where available; never fetch provider history using an untrusted client ID. Mode change closes old provider connection and preserves application session/controller context. No camera state is accepted. |
| `GET /v1/my-journey` | `getMyJourney` | Owner-scoped projection from activity_sessions, immutable catalog rows and feedback; descending started_at,id cursor. No report job must complete before an accepted activity appears. No images/camera metadata. The UI invalidates this query only after accepted completion/feedback. |

## Cross-field and state rules

- Onboarding creates only a patient identity/profile if no trusted role already exists. Clinicians are provisioned/verified by operator; no role parameter is accepted.
- Empty ProfilePatch/SessionPatch is invalid. Session states use created→active→interrupted→active→ended; ending is terminal; mode changes require expected_version; camera preview is strictly local. Actor, session, sources and child records must refer to the same patient.
- History messages are retention uploads, not provider prompts. MessageBatch requires a matching active transcripts grant; no clinician message route exists. Finality final/interrupted is explicit; only patient speech can support a proposal. Request body cap proposed 256 KiB and 50 events; reject oversized requests with 413 BODY_TOO_LARGE (Error), never truncate.
- Observation mood/energy values are 0–10; sleep_hours is 0–24, all at most two decimal places (multipleOf 0.01). Reject excess precision rather than silently rounding SQL writes. createObservation makes a proposal even if the model asserts confirmation. confirmObservation is direct patient UI. Guided answers are explicit structured patient actions and create confirmed observations plus a source. Corrections require a current confirmed head, create a correction source/new row, supersede predecessor and invalidate reports atomically.
- Recommendation options are immutable activity rows, maximum 3 and ordered by rank. Current recommendation is latest (created_at,id) for the session. Expiry default proposed 10 minutes, bounded by session lifetime; validate at selection. ActivityStart must match that session, recommendation, offered activity/version and current eligibility. One running activity per conversation; tool selection_channel is server-set voice, touch calls startActivity with touch.
- Progress does not complete an activity. expected_version serializes events; client_event_id additionally deduplicates. complete/abandon are terminal; feedback accepted only after completion, once per activity session. Free reflection notes persist only when explicitly submitted as feedback comment.
- Assessment version must match; unique question IDs must exactly match complete definition with validated answer bounds. No clinical instrument/scoring is assumed. Assessments remain available without transcript storage.
- ConsentCreate: transcripts requires null care_link_id/data_from; reports/alerts require active owned link. expires_at must be future. data_from null explicitly means all available history and must be shown in consent UI. New grant atomically retires prior unrevoked grant for same patient/link/scope. Deleting/revoking an expired or revoked owned grant is 204; unknown ID is 404. No model tool grants sharing.
- CareLink: patient invites verified target; only that clinician accepts pending; either participant may revoke; revocation closes future access and suppresses delivery. Reinvitation for the same pair reuses the relationship with an audited transition.
- Doctor reports must belong to URL patient and fit the active report scope for the entire period. Source IDs do not grant access to private bodies. Recheck current authorization before returning report or cached idempotent outcome. Owner access uses a separate branch of the same check.
- requestReview records patient intent even if no authorized clinician exists. Portal visibility requires alerts scope. Do not report notification delivered until authorized visibility succeeds; acknowledgement and resolution are separate versioned transitions.
- ReportRequest period_end must exceed period_start and not exceed current server time. Proposed maximum period 90 days and maximum detail counts follow OpenAPI bounds. Never silently truncate a report: split requested periods or return 422 REPORT_TOO_LARGE. ReportRead returns 409 while pending/failed (with report receipt status from list); stale returns an explicitly stale Report.
## Canonical schema index

`Error`, `Ack`, `SourceRef`, `OnboardingRequest`, `ProfilePatch`, `Me`, `PatientContext`, `ContextPatch`, `SessionCreate`, `ConversationSession`, `SessionPatch`, `TranscriptEvent`, `MessageBatch`, `MessageBatchResult`, `Message`, `Summary`, `ObservationCreate`, `Observation`, `ObservationConfirm`, `ObservationCorrection`, `MemoryUpsert`, `Memory`, `Activity`, `RecommendationRequest`, `RecommendationOption`, `Recommendation`, `ActivityStart`, `ActivitySession`, `ActivityEventRequest`, `FeedbackRequest`, `Feedback`, `AssessmentDefinition`, `AssessmentSubmit`, `AssessmentResponse`, `ReportRequest`, `ReportReceipt`, `Trend`, `Report`, `CareInviteRequest`, `CareLink`, `CareLinkPatch`, `ConsentCreate`, `ConsentGrant`, `ReviewRequest`, `Alert`, `AlertPatch`, `DoctorPatient`, `GuidedQuestion`, `QuestionAnswer`, `ToolArgs_get_patient_context`, `ToolArgs_get_next_guided_question`, `ToolArgs_present_activity_recommendations`, `ToolArgs_propose_observation`, `ToolArgs_select_activity`, `ToolArgs_request_clinician_review`, `AvatarCustomization`, `PatientPreferences`, `RecoveryPlan`, `MemoryValue`, `ActivityConfig`, `QuestionSkip`, `ToolDispatch`, `ToolResult`, `ConversationSessionPage`, `MessagePage`, `ObservationPage`, `ActivityPage`, `AssessmentDefinitionPage`, `ReportReceiptPage`, `CareLinkPage`, `ConsentGrantPage`, `DoctorPatientPage`, `AlertPage`, `AgentContext`, `AgentConnectionRequest`, `ElevenLabsVoiceBootstrap`, `ElevenLabsTextBootstrap`, `AgentConnectionBootstrap`, `ProviderConnection`, `ProviderConnectionPatch`, `MyJourneyItem`, `MyJourneyItemPage`

## V2 contract changes for V1 ElevenAgents rollout

POST agent-connections replaces live-credentials. SessionCreate/SessionPatch reject camera_enabled: preview is never API state. A voice bootstrap returns a private WebRTC conversation_token; a separate text bootstrap returns a signed_url with text_only=true over WebSocket. Provider is server-selected ElevenLabs only. connect_before is an RE start guard; credential_expires_at remains null when the provider does not document expiry. Privacy policy must be verified before bootstrap; otherwise 503 PROVIDER_PRIVACY_UNVERIFIED. Credential caching uses the earlier of the local guard and any known expiry, never a fabricated provider TTL.

ToolDispatch and MessageBatch bind connection_id to the owned application session and connection epoch. Tool contract version is 2.0.0. ElevenLabs client tools must wait for response: render backend activity IDs as cards before resolving the tool promise, then speak those same options. SDK invocation IDs may require bridge normalization; transport retries reuse the bridge ID. Late events cannot bypass current transcript consent. No history downloads or content webhooks are needed.

GET /v1/my-journey returns MyJourneyItemPage, ordered descending by activity started_at/id, combining owned activity sessions, catalog snapshots and accepted feedback. Completion is visible after its write acknowledgement, independently of report processing. current_connection_id is a computed active connection projection. No V1 request accepts images, video, frame payloads or camera state. VoiceAgentAdapter and privacy requirements are defined in the adjacent JSON contracts.
