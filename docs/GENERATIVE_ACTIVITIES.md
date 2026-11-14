# Purpose-driven generative activities

## Integration audit (before implementation)

The application uses Expo 58 and FastAPI/SQLAlchemy Core. This extension keeps the existing ElevenLabs agent, LiveKit transport, authentication and navigation.

| Capability | Existing owner | Extension |
| --- | --- | --- |
| Recommendation presentation / committed card acknowledgement | `mobile/src/integration/mobile-ui-bridge.ts`, `App.tsx:makeBridge`, `call/call-screen.tsx` | Present a validated proposal through the same recommendation state and carousel |
| Selection / session creation | `ActivityService.start`, `api.start`, `select_activity` | Reuse exact recommendation/activity/version identifiers; generated definitions are patient-owned |
| Activity playback | `product/product-screens.tsx:BreathingScreen`, `call/call-screen.tsx` | Add a bounded declarative component registry inside these screens, keeping companion and call controls mounted |
| Completion / feedback | `App.tsx:complete`, `ActivityService.event/feedback` | Preserve existing records and feedback; require confirmed generated progress before completion |
| Journey / reports | `ActivityService.journey`, `reporting.py`, existing portal/PDF | Reuse activity sessions and source records; do not disclose local reflection text |
| Agent context / tools | `App.tsx` client handlers, `voice-agent-adapter.ts` | Minimal optional generation/choice handlers; no new agent or transport |
| Persistence / deployment | `storage.py`, numbered migrations, `Settings`, Aiven Runtime | Additive migration; server-only Featherless configuration; disabled by default |

The global catalogue returns only active rows. Generated catalogue projections must therefore be inactive, with private definitions checked against authenticated patient ownership. The existing activity kind taxonomy remains intact. The existing player lacks generated components, and no Featherless integration is present. No provider history is needed for generation.

## Implementation plan

1. Add explicit server-only configuration, typed bounded schema, HTTP provider abstraction and deterministic validation/fallback.
2. Add patient-owned generation reservations and progress. Perform inference outside SQL transactions; bound attempts and calls per conversation. Reuse ordinary recommendation and activity-session IDs.
3. Add a small creation panel and interactive registry using existing buttons, typography and colors. Keep drawings/reflection text local. Preview before acceptance, permit modification/decline, pause/skip/stop.
4. Route voice/touch actions through versioned backend progress, preserving the mounted voice session. Keep consent/final real-world confirmation in patient UI.
5. Run isolated automated tests and available native checks. Record actual results and blockers before enabling or deploying.

## Configuration

Server only: `GENERATIVE_ACTIVITIES_ENABLED=false`, `FEATHERLESS_API_KEY`, `FEATHERLESS_BASE_URL=https://api.featherless.ai/v1`, `FEATHERLESS_MODEL` (exact verified Nemotron ID). Never put the key in mobile/public environment files. Provider generation uses an explicitly supplied brief goal, format and duration; never patient records, transcripts or questionnaire answers.

## Rollback

Set `GENERATIVE_ACTIVITIES_ENABLED=false` and restart/redeploy Runtime to reload environment configuration. Existing curated activities remain available; no database rollback is necessary. This configuration is read at process startup, so changing the environment alone does not hot-reload it.

## Verification

Actual verification and remaining manual gates are recorded below. The production feature remains disabled.

## Implemented contract and privacy boundary

Definitions use schema `1.0`, five formats, six allowlisted components, at most eight steps, strictly forward branch indices, 30–600 seconds estimated duration, bounded strings and shape tokens. Only `choice` components may branch. No generated code, URL, executable markup or arbitrary asset reference is rendered. A conservative content gate supplements model instructions; it is not a clinical or comprehensive content-safety certification.

`FeatherlessNemotronProvider` verifies the exact configured model using the authenticated model-detail endpoint. HTTP uses existing `httpx`, HTTPS verification, 3-second connect / 12-second read timeouts, a 23-second overall deadline, 2,400 output tokens and a 64 KiB response bound. At most two completion attempts include either transient backoff or one structural repair. Unsafe content is rejected without repair. Failure returns ordinary curated recommendations. HTTP status, latency, token counts and fixed validation locations/reasons are logged; prompts, goals, provider response text, credentials and patient records are not logged.

Three generation reservations per conversation each reserve two completion attempts, including failed/cancelled requests. Request hashes/keys prevent duplicate inference on retry. No SQL transaction remains open during inference. Cancellation disconnects/cancels the HTTP task; consent is checked again before publication. Revocation invalidates in-flight publication, and replaying an earlier consent key cannot restore permission. A process killed during generation leaves a reservation that becomes cancelled when retried after two minutes; no automatic second inference is issued for that key.

`0007_generated_activities.sql` adds four patient-owned tables. Generated catalogue projections are inactive and cannot enter other patients' catalogue recommendations. Existing recommendation IDs, activity-session IDs, completion/source records, feedback and Journey are reused. Progress has independent revisions and semantic retry deduplication. Completion requires a separate patient UI confirmation; the voice endpoint cannot confirm real-world steps or final completion. Local drawing tiles and thought text never enter requests, progress records, reports or agent context.

The reader supports pattern repetition, a native SVG color/shape composition, private local thought sorting, a gentle focus companion, practical-step confirmation and optional branching choices. Existing companion animation supplies reduced-motion handling. No new native dependencies or audio APIs are introduced.

## Agent configuration

The old local `backend/.env` ElevenLabs target is the original RE agent; it was not modified. The existing private V2 profile was selected explicitly for additive tool configuration. Two response-waiting client tools (`generate_activity`, `submit_activity_choice`) use 45-second timeouts. Existing `select_activity` accepts the exact proposed IDs. No consent, memory-write, automatic-start or model final-confirmation tool was added.

The setup script adapts declarations to ElevenLabs' parameter dialect (descriptions required; application-side `additionalProperties:false` is not a provider field). It reuses matching workspace tools after partial setup and patches only tool bindings. Saved configuration is compared with the original excluding the derived resolved `tools` list. System prompt, first message, voice and privacy remain unchanged. See the saved-setting receipt in `implementation-validation/generative/agent-tools.json`.

Read-only review, from `backend/`:

```sh
uv run python -m app.generative.configure_agent --profile .env.airiane-v2.local
```

`--apply` adds missing bindings to the same existing AIriane V2 agent; it never creates a new agent. A profile is local/private, never committed. Use the actual production V2 profile, not the legacy RE target.

## Enable and rollback sequence

1. Keep `GENERATIVE_ACTIVITIES_ENABLED=false` while deploying backward-compatible code.
2. Review and apply `uv run --directory backend python -m app.migrate --migration 0007_generated_activities.sql` once against the intended database. The configured hosted Tiger Data database was migrated with explicit user approval on 15 November 2026; all four tables and the checksum ledger were verified. See `implementation-validation/generative/production-migration.json`. Do not rerun the baseline.
3. Set the four server-only variables in the existing Aiven backend service. The verified local conversational model is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16`. `nvidia/Nemotron-3.5-Content-Safety` was the initially configured classifier and is unsuitable for activity generation. Account availability must be checked again for another account/deployment. The supported Nano 3 family uses documented `enable_thinking:false` in the adapter.
4. Review provider privacy/retention and the patient-facing disclosure for real use. Only fictional goals were used in development.
5. Run `uv run --directory backend python -m app.generative.verify` for an explicit fictional provider smoke test (does not enable the feature).
6. Install the updated mobile build, confirm capabilities and the current agent's callbacks, then set `GENERATIVE_ACTIVITIES_ENABLED=true` and restart/redeploy the backend. No portal change is required for the activity counts/feedback in existing authorized reports.

For rollback set the flag to `false` and restart Runtime. This hides creation and stops generation. Existing curated activities, saved Journey entries and reports continue; resuming an unfinished generated player requires the feature enabled. Do not roll back migration 0007 or delete accepted activity history. Optional tool bindings may remain: disabled clients return unavailable rather than start inference.

## Actual results (15 November 2026)

- **VERIFIED LIVE PROVIDER + LOCAL POSTGRESQL:** five formats generated via real Featherless, accepted via canonical session APIs, progressed via both HTTP channels (voice channel simulated), explicitly completed, rated 4 and read from existing Journey. Last pass generation latencies were 2.09–4.15 seconds. Earlier invalid responses exercised curated fallback. These samples do not establish an ongoing success-rate or latency guarantee. Receipt: `implementation-validation/generative/real-provider.json`.
- **VERIFIED AUTOMATED:** full backend suite 106 passed with `TEST_DATABASE_URL` set to disposable PostgreSQL; 19 focused generation tests passed again after final strict-choice/content validation; migration 0007 applied and checksum-replayed successfully on disposable PostgreSQL 16. Contract validation: 11 fixtures. Mobile: 80 tests, TypeScript and lint passed before final UI/device checks. Portal: TypeScript/lint and 17 tests passed.
- **BUILD VERIFIED:** local ARM64 release compile 31 seconds (warm cache); development APK compile 8m32s (first debug dependency build). The release test's local HTTP request was blocked by Android network policy; production TLS was preserved and testing moved to the Development Build.
- **VERIFIED ON DEVICE:** native creative proposal/canvas and completed activity `becbc4dd-c1af-4624-a0a4-2e80cccefcf6`, rating 4, matching PostgreSQL/Journey. Setup used runtime control handlers; a screenshot confirmed the actual native layout. No gesture-matrix or frame-rate claim. See `native-creative.json`.
- **VERIFIED BUILD:** mobile web export and isolated portal production build passed. The final internal Aiven APK built in 37 seconds; artifact/signing/secret-scan results are in `apk.json`.
- **PARTIAL / MANUAL BLOCKER:** first native voice test failed because an old consumed recommendation was supplied to the agent while the fresh bridge had no current cards. The backend now excludes consumed/declined proposals and uses only the newest recommendation; the app commits bootstrap cards before SDK connection and clears consumed cards after save. A dedicated regression passes. The next call reached Listening without old cards/errors, but the patient could no longer repeat the spoken-generation scenario. Generated native voice/tool continuity is **NOT VERIFIED**. No new Bluetooth, wired headset or interruption validation is claimed.
- **VERIFIED CLEANUP:** both test provider connections closed through normal controls; microphone AppOps was not running and Android camera clients were empty. Temporary reduced-motion and USB-awake settings were restored. Native call cleanup receipt contains metadata only.
- **TOOLING DIFFERENCES:** Expo agent CLI refused a second server while existing Metro 8082 owned the project lock; underlying Expo CLI used isolated port 8084. CI mode cached old sources, so the test server was restarted with watching enabled. Agent CLI `runtime:reload --method runtime` used an incompatible SDK 58 zero-argument call; a cold relaunch cleared this tooling error. Android accessibility idle dumps were unreliable with the orb; runtime actions invoke handlers and do not prove physical touch geometry. Portal build output must remain inside the app directory for dependency resolution; `.next/generative-verification` succeeded without altering the running portal output.
- **NOT DEPLOYED:** Aiven environment flag remains unchanged; the local `.env` flag remains false. No production migration, store submission, push or backend deployment occurred. The verified internal Aiven APK was installed on the phone with creation disabled.

## Changed files

- Backend: `app/config.py`, `main.py`, `provider.py`, `services.py`, `storage.py`, `migrate.py`; new `app/generative/{schema,provider,service,routes,configure_agent,verify}.py`; `tests/test_generated_activities.py`; `.env.example` and `.env.production.example`.
- Persistence/contracts: `database/migrations/0007_generated_activities.sql`, additive `contracts/openapi.yaml`, generated `contracts/generated/api.ts`, matching optional `ActivityConfig` fields in `contracts/tool_contracts.json`, new `contracts/generative_tools.json` and generated-activity fixture. Baseline migration and existing operations are preserved.
- Mobile: `App.tsx`, existing call screen/product screens, `integration/api.ts`, `mobile-ui-bridge.ts`; new `features/generative/{types,use-generated-activities,creation-panel,activity-player,tool-results}`; `tests/generative.test.ts` and test runner.
- Documentation: this integration map, `IMPLEMENTATION_STATUS.md`, content-free receipts under `implementation-validation/generative/`.

No portal source, branding, audio dependency, native package version or baseline SQL changes were required. Unrelated local skills and earlier private TLS/deployment artifacts were left untouched.

## Manual acceptance remaining

1. With migration 0007 and the flag enabled in an isolated environment, open voice, grant generation in patient UI, say “Create a one-minute pattern game with circles and squares”, verify the exact displayed card and audible description, accept by voice/touch, exercise a versioned voice choice, finish with patient UI confirmation, and compare the same connection ID/epoch throughout.
2. Repeat headset input/output and hotplug during a generated activity, plus background/interruption and lowest-end-device checks. Existing audio ownership was preserved, but that is not proof of these checks.
3. Review production provider privacy, operational quotas and content safety; approve/apply migration 0007, deploy backend and updated mobile build, then enable. Disabling the flag requires only a backend restart, not schema rollback.

APK installation from repository root (internal ARM64 build):

```sh
adb -s SERIAL install -r build/artifacts/AIriane-generative-disabled-internal-arm64.apk
```

This package uses Aiven HTTPS and real Supabase authentication. It contains no Featherless/ElevenLabs server keys. It is development-signed for internal testing, not a store-signed release.

The final APK installation returned `Success` and Android package flags confirmed a non-debuggable build. The `AIriane-latest-internal-arm64.apk` alias points to the same verified artifact; the previous focused-build artifacts remain available. The temporary local test server, Metro 8084, test USB forwards and disposable PostgreSQL container were stopped/removed after verification. Existing backend/Metro 8082/portal services were left running. Sign in again on the restored Aiven APK; test identities are not transferred to production.

Final review also keeps the same private component mounted across pause/resume (disabled rather than removed) and keys it by activity-session/step, so duplicate selection or pause cannot erase local draft state. Expected generation-permission failures and version conflicts resolve as structured client-tool results, and stale activity selections return the canonical Error shape instead of rejected SDK callbacks that could mark the call disconnected. Three focused mobile tests cover this nonfatal error boundary. These final refinements passed automated checks/build; they still require the postponed native voice/pause recheck.
