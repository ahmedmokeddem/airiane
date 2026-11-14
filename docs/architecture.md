# RE — Technical architecture overview

V1 uses ElevenLabs ElevenAgents for realtime voice and separate text-only connections through a provider-independent VoiceAgentAdapter. GeminiLiveAdapter remains future V2 only.

The React Native/Expo app renders Rive and a strictly local camera preview independently of the voice connection. **Camera preview only — RE cannot see your video yet.** No images, video, frames, camera state or recording leave the device.

Mobile UI Bridge handles blocking client tools, obtains backend recommendations, displays interactive cards and returns the same activity IDs for spoken presentation and voice/touch selection. FastAPI remains one Python application with API/bootstrap, controller, memory, activities, observations, reports, consent and optional background jobs. PostgreSQL stores consented text history, summaries, source-linked confirmed facts, activities, feedback, assessments and JSON reports; raw audio/video are not stored by RE. My Journey reflects accepted activity writes.

Doctor Portal → FastAPI → active Care Link & Consent Check → Report Service → PostgreSQL. Reports use confirmed records and factual trends; patients can correct observations. No PDFs.

See the [interactive architecture](architecture.html), [detailed architecture](ARCHITECTURE.md), [rollout](MULTIMODAL_ROLLOUT.md), [frontend specification](FRONTEND_SPEC.md), [contracts](API_CONTRACTS.md), [implementation plan](IMPLEMENTATION_PLAN.md) and [verification gates](PROVIDER_VERIFICATION.md). Previous overview assets are in archive/before-elevenlabs-*. Actual development-build compatibility and provider account retention settings remain unverified launch gates.
