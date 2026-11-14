# AIriane V2 implementation and validation

14 November 2026. [Original root causes](ROOT_CAUSE_AUDIT.md) were documented before implementation.

## Created agent

The ElevenLabs API created and read back **AIriane V2**, `agent_0801m7dfz5w1ez7s46a26640wjtt`. The original RE agent remains unchanged for rollback. The new agent retains English, `deepseek-v41-flash`, Eric voice `cjVigY5qzO86Huf0OWal`, `eleven_v3_conversational`, PCM 16000 and the existing turn/connection settings. No audio SDK versions changed.

The static first message is empty. Trusted application context is supplied through `application_context` at connection start, before post-connect updates. The reviewed [system prompt](../../contracts/agents/airiane-v2-system-prompt.md) prioritizes safety, consent and backend authority over conversational style. Unknown legacy relationships do not trigger a fabricated first introduction; new relationships introduce briefly once, and returning connections respond directly. A failed connection can conservatively consume the introduction/invitation reservation before speech; this prevents repetition but does not guarantee an introduction was heard.

Five workspace-owned client tools have Wait for response enabled: `present_activity_recommendations`, `select_activity`, `propose_conversation_insight`, `get_patient_context`, `get_next_guided_question`. Existing exact-card acknowledgement and backend eligibility/ID selection remain authoritative. No observation-confirmation, consent or memory-write model tools were added. Unimplemented planned tools are not advertised. Provider widgets are disabled to preserve application-owned cards.

Authentication is required; recording is disabled; zero-day scheduled retention and audio/transcript deletion flags were read back. Provider user memory remains disabled. These settings do not prove zero retention or provider deletion timing. [Configuration receipt](provider-verification.json).

## Application continuity and patient control

Migration 0003 adds relationship state, explicit memory preference and unique patient/local-day check-ins. Memory defaults off. When explicitly enabled through patient UI, at most five current confirmed narrative notes and ten confirmed observations enter context. Correction/deletion uses the existing insight lineage and reporting behavior. Raw chat history is neither persisted nor replayed by this feature. Opt-out stops future context disclosure; it cannot retract facts already sent during a provider conversation.

Text navigation already reused connected conversations; it was inaccurate to blame every mount. Fresh provider connections had a static greeting and received context too late. V2 fixes both boundaries without assuming provider history persists. Text-to-voice supports an optional **patient-written, explicitly approved** recap, sent only after the destination connects. There is no automatic raw-transcript replay. Home Voice Call still opens immediately.

An optional daily self-report is available in Companion/Profile, separate from casual conversation. Patient UI confirms mood/energy (0–10) and sleep hours (0–24); the model cannot infer or save them. Transactional patient locking and a database uniqueness constraint prevent duplicate local-day completion, including concurrent submissions. Declining resolves that day without values. Bootstrap reserves at most one invitation per day; it need not interrupt conversation to ask it. Confirmed observations use existing source records and report aggregation. These are descriptive patient reports, not clinical scores or treatment outcomes. Validated screening questionnaires are **not implemented** or impersonated.

## Actual verification

| Classification | Result |
| --- | --- |
| VERIFIED — real provider text + isolated backend | Casual conversation without forced activity/note; returning reconnect without introduction; native recommendation tool call on the first request with backend-generated IDs; grounded recall after explicit fictional-note confirmation and memory opt-in; no old preference claimed after opt-out/reconnect. [Receipt](conversation-verification.json). No transcripts retained as evidence. |
| VERIFIED — real provider credential bootstrap | Authenticated local voice bootstrap issued a WebRTC credential for the new agent, then the connection was closed. [Receipt](voice-bootstrap-verification.json). This is not an actual Android audio conversation. |
| VERIFIED — automated | Mobile lint/typecheck and 34 tests; nine canonical fixtures; Ruff check/format. Backend final SQLite: 47 passed, one PostgreSQL-only test skipped. Final PostgreSQL: 48 passed, including concurrency and patient-timezone tests. Portal's existing typecheck and 12 tests passed. |
| BLOCKED — Android V2 | Despite user readiness/reconnection, host `adb devices -l` and `lsusb` show no phone. No V2 APK installation, native voice, Bluetooth or V2 UI verification is claimed. Earlier V1/native evidence is separate. |
| BLOCKED — production image validation | Docker build could not fetch the Python base image token because the registry network was unreachable. No successful new image build is claimed. |
| NOT DEPLOYED | Production Aiven agent/key, production mobile configuration and Tiger Data schema remain unchanged. |

## Reproduce safely

The new key and ID are stored in ignored, mode-0600 `backend/.env.airiane-v2.local`; never commit or print this file. Production `.env` remains separate. To inspect a creation plan from the sanitized stable baseline:

```sh
uv run --directory backend python -m app.create_airiane_v2 \
  --source-export ../contracts/agents/airiane-v2-baseline.json \
  --prompt-file ../contracts/agents/airiane-v2-system-prompt.md
```

For a different workspace only, add `--key-file /private/key.txt --output-profile .env.airiane-v2.local --create`. The existing agent/profile already exists: do not recreate it. The script rejects duplicate names, conflicting tools and output overwrite, creates target-owned tools and verifies API readback. It never edits the original agent.

Run an isolated fictional backend from repository root; this deliberately overrides the normal database and auth settings:

```sh
RE_ENVIRONMENT=development RE_DEMO_AUTH=true \
RE_DATABASE_URL=sqlite+aiosqlite:////tmp/airiane-v2-device.db \
RE_COMPANION_V2_ENABLED=true RE_PROVIDER_PRIVACY_VERIFIED=true \
RE_PROVIDER_PRIVACY_POLICY_VERSION=review-2026-11-14 \
uv run --directory backend uvicorn app.main:app \
  --env-file .env.airiane-v2.local --host 127.0.0.1 --port 8011
```

With that backend, run the opt-in real-provider test (fictional data only, provider usage may be billed):

```sh
AIRIANE_V2_AGENT_ID=agent_0801m7dfz5w1ez7s46a26640wjtt node scripts/verify-airiane-v2.mjs
```

This script refuses a backend that does not identify itself as fictional-demo/SQLite. Its tool callback validates real backend IDs but does not mount React cards; do not confuse it with device evidence.

When ADB sees an authorized phone, use the existing development build and Expo workflow, with these overrides rather than the production profile:

```sh
adb -s SERIAL reverse tcp:8011 tcp:8011
adb -s SERIAL reverse tcp:8083 tcp:8083
cd mobile
EXPO_PUBLIC_APP_ENV=development EXPO_PUBLIC_API_MODE=live EXPO_PUBLIC_API_URL=http://127.0.0.1:8011 \
EXPO_PUBLIC_DEMO_AUTH=true EXPO_PUBLIC_VOICE_PROVIDER=elevenlabs \
EXPO_PUBLIC_COMPANION_V2=true \
npx --yes @expo/agent-cli@latest dev --android --device SERIAL \
  --local --dev-client --detach --wait-ready --port 8083 --localhost --json
```

## Production gate and rollback

Review/apply `0003_companion_continuity.sql` with migration-owner credentials after ledger entries 0001/0002. Never rerun the baseline against the populated service. This task did not migrate Tiger Data. Keep `RE_COMPANION_V2_ENABLED=false` and `EXPO_PUBLIC_COMPANION_V2=false` until matching backend/mobile changes and native tests pass. Build the updated mobile client before switching the global provider agent: old APKs lack the two new client handlers and initial dynamic context.

Then validate actual Supabase ownership, Android text/voice continuity, daily confirmation/report content, existing activity/feedback/Journey, audio cleanup and privacy settings before any production agent/key switch. Preserve the prior agent/key as a private rollback configuration. No Aiven deployment or production switch was performed here.

## Changed areas

Backend: `app/companion.py`, `create_airiane_v2.py`, `schema_validation.py`; integrations in config/contracts/domain/health/main/migrate/provider/replay/services/storage; `tests/test_companion.py` and `test_agent_v2_creation.py`. Database: additive migration 0003 and migration README. Contracts: additive OpenAPI schemas/operations, generated types, optional context fields/tool definitions, companion fixture and agent prompt/baseline. Mobile: `App.tsx`, adapter bootstrap, `features/companion/*`, bridge/companion tests and test runner; example feature flags only. CI/shared scripts: migration verification, canonical reference validation, real-provider smoke script. No portal UI, native dependency, approved artwork or baseline SQL rewrite.
