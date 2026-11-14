# RE:SONANCE — Phased multimodal rollout

Status: contract v2.0.0, 14 November 2026. Planning update only. No React Native app, provider adapter, SDK build or running backend is implemented in this repository.

## V1 and V2 boundaries

| Capability | V1 release target | V2 future integration |
| --- | --- | --- |
| Realtime voice | ElevenAgents through ElevenLabsAdapter, private agent and authenticated audio-only WebRTC. | GeminiLiveAdapter after its own compatibility and privacy review. |
| Text chat | Separate ElevenAgents text-only WebSocket connection, sharing the same application session and Python controller context. No microphone capture or hidden audio playback. | Provider-specific text support reviewed separately; not a reason to require Gemini in V1. |
| Camera | Toggle and local native preview only; no capture, transmission, recording or persistence. | Optional Gemini Live frames only after a separate feature gate and explicit transmission consent. |
| Client actions | Six existing allowlisted tools through Mobile UI Bridge; backend supplies activities and IDs. | Same application contracts with a provider-specific binding. |
| Trusted logic/data | Existing FastAPI modules, Python Conversation Controller, PostgreSQL, consent, observations and JSON reports. | Unchanged logical architecture. |

Gemini SDKs, API keys, model setup, credentials, quotas and frame processing are not V1 dependencies. “ElevenLabsAdapter implemented for V1” is the assigned implementation scope; it is not a statement that an adapter already exists. No application feature code is introduced by this documentation task.

## Primary V1 acceptance scenario

Patient opens a voice call → authenticated ElevenAgents connection → natural speech → optionally activates an on-device camera preview → voice agent invokes present_activity_recommendations → bridge retrieves backend options → applies exact interactive cards → resolves the blocking client tool with identical activity IDs → agent speaks about those options → voice or touch selects a current option → backend accepts activity session → local activity runs → completion/feedback commits → My Journey reflects the accepted result immediately. JSON report aggregation can finish afterward with an honest pending/stale indicator.

The camera area and accessible hint display exactly:

> Camera preview only — RE cannot see your video yet.

The agent never claims visual access. If the patient describes a room verbally, the agent may refer to what the patient said, not imply it sees the room. A “look at this” request receives an honest explanation that V1 has no video access.

## Camera isolation is a hard invariant

LocalCameraPreviewController owns camera permission, preview mount state, foreground/focus and cleanup. It is outside VoiceAgentAdapter. No camera permission/state field enters a V1 API request, provider initialization/context variables, database row or tool. No photo/video file, URI, base64, frame callback, image picker, screenshot export, recording, barcode extraction, RTC video track, screen share or upload feature is provided. The provider WebRTC connection sends audio only, even when camera permission is granted to the local preview.

Use native preview rendering without calling capture/record/frame-processing APIs. Mask preview in session-replay/crash screenshots and do not log its content. OS display buffers stay local; this design does not claim control over a person externally photographing their screen. V2 must not reuse preview permission as transmission consent.

Voice startup must not request camera permission. Camera on/off must not start, stop or reconnect voice. Voice failure does not mutate preview state while the call view remains focused. Leaving the view, backgrounding, permission revocation or explicit camera-off unmounts preview and releases it independently. Permission denial leaves voice usable; microphone denial leaves preview independently usable and offers text mode.

## Provider-independent application context

The application session ID remains the identity for guided questions, confirmed facts, current recommendations, activity progress and summaries. Voice and text use different provider connections/native IDs and transports. Switching modes closes the previous provider connection, updates application mode, and creates a new owned connection with a backend AgentContext snapshot. It does not end/reset the application conversation.

AgentContext carries a bounded structured summary, current guided question/preferences, current recommendation and active activity, with a context version. Accepted outcomes update context through the bridge. Do not promise byte-identical provider history across transports. If history is off, do not secretly upload/store a transcript to recreate context; preserve confirmed application state and explain any lost unconfirmed wording. Patient-approved retained history may inform authorized summaries under the existing policy.

Provider connection IDs/epochs are correlation metadata, never permission to access a patient. The backend allocates a connection epoch under the application-session lock. Client tools and retained text uploads reference that owned connection. A closed connection cannot execute new tools; bounded late final text still needs current transcript consent and a time within the closed connection. No post-call audio/history import is needed.

## Provider-private bootstrap and tools

FastAPI chooses the V1 private ElevenLabs agent and provisions a WebRTC conversation token for voice or signed WebSocket URL for text. Permanent xi-api-key stays server-side. AgentConnectionBootstrap is discriminated by mode/transport; it has no Gemini model/modality fields. connect_before is a RE start deadline, not an invented provider TTL; credential_expires_at stays null unless verified from the provider response. Never persist credentials/signed URLs in PostgreSQL or logs.

ElevenLabs client tool names/argument shapes must match contracts/tool_contracts.json and the saved agent configuration. Configure Wait for response for recommendation presentation and other result-bearing tools. The bridge awaits FastAPI, applies cards, then resolves the SDK handler with the canonical result. This is not Gemini’s send_tool_response API. SDK handlers may not expose a native call ID; allocate a stable normalized invocation ID per callback lifecycle and combine it with connection_id. Reuse that ID on backend retries; keep business uniqueness protections for redelivery/voice-touch races.

## V1 launch gates and evidence

Selected planning baseline: Expo SDK 57 development build, matching React Native 0.86.2/React 19.2.3 from the official ElevenLabs Expo example. Resolve and lock a published compatible ElevenLabs SDK plus LiveKit/Rive/native peer versions at G0; repository main/package version is not proof of a published stable release. No app manifest/lockfile/build currently confirms this matrix. Expo Go is not the supported voice path.

Actual saved voice/text agent privacy settings must be inspected before credential issuance: disable provider audio saving, choose the documented zero-day transcript deletion policy, and verify deletion flags and disabled content webhooks/debug exports. Zero-day retention is scheduled deletion, not a Zero Retention Mode guarantee. If account/model/region supports ZRM, verify it separately. Application transcript opt-in controls RE PostgreSQL storage, not provider processing or retention.

No account/configuration is connected here. Compatibility and agent-retention evidence are explicitly pending in PROVIDER_VERIFICATION.md and contracts/provider_privacy.requirements.json. Bootstrap fails closed with PROVIDER_PRIVACY_UNVERIFIED until an operator attests actual saved configuration. The V1 acceptance scenario is a future test, not a completed call.

See [architecture](ARCHITECTURE.md), [frontend specification](FRONTEND_SPEC.md), [adapter manifest](../contracts/voice_agent_adapter.json), [API contracts](API_CONTRACTS.md), [implementation plan](IMPLEMENTATION_PLAN.md) and [tests](TEST_PLAN.md).
