# RE patient foundation

The reusable React Native components translate Restorative Horizon tokens from `docs/design/DESIGN.md`; existing Stitch assets remain untouched. This is the first slice, not a full app. The orb is explicitly a placeholder; no licensed Rive asset was supplied.

## Run

Use Node 24 and `npm ci` in this directory. Copy `.env.example` to `.env`.

- `npm run web`: local browser foundation (mock mode by default).
- `npm run android` / `npm run ios`: development build. Native ElevenLabs/LiveKit requires a development build, **not Expo Go**; Android SDK or Xcode is required. No cloud build/account is created by these commands.
- `npm run typecheck`, `npm run lint`, `npm test`.
- `npm run contracts:generate`: regenerate shared types with isolated `openapi-typescript` CLI (TypeScript 5 peer; app uses SDK58's TypeScript6).

Default is explicitly fictional, in-memory mock data with a simulated agent. It does not use microphone or ElevenLabs. For actual backend integration set `EXPO_PUBLIC_API_MODE=live`, API URL to your host (Android emulator: `http://10.0.2.2:8000`; physical device: LAN host), `EXPO_PUBLIC_DEMO_AUTH=true`, and start the development backend with its explicit demo auth configuration. No hardcoded patient auth token is accepted unless backend permits demo mode. The Supabase password sign-in path instead uses public URL/anon key; session tokens remain in memory. Signup/reset/refresh/persistent login are not in this slice. Expo Router routes live in src/app; the root layout retains session and UI bridge state across voice, text, breathing and My Journey routes.

The simulated recommendation button calls real FastAPI in live mode, renders exact IDs through MobileUIBridge, starts the breathing activity, requires the minute to elapse, saves completion and feedback, then loads My Journey. Retry retains a successful completion and reuses write keys. To exercise the client/bridge against the running real backend without a device:

```sh
EXPO_PUBLIC_API_MODE=live EXPO_PUBLIC_API_URL=http://localhost:8000 npm run test:integration
```

## Real ElevenLabs integration setup and verification

Set `EXPO_PUBLIC_VOICE_PROVIDER=elevenlabs` only after backend private agent credentials and privacy verification are configured. No API key goes in mobile environment variables. Voice uses private WebRTC token; text uses separate `textOnly` signed WebSocket, sharing the application session. The adapter waits for actual SDK connection callback. Blocking callbacks wait for the active backend connection, authenticated tool dispatch and committed exact cards before returning results. Voice selection validates recommendation ID, activity ID and version. Other four tools remain out of this minimal slice and must not be enabled on the saved agent yet.

In the saved private ElevenLabs agent, register the two client tools with the names and exact `parameters` from `../contracts/tool_contracts.json`: `present_activity_recommendations` and `select_activity`. Set **Wait for response / expects_response=true** for both. Instruction:

> You are RE, a wellbeing companion. You receive audio or text only. You cannot see the patient, their camera, room or surroundings. Never claim visual access, even if asked to look. Ask the patient to describe anything relevant. For relaxing activities call present_activity_recommendations. Wait for its result; speak only the returned activity names/IDs. For a spoken selection call select_activity using that exact recommendation_id, activity_id and activity_version. Do not claim completion, saving or clinician delivery without an accepted tool result. Do not diagnose or replace medical care.

Disable provider audio saving; configure and verify transcript deletion/retention separately with backend policy evidence. A zero-day retention setting alone is not a ZRM guarantee. The continuation now verified real voice and a recommendation tool on a physical Android device, plus saved private-agent privacy settings. Actual deletion timing, complete interruptions/camera lifecycle coverage, and a clean uninterrupted repeat after recovery fixes remain pending; see docs/IMPLEMENTATION_STATUS.md. Installed SDK58.0.25/RN0.88.1/React19.3 is the standard scaffold's current matrix; previous SDK57 was a planning candidate. Exact installed package versions are locked by package-lock.json; verify native compatibility on device before real conversations.

## Camera boundary

CameraView is mounted only for local preview after its own permission request, and unmounted on leaving the call, app background or toggle off. It has no ref/capture/record/frame callback. Neither preview nor camera permission is passed to provider adapter, API, tool calls or storage. UI states: **Camera preview only — RE cannot see your video yet.** Voice start/stop never starts/stops preview; leaving screen/background releases preview independently. No camera tracks are enabled by this integration. Native track/egress and permission-revocation tests remain required on device.

## Current limits

No transcript persistence is implemented in mobile; message bubbles are in-memory only. Separate voice/text connections preserve backend application context. Text mock answers are visibly simulated. Native voice requires provider/account checks. Supabase refresh and navigation deep links are deferred. No reports/consent editing or secondary activity implementations are claimed. Fixtures and API DTOs derive from existing shared contracts; no new endpoint is invented.

## Android device verification continuation

A development APK built and installed on a physical Samsung SM-G998B running Android 15. A real ElevenLabs voice response and spoken Calm Breathing introduction were confirmed by the user; FastAPI persisted the matching recommendation client-tool call on a voice connection. This proves that path on this device, not complete device coverage. The first full activity attempt exposed a duplicate voice/touch selection race; the backend now reuses the running activity and the app preserves its timer. Home offers Resume, and development sign-in restores a running activity from My Journey after reload, requiring a fresh minute rather than inventing elapsed participation. The recovered device completion/feedback path now passed, with rating 4/5 shown in My Journey and the same activity linked to its voice recommendation in PostgreSQL. Full limits and the clean-repeat gate are tracked in docs/IMPLEMENTATION_STATUS.md.

Reports & sharing now reads/generates real backend JSON reports. A patient can invite a known verified doctor using their connection code, grant report access after acceptance, and revoke it. Mock mode cannot share data. See docs/DEVICE_VERIFICATION.md for exact USB build/launch and test commands. Do not use Expo Go.

## Native call development and audio patch

Run `npm ci` here: postinstall applies the guarded ElevenLabs 1.2.40 audio-route fix in `scripts/patch-elevenlabs.mjs`. Keep the exact SDK pin until this patch is reviewed against an upstream fix. `node scripts/patch-elevenlabs.mjs` verifies/reapplies it idempotently. Do not edit installed SDK files manually. Restart Metro after dependency patches if its transform cache is stale.

The call uses actual provider events plus optional ephemeral audio levels. Camera is an independent local-only PiP; no camera input exists on the adapter. The orb is a native animated fallback because the original `.riv` is absent.

For the connected test phone, from repository root:

```sh
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8082 tcp:8082
cd mobile
ANDROID_HOME=/home/ahmed/Android/Sdk EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npx --yes @expo/agent-cli@latest dev --android --device R3CR314RJHZ --local --dev-client --detach --wait-ready --port 8082 --localhost --json
```

Use the already-running server on 8082; do not start a duplicate. A `DEV_DETACH_STILL_BUILDING` result after 120 seconds is not a build failure: the detached build continues in `.expo/dev/logs/dev-detached.log`. If the development client opens a stale LAN address, open its localhost URL through ADB:

```sh
adb shell am start -a android.intent.action.VIEW -d 'exp+re-patient://?__expo_url=http%3A%2F%2F127.0.0.1%3A8082' -p dev.re.patient
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`. Device results and remaining recovery/hotplug/focus checks: [implementation status](../docs/IMPLEMENTATION_STATUS.md). Avoid live source edits during acceptance runs: development Fast Refresh can invalidate an active SDK session and is not a patient flow.

## Cold-launch opening

AIriane now reveals the approved thread symbol and wordmark over midnight navy on cold launch. Skip and system reduced motion are supported; authentication and APIs do not await the animation. The SVG renderer requires a rebuilt native client (`run:android --device SERIAL --no-bundler` when reusing Metro). See [opening behavior, exact release/debug commands and verified native/web differences](../docs/OPENING_EXPERIENCE.md).
