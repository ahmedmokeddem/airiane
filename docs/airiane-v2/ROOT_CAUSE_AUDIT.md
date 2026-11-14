# AIriane V2 — initial continuity audit

14 November 2026. Historical inspection before implementation, based on the complete supplied brief. The tables below describe the original working slice, not the resulting V2 behavior. See [implementation and validation](IMPLEMENTATION.md) for changes and verified new-agent creation. The original agent and production configuration remain intact.

## Verified code findings

| Area | Current behavior | Implication |
| --- | --- | --- |
| Text navigation | `mobile/App.tsx::openText` reuses a connected text conversation. It invokes `openConversation` otherwise. | It is inaccurate to say every text-screen mount necessarily creates a new provider conversation. Reopening after disconnect does. |
| Provider lifecycle | `openConversation` disconnects the adapter, closes the current provider connection, obtains a fresh bootstrap and calls adapter connect. Voice/text changes use this path. | Backend conversation-session reuse is distinct from continuity of the ElevenLabs conversation. |
| Bootstrap | `backend/app/provider.py::create` creates a new provider connection/epoch and gets a fresh voice token or text signed URL. | Native provider history is not restored by reusing the backend session ID. |
| Initial context | `ConversationController.context` returns a generic activity summary and the same mood question. Bootstrap adds preferences and current recommendation/activity. | It does not supply prior dialogue, relationship state, a last discussed topic, or daily check-in status. |
| Delivery order | `ElevenLabsAdapter.connect` starts the provider, waits for connected, then sends a contextual update. No first-message override is passed. | The saved agent has a static self-introduction. A post-connect context update cannot reliably prevent that opening from being emitted first. |
| In-memory messages | `App.tsx` holds the transcript in React state and clears it on sign-out. The adapter does not replay it into a replacement provider conversation. | Visible chat history does not establish that the provider knows the same history. Cold launches do not establish persistent continuity. |
| Patient context tool | `PatientService.context` returns stored preferences but `memories: []`, `recent_observations: []` and no recovery plan. | The current context tool does not retrieve persistent conversation memory or numeric observations. |
| Guided questions | `ConversationController.question` always returns mood with mood/energy/sleep missing. Session creation initializes `guided_state={}`. | No once-per-local-day check-in progression or deduplication is established by this implementation. |
| Confirmed narrative insights | `InsightService` supports explicit patient confirmation, correction and deletion in PostgreSQL; reporting consumes confirmed records. | This working pathway must be preserved. A model proposal is not a saved or confirmed fact. |
| Numeric observations / assessments | SQL tables and canonical schemas exist; current model dispatch accepts only four backend tools. | Schema presence is not proof of complete input, confirmation, questionnaire or daily-indicator workflows. |

## Actual current backend tool boundary

`backend/app/main.py` accepts these model dispatches after authenticated session/connection ownership checks:

- `get_patient_context`: empty argument object; returns PatientContext (currently mostly preferences).
- `get_next_guided_question`: empty argument object; returns the controller's current static question, without advancing state.
- `present_activity_recommendations`: required integer `limit` from 1 to 3; existing backend recommendation logic generates IDs and eligible activities.
- `select_activity`: required `recommendation_id`, `activity_id` UUIDs and positive `activity_version`; selection remains backend validated.

Canonical tool contract version remains 2.0.0. `propose_observation` and `request_clinician_review` are declared in the planned contract but are not accepted by the current backend dispatcher. Do not register them as working capabilities without implementation.

The separate `propose_conversation_insight` UI client tool takes theme, text (1–500 characters), reported `observed_at` and statement kind. Proposals are transient, return not-persisted state, and require patient UI confirmation before authenticated backend persistence. No model confirmation/consent/memory-write tools exist.

## Initial evidence checklist and design boundaries (subsequently resolved where documented)

- Read saved old-agent configuration to establish its actual first message, voice, language, model, tool bindings, overrides and privacy settings. Determine which resources are accessible in the supplied target workspace; tool IDs and custom voices may not transfer across workspaces.
- Receive the rest of the requirements before finalizing a new agent or schema/consent design.
- Preserve the existing agent, camera-local-only rule, authenticated identity derivation, exact recommendation IDs/render acknowledgement, explicit patient confirmations and clinician authorization.
- Genuine continuity needs application-owned, consent-aware context and lifecycle behavior. A prompt cannot create durable memory or enforce daily business uniqueness by itself. Provider retention must not be treated as an application memory store.
- No clinical score, diagnostic claim, screening validity, persistent provider history or successful new-agent conversation is claimed by this audit.

## Saved original agent: verified read-only

The original provider agent is named `RE`, uses English, model `deepseek-v41-flash`, and voice ID `cjVigY5qzO86Huf0OWal`. Its actual first message is: “Hi, I’m AIriane. We can talk for a moment or find a small activity to help you unwind. What would feel helpful right now?” This confirms a repeatable introduction on fresh provider conversations; it does not mean every tab navigation reconnects. The configuration export is held privately outside the repository, and contains no API key. Target workspace list access succeeded. Voice/tool access and any resources beyond the returned list page still require verification before creating the new agent.

## Workspace and SDK compatibility: verified read-only

The supplied target key can read the working voice (`Eric - Smooth, Trustworthy`, HTTP 200). Its accessible tool inventory is empty (HTTP 200, zero tools), so old workspace tool IDs must not be copied into a new agent. The original agent's actual TTS model is `eleven_v3_conversational`; output is PCM 16000. Its turn model is `turn_v3`, with turn eagerness `normal`, seven-second turn timeout, and silence end-call disabled. Existing saved privacy requires authenticated access, disables voice recording, sets retention days to zero with audio/transcript deletion enabled, and leaves provider user memory disabled. Zero-day scheduled retention is not a zero-retention guarantee.

`mobile/App.tsx::tools` currently registers exactly three client handlers: `present_activity_recommendations`, `select_activity`, and `propose_conversation_insight`. Therefore the backend's `get_patient_context` and `get_next_guided_question` cannot yet be exposed as working provider client tools without adding corresponding mobile handlers. The old provider binds those three implemented client tools plus built-in end-call/language detection. First-message override is disabled in the existing agent's saved platform settings. Both facts matter when designing a compatible V2 startup.

The original name, voice, language, model, tool bindings, first message and privacy settings have only been read. At the audit stage no create/update/delete operation had been called. Subsequently a separate AIriane V2 agent was created and verified; production environment variables remain unchanged.
