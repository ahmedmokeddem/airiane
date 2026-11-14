# RE:SONANCE — V1 frontend specification

Status: proposed implementation specification, contract v2.0.0. Existing docs/design HTML and screenshot remain visual/mock references; there is no implemented React Native call screen.

## Call interface

Preserve the current calm patient design and local customizable Rive companion. Display voice status, mute, end call, text-mode switch, optional camera toggle/preview, activity cards and navigation to My Journey. Keep media errors distinct from activity/confirmation errors. Avatar speaking follows actual provider playback state; it never reacts to camera content.

The camera toggle is labeled “Camera preview”; default off. The preview area, its permission explanation and accessibility description include the exact persistent disclosure:

> Camera preview only — RE cannot see your video yet.

Do not use “video call,” “RE is watching,” a streaming-to-agent badge, visual understanding animation or an upload indicator. When preview is off, show the same capability limitation near the toggle. Do not hide this disclosure in settings or a tooltip.

## Independent state machines

| Owner | States | Effects |
| --- | --- | --- |
| ElevenLabsAdapter | idle, connecting, connected, interrupted, error, disconnected; speaking/listening/muted substates. | Audio/text transport only; cannot access the camera controller or view ref. |
| LocalCameraPreviewController | off, requesting_permission, previewing, denied, unavailable, suspended. | Native preview only; releases resource on camera-off/unfocus/background/revocation. |
| Conversation UI | same application session ID, mode voice/text, context version, current recommendation, accepted activity, pending writes. | Applies backend-authoritative results; transient pending state never looks saved. |

A voice connection can be connected while camera is denied/off. A preview can be previewing while voice is connecting/disconnected. No voice callback automatically toggles camera. App background/focus handlers operate each lifecycle separately; return foreground leaves preview off/suspended until permitted user resumption. Leaving the call screen unmounts its preview even if another text route uses the same application conversation.

Use the selected SDK-version native preview component with no photo capture, record, image picker, frame processors, barcode handlers or file output. Do not attach its stream/ref to LiveKit/WebRTC. Configure microphone permission for voice separately from camera permission. Camera module must not record audio; voice permissions come from the voice integration. Disable content capture in analytics/crash/session replay for the preview. No V1 network/client tool method accepts camera bytes, tracks, URIs or a camera-enabled flag.

## Activity synchronization and My Journey

ElevenLabs blocking client tool → bridge → authenticated FastAPI → canonical Recommendation. Apply cards with recommendation_id/activity_id/activity_version, acknowledge UI application, then resolve the provider handler with that same data. Agent narration cannot precede retrieval/render success. Voice/touch share backend selection validation, not a title-based lookup. Keep current activity and Python controller state through local activity navigation; if provider must reconnect after a long activity, rehydrate the same application context.

After accepted complete/abandon and feedback responses, update/invalidate getMyJourney. MyJourneyItem joins accepted ActivitySession, its immutable Activity and optional Feedback; no new persistence service/table is introduced. Display completed state only after server acknowledgement. Show “Saving…” for queued writes and retry state on failure. Report freshness is separate: a pending report refresh must not hide a stored completion. On relaunch fetch the owner-scoped My Journey projection; do not rely solely on local optimistic state.

## Separate text mode

Text mode uses textOnly ElevenAgents over an authenticated WebSocket, not muted voice pretending to be chat. No microphone permission/capture, audio playback or camera transmission. It shares the same application session/context and controller; it may have a new provider native conversation ID. End the voice transport before opening text and vice versa. Camera cleanup follows the call view’s focus/unmount rules, not an SDK connection callback. Typed messages are transient unless RE transcript retention was explicitly enabled.

## Failure/accessibility acceptance

Camera permission denied → explain local preview unavailable; voice and text controls still work. Microphone denied → offer text; camera preview remains independently available on the focused call screen. Provider reconnect → no surprise camera prompt/restart. Permission revocation/background → preview is released. Unsupported local camera → explanatory placeholder, never fake live content. Reduced motion and screen reader labels cover preview, connection, cards, confirmation and My Journey save states. No screenshot/video evidence of actual camera content is collected by the application.

## Implemented native call composition (14 November 2026)

The implemented call follows `docs/design/code.html` voice state: navy atmosphere, persistent living orb, top-right local-only PiP, compact cards and bottom floating controls. `mobile/src/features/call/` separates visual state, animation, audio routing and preview lifecycle. The ConversationProvider remains above route changes; breathing is an in-call panel, with completion returning to voice after accepted persistence. Original Rive artwork is missing; native gradients and native-driver transforms provide a documented fallback. See [native call review](NATIVE_CALL_REVIEW.md) and [implementation status](IMPLEMENTATION_STATUS.md) for verified device results and limitations. The Audio selector changes communication routes through public LiveKit APIs; input routing is OS-managed. Automatic priority is Bluetooth, wired headset, speaker, then earpiece. Camera permission is requested only on toggle; its temporary Android permission dialog must not pause voice or cancel the approved preview. Normal backgrounding/end releases preview resources.
