# RE:SONANCE — Product requirements

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

## Vision and users

Help a patient after TMS treatment maintain a comfortable daily wellbeing routine: talk or type, choose a small suitable activity, reflect on explicitly reported observations, and share factual reports with an authorized clinician. It supports follow-up without diagnosing depression, verifying recovery, recommending TMS parameters, or replacing medical care.

| Persona | Need | Boundaries |
| --- | --- | --- |
| Patient | Low-effort conversation, a customizable companion, small activities, control of memories/history/sharing. | Can decline a question, stop an activity/camera, correct a fact, or revoke sharing without losing own-report access. |
| Verified clinician | View authorized patient reports and explicit review requests. | No access by knowing a patient ID; no transcript/private-memory access in MVP. |
| Hackathon operator | Provision fictional accounts, verify clinician role, label mock/live behavior. | No public admin endpoint or real patient recruitment. |

Assumptions A1: adult fictional personas, English-first demo; no claims of clinical validation. A2: one named verified clinician is selectable by patient identifier in a fictional directory; no email invite delivery or public people search. A3: network connection required for AI and writes; local activity presentation can continue through a brief interruption. These are proposals, not user facts.

## Functional requirements and acceptance

| ID | Requirement | Observable acceptance |
| --- | --- | --- |
| R01 | Supabase sign-in, onboarding, patient profile and local avatar customization. | Patient can choose color/accessory; app user maps to verified JWT subject; selecting a demo role is never authorization. |
| R02 | ElevenAgents V1 realtime voice, local camera preview, and separate natural text mode. | Real device exchanges ElevenLabs audio; camera preview stays strictly on-device; separate textOnly mode works without microphone capture. |
| R03 | Python guided controller, preferences, recovery context and confirmed memory. | Three bounded wellbeing questions can be answered or skipped; resumption retains progress; preference changes require patient action. |
| R04 | Backend-ranked recommendations synchronized with speech and cards. | ElevenAgents invokes present_activity_recommendations; UI and function response carry identical recommendation_id and activity_id values before speech introduces options. |
| R05 | Five activity families. | Catalog has breathing, nature, behavioral_activation, reflection and social_reconnection; no medical benefit promise. Breathing is the first fully integrated experience. |
| R06 | Start, run locally, finish/abandon and give feedback. | Voice/touch select the same offered ID; backend validates once; activity returns to the same conversation; completed activity accepts one rating/comment. |
| R07 | Opt-in transcript history and session summaries. | History off means no conversation text uploaded/stored; consented input/output turns persist without duplicate retries; partial sessions remain labeled partial. |
| R08 | Source-linked patient facts and corrections. | Extraction proposes; patient confirms/rejects/edits; later correction supersedes old observation; reports count only current confirmed facts. |
| R09 | Versioned assessment responses. | Fictional, nonclinical check-in definitions validate question IDs and bounds; no diagnostic scoring assumed. |
| R10 | In-app factual JSON reports. | Current observations, completed activities, feedback and assessments produce bounded trends with source references, coverage and freshness in both clients. |
| R11 | Patient–clinician links and scoped consent. | Patient invites, clinician accepts, patient explicitly grants reports/alerts; expiry/revocation removes future permitted reads. Transcript consent is separate. |
| R12 | Clinician portal and follow-up alerts. | Only authorized patients appear; report rendering uses canonical Report DTO; explicit patient review request is recorded and becomes visible only to authorized recipients. |
| R13 | Private, minimized storage. | No default raw audio/video; no tokens/transcripts in logs; doctor cannot retrieve private history via a report reference. |
| R14 | Interruptions and retry safety. | Duplicate tools/completions/jobs do not duplicate business effects; reconnect restores application progress and clears interrupted playback. |
| R15 | Accessible, calm presentation. | Controls have labels, readable contrast and reduced-motion behavior; activity/confirmation paths work without voice; loading/error/empty states are explicit. |
| R16 | Honest clinical and demo boundaries. | Explicit help control bypasses model; no promise of emergency monitoring, physiological measurement, diagnosis, relapse prediction or treatment outcome. Mock behavior is visibly labeled. |

## Journeys

Patient: authenticate → profile/optional avatar setup → choose history consent → start voice or text → guided check-in → review extracted facts → request activity options → choose by voice/touch → activity → completion/feedback → return to conversation → own report → optionally link clinician and share → correct a fact or revoke consent.

Clinician: operator-provisioned verified sign-in → accept pending patient link → patient separately authorizes scopes → authorized patient list → factual report and review alerts → acknowledge/resolve → access disappears after revoked/expired grant. Acceptance of a care link is not a sharing grant.

## MVP and sequencing

P0 first slice: fictional accounts, voice connection, one guided fact, one recommendation batch, breathing activity, completion/rating, confirmed observation, own JSON report, link/share/doctor read/revoke. Text-mode UI and direct help controls provide accessible alternatives; transport spikes happen before polished UI.

P1 complete MVP breadth: other four short activities with bundled local content, avatar color/accessory, interruption/reconnect, opt-in history and partial summaries, correction refresh, versioned fictional assessment, authorized alert acknowledgement. Implement deterministic rule scaffolding; enable only patient_requested_review.

Future: clinically approved instruments/rules, clinician recovery-plan editing, translated content, push notifications, patient-history export/deletion self-service UI, offline conflict resolution, production governance. A future feature is not silently simulated as live.

## Non-goals

No PDF/report file export, EHR integration, new databases/microservices, automatic camera-based emotion diagnosis, biometrics/heart-rate estimation, social messaging, treatment prescription, precise phoneme lip sync, app-store release, emergency response service, or real patient data. Reports summarize patient reports rather than claiming TMS efficacy. Existing atmospheric design language is a visual reference, not evidence of neuroplastic or physiological effects.

The entire functional test list is prospective: existing HTML prototype navigation and screenshots do not establish any acceptance criterion as implemented.

## Phased V1 requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| R17 | Independent local-only camera preview in call UI. | Exact disclosure: Camera preview only — RE cannot see your video yet. Zero images/video/frames/URIs leave the preview, enter storage or join SDK transport. Camera denial/disconnect does not alter voice and vice versa. |
| R18 | Provider-independent VoiceAgentAdapter. | ElevenLabsAdapter is the required V1 implementation; GeminiLiveAdapter and optional camera transmission are V2 only, not V1 dependencies. |
| R19 | Verified native compatibility and provider privacy. | Target SDK 57 development-build matrix and actual saved ElevenLabs settings must pass G0; documented support is not a tested build/configuration. |
| R20 | Separate text mode with shared application context. | New text-only provider connection uses same application conversation/controller/current activity; no microphone, hidden audio or Gemini dependency. |

Primary V1 scenario: patient opens voice call, speaks naturally, optionally previews camera locally, receives spoken backend activity options synchronized with interactive cards, completes activity, and sees the accepted completion/feedback in My Journey. Report generation may follow asynchronously. The agent never claims it sees surroundings. Gemini Live remains a future V2 multimodal adapter with new explicit transmission consent, never an automatic fallback. See MULTIMODAL_ROLLOUT.md and FRONTEND_SPEC.md.
