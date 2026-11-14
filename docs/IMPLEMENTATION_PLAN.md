# RE:SONANCE — Four-developer implementation plan

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

## Contract-first handoff

No application directories or scaffolding exist yet. Paths below are proposed ownership boundaries, not files created by this package. Freeze OpenAPI/tool/schema v2.0.0 together after review. Developers work independently against the same DTOs and fictional fixtures; no teammate invents additional fields or model tool names. Developer 3 coordinates contract changes through reviewed PRs. Changes to a public DTO require updating HTTP/tool/schema mappings and affected tests before merge.

| Developer | Own proposed files/modules | Dependencies and interfaces | Definition of done |
| --- | --- | --- | --- |
| 1 — ElevenLabs + Controller | mobile/src/integrations/voice/{VoiceAgentAdapter,ElevenLabsAdapter}/** (provider adapter only); backend/app/conversation/{controller,policies,extraction,summary} modules; live capability spike notes. | Developer 2's UI reducer/bridge event interface; Developer 3's session/context/source repository ports; tool_contracts.json and ConversationSession/AgentConnectionBootstrap/ToolResult DTOs. | Device/provider matrix recorded; voice and typed modes, transcription reconciliation, allowlisted tools and interruption/reconnect pass; guided state/summary/extraction never assert unconfirmed facts. |
| 2 — Patient app + Rive + activities | mobile/src/app/** (route files only); mobile/src/features/{conversation,activities,reports,profile,consent}/**; mobile/src/components/**; mobile/assets/** including licensed .riv. | Developer 1’s adapter events; Developer 3’s generated/typed API client interface; same Recommendation/ActivitySession/Observation/Report DTOs as portal. | Login, accessible UI, avatar settings, exact cards, voice/touch selection, local five activity renderers, confirmation/correction, feedback/report/sharing/error paths work on target device. |
| 3 — FastAPI + PostgreSQL + auth + recommendations | backend/app/{api/patient,auth,activities,context,care,infra,composition}/**; backend/migrations/**; contracts/** and database/** coordination. | Reviewed SQL baseline; Supabase and Tiger Data credentials supplied outside source; Developer 1/4 application-service ports. | Real PostgreSQL migrations and constraints tested, identity/role/scopes enforced, deterministic recommendation and activity lifecycle idempotent, shared error/version/idempotency behavior passes contract tests. |
| 4 — Doctor portal + reports + alerts | portal/**; backend/app/{reporting,alerts,jobs}/**; backend/app/api/doctor module. | Developer 3’s authorization/UoW/repository ports; same Report/Alert DTOs and consent semantics; sources from Developer 1/2 flows. | Factual JSON golden fixtures pass, pending/stale/refresh visible, authorized portal reads/acknowledgement work and revoke access, safe outbox retries tested. |

For the proposed new Expo project, src/app is routes-only; screen bodies and non-route features stay in sibling src/screens or src/features modules. No Expo +api routes are planned because FastAPI owns backend endpoints.

No overlapping files: Developer 1 owns provider/conversation logic, not mobile screen/bridge rendering. Developer 2 owns bridge/UI orchestration, not provider transport. Developer 3 owns persistence adapters for all modules and the composition root; Developer 4 owns report/alert domain use cases, not global auth policy. Interfaces/fixtures are reviewed jointly before adapters are wired. A module owner can review another owner's adapter but does not silently edit shared contracts.

## Implementation order within each stream

D1: verify ElevenAgents private agent/privacy and chosen RN SDK → VoiceAgentAdapter/ElevenLabsAdapter for audio-only WebRTC and separate text WebSocket with neutral event interface → deterministic three-question controller → tool dispatch mapping → interruption/resumption → consented summaries/extraction. Test with canned provider events before device integration; actual live capability spike is a separate labeled network check.

D2: prove candidate Expo SDK 57 development build with ElevenLabs/LiveKit and Rive peers → independent local camera preview controller/disclosure → navigation and profile/auth shell → conversation UI with fake adapter explicitly labeled → recommendation reducer/cards → breathing renderer → confirmation/feedback/report/consent → other four minimal activities → recovery/accessibility checks. Do not use existing prototype role buttons as auth.

D3: execute schema in disposable PostgreSQL → staged migrations and UoW/auth → getMe/onboarding/session/bootstrap → activity catalog/recommendation/start/event/feedback → observations/context/guided answers/skip → care/consent → persistence/idempotency/outbox adapters → harden races and contract tests. All provider keys remain server-side.

D4: build Report/Alert golden fixtures and deterministic calculations → report use cases/job handler ports → Next.js authenticated shell and same JSON renderer → linked patient access/denial → explicit review visibility/acknowledgement → stale/correction/revocation recovery. No chart fabricates absent data.

## Integration checkpoints

| Gate | Exit evidence | Parallel work allowed |
| --- | --- | --- |
| G0 — contracts and risky native/provider seams | Review this package; candidate SDK 57 device exchanges ElevenLabs voice, shows Rive/local preview with zero video transport, runs blocking client tools and textOnly mode; actual saved retention policy verified; exact versions/model/quota recorded. Disposable SQL baseline execution passes. | UI/report fixtures and controller/unit rules can be built against contracts while spikes run. |
| G1 — first data loop | Supabase fictional patient → real API → real PG → getMe/context/session. Provider credential is transient; unknown provider expiry is not asserted; no roles selected by client. | Portal against same contract fixtures; activity UI uses catalog fixture. |
| G2 — first demonstrable vertical slice | ElevenAgents recommendation → exact visible/spoken IDs → breathing start/complete/rating → immediate My Journey item → confirmed observation → factual own JSON report → active grant → verified doctor view → revoke denies read. | Secondary activity designs and summaries do not block this slice. |
| G3 — MVP breadth and recovery | Typed mode, all five activities, avatar customization, transcript opt-in, partial history, correction refresh, assessment and review alert pass. | Device regression and portal permission matrix in parallel. |
| G4 — demo freeze | No unlabeled mocks, no raw media/log leakage, deterministic fixtures, stop/help controls, failure scenario and restore/reset rehearsal. | No new contract fields after freeze without rerunning relevant checks. |

Use integration branches/PRs; preserve existing work. G2 requires a configured report-processing mode: the proposed MVP uses a supervised same-application job loop, or the chosen host’s scheduled entrypoint into that module. Do not ship a permanently pending report request because jobs are labeled optional.

No durations or deadline assumptions are invented because hackathon schedule and device availability were not supplied. Reprioritize by gate outcome, not by polishing disconnected screens.

## Required interface boundaries

Provider adapter emits typed audio/transcript/turn/tool/interruption/connection events and accepts text/context/microphone controls and resolves client tools through the SDK; no V1 frame or video input. Bridge exposes applied current recommendation ID and accepted activity-session ID to the UI. Controller reads repository ports and returns GuidedQuestion/proposal/context; it does not call React Native. Auth/consent port returns authorized patient/resource/period scope, not a boolean that downstream code can misuse for another patient. Report Service consumes immutable accepted record projections and returns canonical Report JSON; jobs call the same use cases, not separate business logic.

Generate clients/types from OpenAPI only after tooling is chosen and pinned. Agree transient adapter event types in a reviewed contract addition before coding them; these are not HTTP fields. Build mock fixtures from canonical schemas and mark them in UI, never claim simulator data is a real provider conversation.

## Recommended first coding tasks (after this planning-only turn)

1. D1 + D2 jointly prove the highest-risk physical-device seam: tested Expo/Rive/ElevenLabs audio configuration and a blocking present_activity_recommendations client-tool callback, audio-only outgoing tracks with preview active, and genuine textOnly mode. D3 simultaneously runs SQL/migration tests; D4 writes factual report fixtures.
2. D3 implements authenticated identity/session and the minimal activity/observation/report persistence loop; D1 wires the real allowlisted tool path and controller to it.
3. D2 renders exact backend options and a local breathing activity. D4 completes the same JSON report renderer plus care-link/consent-authorized doctor read.
4. Demonstrate G2 including revocation and a duplicate call before broadening to the other activities or visual polish.

Stop point for this package: documentation and machine contracts only. No tasks above were executed.

## Phased V1 ownership and gates

- D1 owns VoiceAgentAdapter normalization and ElevenLabsAdapter integration, agent prompt/client-tool configuration, private voice/text bootstrap requirements and provider retention evidence with D3. GeminiLiveAdapter is a V2 backlog item only: no SDK/key/Google setup in V1.
- D2 owns LocalCameraPreviewController, separate permission/focus lifecycle, exact preview-only disclosure, call/text UI separation, cards and immediate accepted-result My Journey refresh. No preview ref/frame/URI may enter the provider adapter or API client.
- D3 owns createAgentConnection/updateAgentConnection, server-selected private agents, fail-closed privacy policy, connection epochs/lifecycle and getMyJourney projection; camera flags are removed from application API/SQL. Existing auth/business/recommendation/consent decisions remain.
- D4 retains portal/report/alert ownership; activity appears in My Journey before optional report refresh completes, and clinician authorization is unchanged.

G0 exit requires actual saved agent audio/transcript-retention verification (not docs/default assumptions), exact SDK 57/RN/ElevenLabs/LiveKit/Rive pins/build IDs, target-device audio-only track/network/storage audit while preview is active, independent camera/mic denial/reconnect tests, blocking client-tool synchronization and separate text mode with restored application context. Current status: not executed; no build or agent configuration in repo.

G2 primary scenario: open ElevenAgents voice call → speak naturally → optional strictly local camera preview with exact disclosure → backend-ranked, synchronized spoken/cards recommendation → complete local activity → accepted feedback/outcome in My Journey. Then exercise confirmed observation → factual JSON report → patient grant → doctor read/revoke. Never claim surroundings visibility.

Proposed files are ownership paths, not created app modules. The adapter implementation, device tests, SDK installation and account configuration remain first coding/setup tasks after this documentation-only update.
