# RE:SONANCE — Pre-implementation architecture review

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

## Conclusion

The package is ready for a contract-first kickoff and isolated capability spikes. It is not a running MVP, a validated clinical system, or authorization to use real patient data. Four developers can begin independent controller/UI/API/report work against shared contracts, while G0 resolves native/provider compatibility and actual PostgreSQL execution. No application code, dependency installation, migration execution, deployment or external notification was performed.

## Repository inspection and existing work

| Evidence | Finding | Consequence |
| --- | --- | --- |
| docs/architecture.md and architecture.html/source/delivery metadata | Existing proposed modular monolith and refined dark neon overview; history/confirmed facts/consent/report flows already defined. | Reused as baseline, archived before authorized V1 revision; uppercase ARCHITECTURE.md adds implementation contracts rather than overwriting the overview. |
| docs/design/code.html:1094 and following script | Browser-only interactive prototype with local state/fictional content. | Reuse journeys, spacing and control concepts; not a native app, authenticated portal or persistence implementation. |
| docs/design/code.html:1464 | Alert claims notes synchronized with doctor. | Important: simulation only. Future UI must wait for accepted backend result and mark mock mode. |
| docs/design/code.html:397; docs/design/DESIGN.md:127–143,179 | Clinical-grade/neuroplastic/biofeedback claims are design prose, not measured or supported capabilities. | Important: do not copy these claims into MVP product behavior/copy. Existing files preserved. |
| docs/design/screen.png | Visual reference with RE companion, patient/doctor demo toggles and local orb. | Not a Rive asset or proof of login, media, medical efficacy or responsive native behavior. |
| Root/config inspection | No product package.json, pyproject.toml, Expo native projects, backend, Next.js project, .riv file, provider setup or migration history. | Do not claim existing functionality; start with explicit toolchain and asset spikes after this turn. |
| git status before planning | Prior design/ files are deleted; .agents/, docs/ and skills-lock.json are untracked. | Preserve all existing edits/deletions and unrelated skills-lock content. No cleanup/reset/commit performed. |
| docs/architecture.md vs docs/ARCHITECTURE.md | Requested filename differs only by case. | Important portability risk: case-sensitive checkout required until team approves a non-destructive archive rename. |

All seven existing architecture/design reference files have baseline hashes in planning-validation/baseline.json. Existing HTML viewer export is a documentation feature, not a patient PDF feature. The fresh planning diagrams are Mermaid component/deployment/ERD and twelve sequence diagrams, with the existing interactive overview updated for V1.

## Skills checked and applied

Reviewed available skill catalog and actual local instructions for python-backend-expert, supabase, supabase-postgres-best-practices (including PK/FK/index/privilege rules), expo-overview, expo-project-structure and expo-dev-client, backend-testing and archify. Expo router was loaded before native guidance. Python skill's linked architecture reference file is absent in the current checkout; used the available SKILL.md rules and existing repo evidence instead of pretending the missing reference was read. No skill installation/update was attempted.

Applied: inward backend dependencies/UoW, async session isolation, current identity/consent checks, explicit Postgres ownership constraints and indexed FKs, native development-build validation, real PostgreSQL concurrency tests and mock/live distinction. No UI implementation, scaffold, Expo command, schema migration or dependency command was run; the user's planning-only constraint takes precedence over setup recipes. No sub-agents were used; the four workstreams describe future human development ownership.

## Decisions and assumptions ledger

| ID | Status | Decision / trade-off |
| --- | --- | --- |
| D01 | Confirmed by brief/prior docs | Unified FastAPI modular monolith, direct mobile ElevenAgents voice / separate text, one PostgreSQL application database and Supabase Auth. |
| D02 | Confirmed | Same backend recommendation/activity IDs in UI, spoken tool response and selection; ElevenLabs does not choose eligibility or persistence. |
| D03 | Confirmed | Opt-in transcripts, structured patient facts, source references/corrections, factual JSON reports, active patient-controlled doctor authorization, no default raw media/PDF. |
| D04 | Proposed MVP contract | Six model tools; direct patient UI confirms facts/memory/sharing and confirms model-proposed review requests. |
| D05 | Proposed compatibility policy | Separate textOnly WebSocket connection shares application context; no microphone capture or playback. Actual SDK/device behavior needs G0 validation. |
| D06 | Proposed implementation stack | Typed FastAPI boundaries, Python domain ports, SQLAlchemy async/UoW, PostgreSQL 16+ baseline; final language/package pins after compatibility spike. |
| D07 | Proposed storage trade-off | UUIDv4 for exposed request/record IDs at small demo volume; no extra UUID/Timescale/vector extension. JSON limited to bounded domain state/config; composite ownership FKs and source junctions. |
| D08 | Proposed workflow | Patient invites a known verified fictional clinician ID; target accepts; sharing requires separate grant. No external email/invite delivery. |
| D09 | Proposed demo limits | English/adult fictional personas; nonclinical assessment only; patient_requested_review is the only enabled alert rule; no emergency monitoring. |
| D10 | Proposed defaults, not measurements | Up to 3 recommendations, 10-minute batch validity, 30-minute idle session cleanup, 90-day max report period, 24h transcript/idempotency cleanup, fictional-data purge within 7 days after judging. All configurable and require tests/cleanup jobs, not clinical or legal rules. |
| D11 | Proposed deployment | Single initial backend process with supervised optional job module or scheduled same-application entrypoint; provider/region and portal hosting remain open. |
| D12 | Contract authority | OpenAPI defines HTTP fields; tools derive from the same schema definitions; SQL maps those fields explicitly. Changed shape needs coordinated review. Prior overview is archived; current overview reflects V1. |

## Verified platform capability versus untested integration

Checked official sources on 14 November 2026:

| Capability | Evidence | Limit / remaining check |
| --- | --- | --- |
| Voice/text SDK and tools | [React Native SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react-native), [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react) | Development-build support documented; actual published pins/device audio/textOnly and blocking tools untested. |
| Provider privacy | [Audio saving](https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving), [retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention) | Audio saving defaults on; transcript retention is separate. Actual saved account policy unverified; zero-day scheduled deletion does not establish ZRM. |
| JWT verification | [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts) and [changelog](https://supabase.com/changelog.md) | JWKS/claims verified by backend; application role/consent freshness is separate. No auth project configured here. |
| Native Expo build | [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) | No SDK pinned or app created. Native SDK/LiveKit compatibility is unresolved; Expo Go is not proof of native integration. |
| Rive runtime | [Rive React Native](https://rive.app/docs/runtimes/react-native/react-native) | Current docs recommend @rive-app/react-native over legacy runtime; exact Expo/RN/Nitro/asset bindings must be pinned/tested. No .riv asset exists. |
| PostgreSQL baseline | [PostgreSQL 16 constraints](https://www.postgresql.org/docs/16/ddl-constraints.html) | DDL authored/static-reviewed only; PostgreSQL binaries and live DB validation unavailable here. |

The HTTP artifact also passes the [official OpenAPI 3.1 structural metaschema](https://spec.openapis.org/oas/3.1/schema/2022-10-07); individual canonical schemas are separately checked as JSON Schema 2020-12. This does not validate provider tool-schema adaptation or implementation behavior.

No exact provider model ID, SDK version or native capture package is asserted compatible merely because it appears in an example. Verify quota/account availability and pinned configuration before the first live demo claim.

## Requirement ownership and coverage

| Requirement | Component owner | Contract / data | Tests |
| --- | --- | --- | --- |
| R01 | D2 UI, D3 identity | onboardPatient/getMe/updateProfile; users/profiles | T-AUTH-02, T-MOBILE-01 |
| R02 | D1 adapter, D2 UI | createConversation/createAgentConnection/updateConversation; WebRTC voice / textOnly WSS | T-MOBILE-01, G0 |
| R03 | D1 controller, D3 context | getPatientContext/getGuidedQuestion/submitGuidedAnswer/skipGuidedQuestion/upsertMemory; sessions/memories/plans | T-GUIDE-01 |
| R04 | D1 tools, D2 bridge, D3 recommender | createRecommendation/startActivity/dispatchTool; recommendations/items | T-TOOL-01, T-ACT-01 |
| R05 | D2 local activities, D3 catalog | listActivities; immutable versioned catalog | T-ACT-02 |
| R06 | D2 activity UI, D3 lifecycle | recordActivityEvent/submitFeedback; sessions/events/feedback | T-ACT-01/02, T-DATA-02 |
| R07 | D1 history/summaries, D3 storage | ingestMessages/listMessages/getSummary; messages/summaries/sources | T-HISTORY-01/02 |
| R08 | D1 extraction, D2 confirmation, D3 observations | create/confirm/correctObservation; observations/source junctions | T-OBS-01, T-DATA-02 |
| R09 | D3 validation, D2 form | listAssessments/submitAssessment; definitions/responses | T-REPORT-01, T-MOBILE-01 |
| R10 | D4 reports, D2 own-report UI | requestReport/getReport/getDoctorReport; reports/report_sources | T-REPORT-01/02 |
| R11 | D3 care/consent, D2 controls | inviteClinician/updateCareLink/grantConsent/revokeConsent | T-CONSENT-01/02 |
| R12 | D4 portal/alerts | listDoctorPatients/listDoctorAlerts/updateDoctorAlert/requestReview | T-PORTAL-01/02 |
| R13 | All; D3 policy | private schema/current auth/retention/outbox/audit | T-PRIVACY-01, T-AUTH-01 |
| R14 | D1/D2 transport, D3/D4 persistence | versions, idempotency, event IDs, outbox leases | T-DATA-02, T-HISTORY-01 |
| R15 | D2 UI, D4 portal | canonical pending/error/empty/stale states | T-MOBILE-02, T-PORTAL-01 |
| R16 | All; D4 review workflow | requestReview; disabled clinical rules | T-DEMO-01, T-TOOL-02 |

## High-risk integrations and mitigation

1. **Native media + Live + Rive:** no implementation exists; prove a physical-device loop and capture version evidence before spending effort on polish. Keep adapter/UI interfaces separable.
2. **Transcript privacy + extraction:** partial events, revoked grants and non-history summaries can accidentally retain text. Atomic ingestion/current consent, no hidden transcripts and explicit confirmation tests are release gates.
3. **Authorization races and source leakage:** enforce owner/verified-role/link/scope/current grant on every read/replay; private source IDs never allow text retrieval. Serialize critical authorization transitions and state in a transaction, without claiming recall of in-flight/viewed data.
4. **Shared contract drift:** 49 operations and six tools share 82 schema definitions; machine artifacts are field authority. Proposed SQL maps response IDs, sources and periods; generated inventories and consistency checks detect missing refs/endpoints/ownership links.
5. **Report accuracy:** deterministic golden fixtures; current confirmed heads, completion state, feedback and assessment versions only. Show missing/stale/partial status and preserve source revisions.
6. **Job/process failures:** no fire-and-forget durability; transactional outbox, safe claim, fenced lease, retry/dedup and observable failed state.
7. **Prior design claims/mock success:** do not copy unsupported physiological language or local alerts as real sync. Preserve visual references while labeling simulation honestly.
8. **Case-only architecture filenames:** resolve portability with a reviewed archival rename before a case-insensitive checkout; no destructive rename was assumed here.

## Open decisions / missing requirements

| Question | Owner / gate | Impact |
| --- | --- | --- |
| Chosen Expo SDK/RN/Rive/Nitro/audio adapter and licensed .riv/content assets? | D1/D2, G0 | Native build and voice/avatar compatibility. |
| Exact ElevenLabs model/API, supported tools/transcription schema, account/quota and region? | D1, G0 | Voice/text SDK behavior, local-preview isolation and credential restrictions. |
| Modal vs Vultr, portal host, backend job lifecycle and DB region/version? | D3/D4, G0/G1 | Supervision, deployment and connection limits. |
| Hackathon duration, target devices/platforms and acceptance demo constraints? | Team, kickoff | Schedule/feature breadth; milestones are given instead of invented hours. |
| Approved clinical instruments, alert thresholds and clinician response owner/hours? | Product/clinical owner, future real use | Remain disabled except explicit review request in fictional demo. |
| Real-data retention/deletion/backups, jurisdiction, processor terms and consent wording? | Product/security owner, before real data | No real patient operation permitted by this plan. |
| Case-insensitive filename portability and reference archive policy? | Team, kickoff | Prevent accidental overwrite of existing overview. |
| Avatar customizations beyond two colors/one accessory and other languages? | D2/product, future | Explicitly limited MVP, not inferred requirements. |

## Readiness checklist

- [x] Existing docs/design inspected and preserved; implemented versus mock/planned behavior identified.
- [x] Product requirements mapped to modules, endpoints, data and tests.
- [x] HTTP/tool/schema artifacts and concrete four-developer ownership documented.
- [x] Conversation history opt-in, partial sessions, source correction and clinician authorization specified.
- [x] Component/deployment/ERD plus eleven user sequence diagrams included.
- [x] No application code, scaffolding, dependencies, service deployment or database changes performed.
- [x] OpenAPI structural validation against the official 3.1 metaschema plus canonical JSON Schema/reference checks completed with installed tooling.
- [ ] Mermaid diagrams rendered and application/provider schema adapters validated with pinned runtime tooling.
- [ ] schema.sql executed and migration/concurrency/privilege tests run in disposable PostgreSQL.
- [ ] Native physical-device/ElevenLabs/Rive compatibility matrix and credentials configured.
- [ ] All application/test-plan acceptance tests implemented and passed.
- [ ] Clinical/privacy/operational readiness for real patient data (out of MVP scope).

Automated planning checks and their exact limits are in planning-validation/consistency.json. Official OpenAPI structural metaschema validation, YAML/JSON parsing, reference/FK declaration checks and illustrative schema validation are not a running API test, a live migration test or provider/device validation.

## First vertical slice and next coding tasks

Prioritize G0 capability spikes and disposable SQL execution, then the G2 path: fictional patient login → Live guided fact → backend recommendations → exact cards/spoken IDs → breathing complete/rating → confirmed observation → own factual JSON report → active patient grant → verified clinician view → revoke denies future view. This exercises the integration seams before secondary activities/polish.

First coding tasks are assigned in IMPLEMENTATION_PLAN.md. Stop here: the deliverable is the reviewed planning package. Application implementation begins only in a subsequent authorized task.

## Phased rollout review — supersedes earlier provider assumptions

V1 is ElevenLabsAdapter through VoiceAgentAdapter; GeminiLiveAdapter is future V2 only, never a launch dependency. Camera preview remains on-device with independent permissions/lifecycle. Current contracts define 49 operations, 82 schemas, six tools and 32 tables. The earlier architecture overview/source/HTML are archived under archive/before-elevenlabs-*; design reference files are unchanged. The original baseline is historical evidence, not a claim that authorized overview changes never occurred.

| Requirement | Coverage / acceptance |
| --- | --- |
| R17 | FRONTEND_SPEC, local camera isolation and exact disclosure; T-CAMERA-01, T-CAMERA-02, T-CAMERA-03. |
| R18 | VoiceAgentAdapter manifest, ElevenLabsAdapter planning and future Gemini; T-ADAPTER-01. |
| R19 | PROVIDER_VERIFICATION, actual SDK/build and account retention gates; T-ELEVEN-01, T-PROVIDER-PRIVACY-01. |
| R20 | Separate textOnly connection with shared application context; T-TEXT-01, T-JOURNEY-01. |

Official SDK documentation supports Expo development builds and blocking client tools. The candidate Expo 57/RN 0.86.2 matrix follows the official example; published SDK pin and device builds remain unverified. No connected agent/account is available: actual saved audio/transcript retention, ZRM eligibility and deletion behavior are unverified and block credential bootstrap. Documentation checks cannot pass these runtime gates. No application adapter has been implemented in this planning-only revision.
