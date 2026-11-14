# RE:SONANCE — Technical Architecture

Status: proposed design, before implementation. RE:SONANCE is a multimodal AI companion supporting patients after TMS treatment.

[Open the interactive architecture diagram](architecture.html).

This specification describes intended behavior, not an existing implementation. The system supports patient wellbeing and clinician follow-up. It does not independently diagnose depression or replace medical care.

## 1. Architecture decision

Use one unified FastAPI Backend with logical API, application-service, and optional background-job modules, plus PostgreSQL. Patients connect directly to Gemini Live for low-latency multimodal conversations. All application reads and writes pass through FastAPI.

Gemini owns conversational generation. FastAPI owns authorization, application session state, activity eligibility, accepted observations, and persisted records. The mobile app owns media capture, playback, local avatar rendering, and the tool bridge.

Backend modules are logical boundaries within one application, not independently deployed microservices. Background Jobs are optional logical modules within the same Python application; this architecture does not specify a separate worker server or microservice.

## 2. Global components

| Layer | Component | Responsibility |
| --- | --- | --- |
| Client | Patient app — React Native + Expo | Login, voice, text, optional camera input, activities, confirmations, feedback, reports, and sharing settings. |
| Client | Animated avatar — Rive | Local listening, thinking, speaking, idle, and interrupted states, synchronized with actual playback. |
| Client | Doctor portal — Next.js | Authorized patient lists, shared reports, review alerts, and alert acknowledgement. |
| AI | Gemini Live API | Speech-to-speech interaction, text, optional camera frames, and function-call requests. |
| Backend | API boundary and authorization | JWT validation, application roles, ownership checks, request validation, rate limits, and consistent errors. |
| Backend | Conversation Controller | Guided questions, application sessions, pending confirmations, and validated tool dispatch. |
| Backend | Conversation Service (History + Session Summaries) | Opt-in conversation history, validated transcript events, and source-linked session summaries. |
| Backend | Observation Extraction (Structured Patient-Reported Facts) | Proposes facts from consented patient utterances or explicit answers; supports confirmation and corrections. |
| Backend | Patient Context & Memory | Preferences, recovery-plan context, confirmed memories, and relevant historical feedback. |
| Backend | Recommendation Engine | Activity eligibility, ranking, stable recommendation batches, and reasons. |
| Backend | Activity Service | Catalog, activity sessions, progress, completion, and feedback. |
| Backend | Observation Service | Confirmed patient-reported mood, sleep, energy, and assessment responses with provenance. |
| Backend | Report Service | Structured reports, longitudinal trends, time ranges, source references, and refresh status. |
| Backend | Care Link Service | Invitations, patient–doctor connections, and relationship lifecycle. |
| Backend | Consent Service | Report sharing, scoped access permissions, expiry, and revocation. |
| Backend | Alert Engine | Versioned review rules, explicit patient help requests, deduplication, and acknowledgement state. |
| Backend module (optional) | Background Jobs | Asynchronous report processing and notifications with durable claims, retries, and idempotency. |
| Data | Tiger Data / PostgreSQL | Authoritative application data, durable jobs, and audit records. |
| Identity | Supabase Auth | Patient and doctor sign-in, identities, sessions, and authentication token issuance. |
| Infrastructure | Modal or Vultr | Hosting candidates; the provider remains an open decision. |
| Development | Codex + Entire | Development assistance and shared context; outside the production request path. |

## 3. Connections and trust boundaries

| Connection | Transport | Contract |
| --- | --- | --- |
| Mobile / portal ↔ Supabase Auth | HTTPS | Sign-in and token refresh. Permanent privileged credentials never enter clients. |
| Mobile / portal ↔ FastAPI | HTTPS + Supabase access token | Backend verifies signature, issuer, audience, expiry, roles, and resource access. |
| Mobile ↔ Gemini Live | Secure WebSocket + ephemeral Gemini token | Audio, text, optional camera frames, model output, and function-call messages. |
| FastAPI → Gemini token provisioning | Server-side HTTPS | Create restricted, short-lived credentials using a backend-held key. |
| FastAPI → Supabase signing-key discovery | HTTPS | Retrieve and cache verification keys with key-rotation handling. |
| FastAPI / worker ↔ PostgreSQL | Private or restricted TLS database connection | Parameterized access, bounded connection pools, and transactions. |
| Worker → clinician delivery | Backend-controlled processing | Recheck current consent and care relationship before exposing alert details. |

There is no direct mobile or portal connection to the application database. Supabase Auth and Tiger Data are separate systems: identity issuance does not automatically protect Tiger Data records. Authorization must be enforced by FastAPI.

The mobile app is an untrusted caller. Model-produced tool arguments are also untrusted. The authenticated identity determines the patient; a supplied patient ID never grants access. Doctor roles require a trusted provisioning process and cannot be selected through editable profile metadata.

## 4. Conversation bootstrap and session ownership

1. The patient signs in with Supabase Auth.
2. The app requests an application session from FastAPI using the access token.
3. FastAPI verifies access, loads minimal relevant context, selects guided-flow and tool definitions, and creates the application-session record.
4. FastAPI requests a restricted ephemeral Gemini token. Bind supported session configuration restrictions during provisioning; a mobile-provided configuration is not an authorization guarantee.
5. The app receives the application-session ID, allowed session configuration, minimal context, and ephemeral token.
6. The app opens the Gemini Live connection and starts media streaming after the patient grants the relevant device permissions.

| State | Owner | Persistence |
| --- | --- | --- |
| Capture, playback queue, camera toggle, avatar state | Mobile app | Local and transient. |
| Model conversation context and resumption handle | Gemini; handle managed by app | Provider-managed continuity; protect handles as sensitive session credentials. |
| Question progress, pending confirmations, recommendations, accepted actions | FastAPI | PostgreSQL; recoverable after a media reconnect. |

Application session lifecycle: created → active → ended, with an interrupted state that can resume while authorized. A provider connection reset does not itself finish an application session. Expired or ended sessions reject new mutations.

## 5. Function calling and interface synchronization

The real execution path is Gemini → mobile tool bridge → FastAPI → domain module. FastAPI returns the authoritative result to the app, which forwards the corresponding function response to Gemini.

Each invocation carries an application-session ID, tool-call ID, allowlisted tool name, schema version, and validated arguments. FastAPI derives ownership from authentication, validates the current session state, and uses an idempotency key for mutations. Repeated calls return the prior outcome rather than creating duplicate records. Reusing a key with different arguments is rejected.

| Capability | Backend behavior |
| --- | --- |
| Retrieve context | Return a minimal, session-appropriate projection. |
| Get next guided question | Read or advance validated flow state; preserve assessment wording and version where applicable. |
| Recommend activities | Return eligible catalog activities, stable IDs, ranking, and reasons. |
| Propose an observation | Create a pending proposal for patient review, not a confirmed fact. |
| Start or update an activity | Validate the chosen activity and its current activity-session state. |
| Request clinician review | Record an explicit patient request and route it only to currently authorized recipients. |

Sensitive confirmations, especially sharing changes, happen through authenticated patient controls. A model claim that the patient consented is insufficient.

Recommendation responses contain `recommendation_id` (the recommendation-batch ID), application-session ID, catalog activity IDs, display order, descriptions, eligibility reasons, and validity information. The app renders these exact options and sends their identities to Gemini for spoken presentation.

Selecting an option creates a distinct activity-session ID after eligibility is rechecked. Suggested, selected, started, completed, and abandoned are different events. Gemini must not report a successful write before the backend has accepted it.

## 6. Backend dependency rules

API adapters parse and authenticate requests, application services orchestrate use cases, domain rules enforce behavior, and persistence/provider adapters implement external access. Business rules do not depend on FastAPI request objects, Gemini SDK types, or database sessions.

Each module owns its records and exposes explicit operations. The Report Service consumes authorized projections rather than changing observations. The Recommendation Engine reads context and catalog eligibility rather than marking activities complete. The Conversation Controller coordinates these modules rather than duplicating their rules.

Transaction boundaries follow use cases. A confirmed observation and its processing event are committed together. Repositories do not independently commit partial operations.

## 7. Logical data ownership

These are conceptual record groups, not a physical schema or migration.

| Owner | Records |
| --- | --- |
| Identity mapping | Application users, external auth subject, patient profiles, verified clinician profiles, trusted roles. |
| Conversation Controller | Application sessions, flow versions, question progress, pending proposals, tool-call outcomes. |
| Conversation Service | Opt-in history, reconciled transcript events, source-linked session summaries and summary versions. |
| Observation Extraction | Candidate patient-reported facts, source references, confirmation state and correction provenance. |
| Context & Memory | Preferences, recovery-plan references, confirmed structured memories, provenance. |
| Observation Service | Observations, assessment definitions and versions, responses, confirmations, corrections. |
| Recommendation Engine | Recommendation batches, activity references, ranking reasons, validity. |
| Activity Service | Catalog entries, activity sessions, progress events, completions, feedback. |
| Care Link & Consent | Invitations, care relationships, sharing scopes, grants, expirations, revocations. |
| Report Service | Report projections or snapshots, periods, versions, source references, refresh status. |
| Alert Engine | Rule versions, triggering evidence, recipients, acknowledgements, resolution. |
| Processing & audit | Outbox events, jobs, attempts, access events, sensitive-change audit records. |

Confirmed facts retain source, relevant observation time, recorded time, confirmation, and originating session where applicable. Corrections remain traceable. Missing or stale information is never treated as a normal assessment result.

Conversation transcripts are opt-in and separate from structured memory. Without transcript opt-in, the bridge does not upload conversation text to FastAPI; session summaries use confirmed structured records, not secretly retained transcripts. No vector database is required initially; relevant context can be selected from structured records.

## 8. Confirmations and activity flow

Conversation-derived information follows proposed → patient-confirmed → validated and persisted → eligible for report aggregation and configured review rules. Pending information does not silently become a confirmed patient report.

The patient can correct or reject proposals. A statement generated by Gemini is not a patient observation. Assessment answers retain their assessment version; scoring, if included, follows an explicitly approved deterministic definition rather than model interpretation.

Activities follow offered → selected → started → completed or abandoned. Feedback links to the activity session. Reconnecting or replaying a completion request must not count an activity twice.

## 9. Patient-controlled clinician access

Access requires a verified clinician role, an active patient–doctor relationship, an active sharing grant, and a scope that permits the requested resource and time range.

Care-link lifecycle: invitation → acceptance → active relationship → revoked or expired. Accepting a connection and granting sharing are recorded explicitly; knowing a patient identifier cannot establish a relationship.

Initial scopes cover reports and alerts. Raw conversation history and private memory are excluded unless a separate sharing policy is introduced. Apply authorization on every patient-list entry, report read, alert read, and delivery attempt.

Revocation blocks future access and pending delivery. Avoid serving protected data from stale portal caches; clear local displays when loss of access is detected. Previously viewed information cannot be retracted. Report snapshots do not bypass current authorization.

## 10. Reports and alerts

1. An accepted observation or activity change and an outbox event commit in one transaction.
2. A worker claims durable jobs, refreshes affected report projections, and evaluates applicable rule versions.
3. Failures retry with bounded backoff. Exhausted jobs remain visible for operational investigation.
4. Jobs may execute more than once; handlers deduplicate report updates and alerts.
5. The portal polls authorized backend endpoints initially. Server-sent events can be introduced later if latency requirements justify them.

Reports show period, source coverage, missing data, last refresh time, and trends. Begin with deterministic aggregation. Any future AI narrative must be labeled and traceable to its source records. Reports are viewed in-app and in the portal; no PDF generation or export is in scope.

Alert lifecycle: open → acknowledged → resolved, with an audit trail. Delivery state is tracked separately from acknowledgement. A notification does not mean a clinician has read it. Deduplication and suppression rules prevent repeated alerts for the same condition.

An explicit request for help is available directly in the app and does not depend on Gemini successfully invoking a tool. Rule thresholds, review hours, escalation ownership, and expected response times remain product/clinical decisions; the application must not promise emergency monitoring.

## 11. Privacy and retention

- Do not persist raw audio or camera frames by default. Camera sharing is opt-in and can stop independently of the voice session.
- Store only confirmed structured observations and preferences needed for the product. Minimize context sent to Gemini.
- Keep optional transcript/history retention separate from clinician sharing consent.
- Redact operational logs. Do not place transcripts, model context, media, tokens, or resumption handles in ordinary logs.
- Audit clinician access and sensitive changes without duplicating health content unnecessarily.
- Define retention, deletion, backup expiry, deployment regions, and provider data-processing terms before using real patient data. Provider processing and retention are separate from the application's no-media-storage setting.

## 12. Deployment, reliability, and development

The application boundaries are the mobile application, Next.js portal, and unified FastAPI Backend, alongside managed application PostgreSQL and Supabase Auth. API Layer, Application Services, and optional Background Jobs are logical modules within the same Python application; they are not separate servers or microservices. Gemini remains external to the backend media path.

Modal and Vultr are hosting candidates, not a decision to deploy both. Choose after validating connection lifetimes, worker execution, region, operations, and cost. Codex and Entire support development; runtime operation must not depend on them.

Start with a PostgreSQL outbox/job mechanism. Redis, a separate message broker, and separately deployed domain services require a demonstrated need.

| Failure | Required behavior |
| --- | --- |
| Gemini disconnect or token expiry | Stop/clear playback appropriately, show connection state, resume or reconnect when allowed; retain backend progress. |
| Tool timeout | Show a pending or failed outcome, query/retry with the same idempotency key; do not announce success prematurely. |
| Backend unavailable | Keep sensitive mutations unconfirmed; retry safely when connectivity returns. |
| Worker failure | Preserve queued work and retry; show report freshness accurately. |
| Consent revoked during processing | Recheck permission before exposing data or delivering an alert. |
| Voice unavailable | Preserve direct access to activities, existing reports, and help controls when the backend is reachable; text conversation may also depend on Gemini availability. |

Use request/session correlation IDs without health content, bounded database pools, restricted database credentials, managed secrets, and tested backup restoration. Measure bootstrap time, voice response latency, tool latency, job delay, and report freshness before choosing numeric performance targets.

Expo native audio capture/playback, interruption handling, optional camera frames, and Rive must be validated on physical devices using the appropriate development build. Exact phoneme lip synchronization is not assumed; begin with playback-driven speaking animation.

## 13. Decisions still open

| Decision | What resolves it |
| --- | --- |
| Modal versus Vultr; portal host | Hosting evaluation and operational ownership. |
| Gemini Live model and API version | Verified capabilities, ephemeral-token restrictions, device validation, and availability. |
| Clinician verification and onboarding | Trusted provisioning and responsible operational owner. |
| Assessment definitions and alert thresholds | Approved product/clinical rules, evidence, and rule ownership. |
| Retention, regions, deletion, provider terms | Privacy requirements and provider review. |
| Notification channels and response expectations | Product workflow and clinician operating model. |
| Performance targets | Measurements on representative devices and networks. |

## 14. Architecture acceptance criteria

- A patient cannot read or modify another patient's records by changing an identifier.
- A clinician loses future access when the sharing grant is revoked.
- Gemini and the activity cards refer to the same backend-generated activity IDs.
- A repeated tool call or worker job does not duplicate an observation, completion, or alert.
- Unconfirmed conversational interpretations do not enter confirmed report data.
- Application progress survives a Gemini reconnect.
- Reports disclose stale or incomplete data.
- Raw audio/video are absent from default storage and operational logs.
- The patient can request help through a direct application control.

These are future implementation validation requirements, not tests already performed.

## 15. Platform references

- [Gemini Live overview](https://aistudio.google.com/docs/live-api) — direct multimodal conversation capabilities.
- [Gemini ephemeral tokens](https://aistudio.google.com/docs/live-api/ephemeral-tokens) — backend provisioning for direct client connections.
- [Gemini Live tools](https://aistudio.google.com/docs/live-api/tools) — client handling of tool calls and responses.
- [Gemini session management](https://aistudio.google.com/docs/live-api/session-management) — connection lifecycle and resumption.
- [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts) — identity token verification and signing keys.

The HTML is a proposed system overview. The API Layer, Application Services, and optional Background Jobs are grouped in one FastAPI Backend container. Detailed service responsibilities remain logical modules inside Application Services. The mobile runtime frame nests the function-calling/UI bridge inside the Patient App. Individual module-to-database arrows are consolidated; Gemini Session Bootstrap is a responsibility inside the API Layer, not a separate diagram component or deployment. Documentation source: this specification and the supplied requirements, not implemented application code.

## 16. Diagram refinement: mobile bridge and unified backend

The existing dark Classic viewer, neon semantic colors, dotted grid, typography, Live/Still animation, and diagram export controls are retained. Diagram export is a documentation viewer feature; patient report PDF generation, file exports, and downloads remain out of scope. External component positions and connections are retained. Former backend components are nested inside a single FastAPI Backend container; internal service detail is consolidated to simplify the overview.

### Detailed application-service responsibilities

| Group | Modules | Ownership |
| --- | --- | --- |
| A. Conversation & Patient Context | Conversation Controller; Patient Context & Memory; Observation Service | Guided questions, known/missing information, policies, sessions, recovery plans, preferences, history, and explicitly patient-reported observations. |
| B. Activities & Personalization | Recommendation Engine; Activity Service | Eligibility, ranking, activity catalog, configurations, activity sessions, and feedback. |
| C. Reports & Monitoring | Report Service; Alert Engine | Structured reports and trends, predefined review conditions, and clinician notifications. |
| D. Care & Permissions | Care Link Service; Consent Service | Patient–doctor relationships, report-sharing scope, access checks, and revocation. |

These responsibility groups document the internals of Application Services; they are not additional containers in the diagram. Care Link and Consent remain separate responsibilities, even when their operations participate in one use case.

### Gemini Function Calling / UI Bridge

This component executes inside the React Native application. It receives Gemini function calls, forwards privileged requests over authenticated HTTPS, updates UI state from structured results, displays activity cards during speech, returns function responses, synchronizes voice/touch selection, and triggers local animations. Local presentation changes do not require backend calls; activity acceptance and persisted progress do.

1. The patient speaks to Gemini Live.
2. Gemini invokes `present_activity_recommendations`.
3. The bridge sends an authenticated recommendation request to FastAPI.
4. The Recommendation Engine retrieves eligible catalog activities and ranks them.
5. FastAPI returns `recommendation_id` and structured activity data, including stable backend-generated activity IDs.
6. The bridge updates React Native state and displays the cards.
7. After applying the UI update, the bridge sends those same recommendations as the Gemini function response.
8. Gemini introduces the displayed activities verbally.
9. The patient chooses by touch or voice; both paths resolve the same activity ID within the current `recommendation_id`.
10. FastAPI rechecks ownership, recommendation validity, eligibility, and idempotency, then records an activity session.
11. The app executes the activity and animation locally; Gemini can continue guiding the patient.

Do not allow a verbal selection from an old batch to silently select a different visible card. Serialize or version competing UI updates and reject stale selections. The function response is sent after the corresponding UI state is applied; interruption or failure must not produce a false statement that cards are displayed or an activity is saved.

### Shared reports and access paths

- **Patient App → FastAPI → Report Service:** an authenticated patient can always view their own available reports independently of clinician-sharing consent.
- **Doctor Portal → FastAPI → Consent Check → Report Service:** require verified clinician role, active patient link, and active sharing consent at the time of access.

Both use the same report data and service. The API Layer and Application Services enforce patient ownership or doctor link plus consent; it does not ask patients to grant clinician-sharing consent to read their own records. Reports include structured observations, activity history, relevant assessments, longitudinal trends, provenance, and freshness. They render directly in both interfaces. No frontend connects directly to the database.

### Background processing boundary

**Application Services → PostgreSQL Outbox → optional Background Jobs → PostgreSQL.** The outbox lives within the existing database. Safe job claiming, bounded retries, and idempotent handlers support asynchronous aggregation and alerts. Background Jobs are logical modules inside the same Python application and do not block the synchronous recommendation, live credential, or activity selection path. No separate worker server is implied.

### Connection visual language

| Path | Diagram treatment |
| --- | --- |
| Direct audio/text/optional-frame streaming | Thick teal emphasis arrows, labeled WSS. |
| Gemini function requests and responses | Thin teal arrows to/from the nested bridge, explicitly labeled. |
| Authenticated business API and UI responses | Solid neutral arrows, labeled HTTPS/JWT, actions, or structured results. |
| Identity, credentials, and consent gates | Pink security arrows. |
| Durable background jobs | Purple dashed arrows between PostgreSQL and optional Background Jobs inside FastAPI Backend. |

The same application database contains the outbox; it is not an added datastore. Gemini Session Bootstrap is shown inside the API Layer. It obtains short-lived Gemini Live credentials through the provider API; there is no separate credential-service component or deployment.

## 17. Unified FastAPI Backend container

The diagram presents one **FastAPI Backend** container with three logical layers:

| Layer | Responsibilities |
| --- | --- |
| API Layer | Authentication, authorization, API routes, and Gemini session bootstrap. |
| Application Services | Conversation Controller, Patient Memory, Activity Recommendations, Observations, Reports, Consent, and Alerts. Activity lifecycle and patient–doctor relationships remain responsibilities within these services. |
| Background Jobs (optional) | Asynchronous report processing and notifications, using durable job claiming, retries, and idempotency when needed. |

These modules belong to the same Python application. Their internal arrows denote application calls and data flow, not separate servers, independently deployed microservices, or network hops. The diagram preserves direct Gemini media streaming, the mobile UI bridge, Supabase authentication, client HTTPS access, Gemini credential provisioning, PostgreSQL persistence, and durable job processing.

No separate worker server is prescribed. If asynchronous work is enabled, its execution and lifecycle must preserve durable claiming and retry behavior; process topology can be decided at implementation time without changing these logical boundaries.

## 18. Compact diagram refinement

- **Gemini Session Bootstrap** appears inside the API Layer. It creates an application session and obtains restricted, short-lived Gemini Live credentials through the Gemini provider API, then returns the ephemeral token to the authenticated patient app. The provider issues the credential; Supabase Auth remains responsible only for identity JWTs. No separate credential server is introduced.
- **Gemini Function Calling / UI Bridge** explicitly owns Tool Calls, Activity Cards, Voice/Touch Selection, and UI State inside the patient app.
- The bridge retrieves activity recommendations from FastAPI, displays interactive cards, and returns the identical backend-generated activity IDs to Gemini as the tool response. Gemini then presents those displayed activities verbally. Voice and touch both resolve the same current recommendation and activity IDs; API routes also continue to handle selections, progress, feedback, observations and other authorized tools.
- **Tiger Data / PostgreSQL** is directly below Application Services, outside the application container. Optional Background Jobs remain inside FastAPI Backend, nearby, with durable outbox claiming and idempotent results.
- External credential-service arrows are removed because bootstrap is an API-layer responsibility. Direct Gemini streaming, tool responses, identity/JWT verification, patient and clinician API access, persistence and background job flows remain.

The existing dark neon appearance, dotted field, rounded cards, viewer modes and export controls are preserved.

## 19. Conversation persistence and report generation

### Conversation history and session summaries

**Gemini Live → Mobile Tool Bridge (transcription events) → FastAPI → Conversation Service → PostgreSQL.**

Enable supported input/output audio transcription in the Gemini session configuration. The bridge handles transcription events separately from function calls and media playback. Each upload carries an authenticated patient/session association, application event ID, speaker role, provider event/turn reference when available, sequence information and event time. Do not treat every partial transcript fragment as a finalized utterance; reconcile updates and deduplicate retries before retaining turns. Gemini reconnection must not duplicate history or merge different speakers.

**Transcript retention is opt-in.** Without an active transcript-storage grant, the bridge does not send conversation text to the backend, and FastAPI rejects attempts to retain it. Transient on-device/provider processing is distinct from retained application history. Check consent at ingestion, including during a session; revocation stops future uploads and writes. Handle prior retained text according to the patient's deletion choices and the defined retention policy. Provider processing terms remain a separate decision.

Conversation Service stores consented patient/assistant turns as history and creates source-linked session summaries. Summaries distinguish patient statements, assistant content, confirmed facts and missing data. A generated summary is derived content, not a new confirmed clinical observation. When transcript storage is off, summaries are built only from confirmed observations, assessment responses, and activity/feedback records. Do not reconstruct a hidden transcript in a summary or operational log.

### Observation Extraction and patient corrections

**Consented patient statements or explicit structured answers → Observation Extraction → pending observation → patient confirmation/correction → Observation Service → PostgreSQL.**

Extraction produces candidate facts with a type, patient-reported value, relevant time, source references and confirmation state. It must not infer a diagnosis, treat assistant speech as patient testimony, or substitute apparent emotion for an explicit report. Direct structured check-ins and assessment answers remain available without transcript storage.

Patients can accept, edit, reject and later correct observations through authenticated controls. Persist correction lineage and the revised fact's provenance. Preserve the original source record, record who corrected it and when, and mark superseded observations so trends do not double-count both versions. Recompute affected reports and related rule results after accepted corrections.

Source references identify stable record IDs and revisions: session ID; consented transcript/turn ID where retained; explicit patient confirmation or correction event; activity-session/completion ID; feedback ID; assessment definition version and response ID. If a transcript is not retained, reference the structured confirmation record instead of storing transcript quotations. Source access follows current authorization; never expose a private transcript through a report reference. If a source is deleted, keep only the permitted provenance marker and mark its availability honestly.

### Records used for reports

| Persisted record | Authoritative producer | Report treatment |
| --- | --- | --- |
| Opt-in history and session summaries | Conversation Service | Provenance and contextual material; derived summaries do not silently become confirmed facts. |
| Confirmed structured observations and corrections | Observation Service after extraction or explicit patient input | Current confirmed version, relevant time and source references. |
| Completed activities | Activity Service | Accepted completion records; distinguish offered, started, abandoned and completed activities. |
| Activity feedback | Activity Service | Patient feedback linked to its activity session, without filling missing ratings. |
| Assessments and responses | Observation/assessment application logic | Preserve instrument version, answers, completion status and any approved deterministic scoring. |
| Report metadata and structured report snapshots | Report Service | Report version, source versions, time range, generation time, freshness and completeness. |

All these records live in the existing Tiger Data / PostgreSQL database. No new datastore or microservice is introduced.

### Report Service and structured JSON

**PostgreSQL → Report Service → FastAPI → Patient App / authorized Doctor Portal.**

Report Service reads an authorized patient record set and calculates factual trends: reported mood or energy over a defined period, sleep observations with compatible units, completed activity counts, feedback history and comparable assessment results. Missing answers remain missing; account for coverage, time zone, instrument versions and corrections. Factual changes are not relapse predictions or independent diagnoses.

The structured JSON report includes these conceptual fields (not a physical schema):

| Field group | Content |
| --- | --- |
| Identity and version | Report ID, patient ID, report version and calculation-rule version. |
| Period and freshness | Period start/end, patient time zone, generated time, data cutoff and refresh status. |
| Structured sections | Confirmed observations, activity history, feedback and relevant assessments. |
| Trends | Metric, period, values, units, denominators/coverage, comparison rules and missing-data indicators. |
| Provenance | Source record IDs/revisions and summary references; source text only when separately authorized. |
| Quality | Incomplete periods, unavailable sources, corrections and limitations. |

Report snapshots can be refreshed through optional Background Jobs using the existing outbox. The Report Service remains responsible for aggregation and JSON shaping, regardless of execution mode. Accepted corrections invalidate or refresh affected projections; the API shows freshness/version honestly.

Both clients render the same structured JSON report representation through FastAPI. The patient reads their own available reports. A clinician needs a verified role, active patient relationship and active sharing consent on every request. A report-sharing grant does not automatically share conversation history; the backend filters or authorizes source references accordingly. Raw audio/video are not stored by default. No PDF generation or report file export is introduced.

Platform reference: [Gemini Live capabilities — audio transcription](https://aistudio.google.com/docs/live-api/capabilities). Select and verify the exact model/API transcription settings before implementation.

## 20. Unified Application Services and explicit report authorization

There is one **Application Services** container inside the existing unified FastAPI Backend. It contains the existing patient-context/activity responsibilities plus **Conversation Service**, **Observation Extraction**, **Care Link & Consent Check**, and **Report Service**. These are logical Python modules; no independent server or microservice is introduced. The previous duplicate application-services header is represented as Patient Context & Activities so its existing functionality remains inside the same container.

### Conversation persistence and facts

**Gemini Live transcription events → Mobile UI Bridge → authenticated FastAPI → Conversation Service → PostgreSQL.** Conversation Service stores only consented transcripts and source-linked session summaries. Without transcript opt-in, conversation text is not uploaded or retained, and summaries use confirmed structured records. Observation Extraction proposes structured, source-linked patient-reported facts; only confirmed or patient-corrected versions enter factual reporting. Preserve source IDs, revisions, confirmation records and correction lineage. Raw audio/video remain unstored by default.

### Doctor report request and return paths

**Doctor Portal → FastAPI → Care Link & Consent Check → Report Service → PostgreSQL.**

1. FastAPI verifies identity and the trusted clinician role.
2. Care Link & Consent Check validates the active patient–doctor relationship, current patient authorization, scope, expiry and revocation state.
3. Only an authorized patient/report scope reaches Report Service; caller-supplied patient IDs cannot bypass the check.
4. Report Service queries PostgreSQL for the scoped confirmed observations, activity feedback/history and assessments, with their source references and revisions.
5. It computes factual trends and shapes the viewable structured JSON report. Records return from PostgreSQL to Report Service, and JSON returns through FastAPI to the authorized portal.

An owning patient follows the same FastAPI access-check entry, which permits ownership without requiring clinician-sharing consent. Clinician requests pass the active-link and sharing-grant branch before reaching Report Service. Report sharing never implicitly exposes private conversation transcripts or unrestricted source text. Apply current authorization before returning the response and on every subsequent read; no client talks directly to PostgreSQL. Optional jobs do not bypass these access checks. No PDF generation or report file export is added.
