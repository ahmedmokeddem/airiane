# First integration path

Start with the runnable foundations, not the whole planned product. Install and configure using the root and application READMEs. Existing OpenAPI/tool schemas are authoritative; generated TypeScript lives in `contracts/generated/api.ts`.

## Independent development

Mobile mock mode uses explicitly fictional responses without requiring backend/provider credentials. The portal's mock mode uses labeled canonical fixtures. The backend runs independently with a migrated PostgreSQL database and either Supabase JWT validation or the explicit development-only fictional identity. Mock voice does not open a microphone or claim an ElevenLabs connection.

## Real backend loop

1. Start the local PostgreSQL service, apply `database/migrations/0001_baseline.sql`, and start FastAPI on port 8000 as described in `backend/README.md`.
2. Enable development demo auth only for fictional local data. On mobile choose API data mode and the matching demo identity, or configure Supabase credentials and use real sign-in. Keep the provider mock mode separate from backend mode where supported.
3. Create and activate an application session. Request relaxation recommendations. Backend returns the Calm Breathing activity and its versioned ID.
4. Mobile UI Bridge applies the exact cards before resolving its tool callback. Both touch and voice selection must use that recommendation/activity ID pair.
5. Start the activity; complete it and submit feedback. Only successful backend acknowledgements mark records saved. Refresh My Journey and verify the returned completed activity and rating, including after a reload/reconnect.
6. Repeat a write using the same idempotency key and verify it does not create a duplicate. Try another fictional patient and verify the record is inaccessible.

`TEST_DATABASE_URL=postgresql+asyncpg://... bash scripts/integration.sh` starts a temporary HTTP server on port 8765 and runs the mobile client/bridge test. It requires an already migrated disposable database. This command is also wired into CI.

`mobile/README.md` documents `npm run test:integration` for the executable client/bridge-to-HTTP loop. That test simulates the provider callback and UI application, while exercising the actual backend and PostgreSQL. It is not proof of natural speech, a native camera session, or audible synchronization.

## ElevenLabs handoff

Configure a private ElevenAgents agent with the exact allowlisted client-tool names/arguments in `contracts/tool_contracts.json`, enable **Wait for response**, and include the vision-denial/same-ID prompt described in `mobile/README.md`. Keep its permanent API key only in backend environment. Use a real Expo development build with the committed native plugins; Expo Go is insufficient for LiveKit. The installed baseline supersedes the earlier SDK 57 planning candidate; see mobile's lockfile and README for resolved versions, with actual native-device compatibility still pending.

Before issuing a private voice token or signed text-only WebSocket URL, review the saved account/agent recording, transcript retention and deletion policy. `RE_PROVIDER_PRIVACY_VERIFIED` is an operator attestation gate, not automatic inspection of an ElevenLabs account. Do not set it merely to suppress a 503. The initial scaffold did not verify a provider connection. The continuation now verifies actual saved configuration and a real Android voice/tool interaction; see IMPLEMENTATION_STATUS.md for exact limits.

Voice: backend bootstrap → ElevenLabsAdapter → SDK audio connection → normalized client tool → FastAPI recommendation → committed cards → same-ID tool response → verbal presentation. Text is a separate textOnly connection sharing the application session, with no hidden microphone capture. Camera permission and preview lifecycle remain independent: **Camera preview only — RE cannot see your video yet.** No camera track, URI, image, frame, recording or upload is accepted by the adapter/API.

## Current boundaries

The real patient persistence slice is the integration target. Stored factual reports and clinician consent checks are now implemented in FastAPI. Portal API mode uses them with backend-verified clinician identity; real Supabase account authentication remains unverified, while the explicit development clinician path has been exercised. Transcript persistence, full observation extraction, automatic report refresh/jobs, secondary activities and Rive asset integration remain later tasks. Do not infer they exist from broader planning contracts.

See `IMPLEMENTATION_STATUS.md` for actual check results and blockers. Do not use real patient data in the fictional demo environment.
