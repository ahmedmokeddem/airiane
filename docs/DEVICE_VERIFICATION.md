# Physical Android development-build verification

Use fictional development identities and the existing repository. Expo Go cannot load the LiveKit native dependencies. Do not change migrations or recreate the project.

## Launch commands

From the repository root, with `backend/.env` already configured and migrated:

```sh
uv sync --project backend --group dev --frozen
uv run --directory backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Leave that terminal running. The local development database can be PostgreSQL in Docker or the configured Tiger Data development service. Do not run the baseline again on the existing 32-table `re` schema.

In another terminal:

```sh
adb devices -l
# Replace SERIAL with your authorized USB device serial.
adb -s SERIAL reverse tcp:8000 tcp:8000
adb -s SERIAL reverse tcp:8082 tcp:8082
cd mobile
ANDROID_HOME="$HOME/Android/Sdk" EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 \
  npx --yes @expo/agent-cli@latest dev --android --device SERIAL \
  --local --dev-client --detach --wait-ready --port 8082 --localhost --json
```

The SDK path above is the installed path on this workstation. The actual build completed in 2m56s. If the CLI exits 22 while reporting “still building,” the detached build continues; follow its log or rerun the identical command to follow that process. Do not launch a second build or clear the project. Port 8082 avoids the already-running user Metro server on 8081.

If the launcher chooses a LAN address unreachable from the phone, open the USB-forwarded URL explicitly:

```sh
adb -s SERIAL shell 'am start -a android.intent.action.VIEW -d "exp+re-patient://?__expo_url=http%3A%2F%2F127.0.0.1%3A8082" -p dev.re.patient'
```

For a stale reload, close/reopen RE (a cold restart loses in-memory transcript bubbles but does not delete backend activity records). Development sign-in now restores a running activity with a Resume action. It starts a fresh participation timer rather than assuming time spent outside the activity counted as completion.

Set these public mobile settings in `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_VOICE_PROVIDER=elevenlabs
EXPO_PUBLIC_DEMO_AUTH=true
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

The last two settings are for the explicit fictional development identity and USB forwarding. Real Supabase account authentication requires its project URL/public key and a registered patient. In development, use **Development demo sign in**, not the password Sign in button when Supabase is unconfigured. Backend demo authentication is blocked outside development.

## Scenario and evidence

1. Open Voice and accept microphone permission. Say “Help me relax.” Confirm an audible reply, a backend-generated Calm Breathing card, and verbal introduction of that same option. Agent/internal IDs are not spoken aloud.
2. Select the card or agree verbally. A repeated selection of the same running activity must reuse the activity ID and not reset its timer. Recommendations retain the running activity's recommendation.
3. Complete the actual minute, choose a rating, save, and check My Journey. Network errors retain accepted completion and allow feedback retry.
4. Reload/sign in, refresh My Journey, and verify persistence. Resume any running activity without duplicating it.
5. Optional camera preview: permission, toggle and lifecycle are independent of voice. Exact disclosure: “Camera preview only — RE cannot see your video yet.” Never take screenshots while preview is active, capture frames, record media, or include sensor content in evidence. Inspect content-free track/transport metadata; the observed voice samples contain only audio tracks. Complete concurrent-preview/egress, permission-denial/revocation and background/reconnect coverage still requires a dedicated device pass.

Helpful commands (from `mobile/`):

```sh
npx --yes @expo/agent-cli@latest runtime:tree --port 8082 --android --all --json
npx --yes @expo/agent-cli@latest runtime:errors --port 8082 --android --duration 2s --fail-on-error --json
```

An empty debugger target/tree during reload is not proof of a working screen. Reopen the app, wait for its bundle, and inspect the actual screen. CLI tap calls component handlers; it does not prove touch geometry/gesture behavior. User confirmation and observed backend records are distinguished in IMPLEMENTATION_STATUS.md.

## Doctor Portal

Provision only the fictional development clinician explicitly:

```sh
uv run --directory backend python -m app.seed_clinician --fictional-demo
```

In `portal/.env.local`:

```dotenv
PORTAL_DATA_MODE=api
RE_API_URL=http://127.0.0.1:8000
PORTAL_DEMO_AUTH=true
```

```sh
npm --prefix portal ci
npm --prefix portal run dev
```

Open http://localhost:3000/login and use the development clinician button. Give its displayed connection code to the fictional patient. Mobile Reports → send invitation → clinician accepts → patient explicitly shares the displayed report period for seven days → generate a report → refresh portal. Stop sharing and verify subsequent API reads deny access. The portal must never substitute fixtures after denial. Real Supabase clinician sign-in is implemented but not account-tested here; development sign-in is blocked in production.

## Automated regression commands

Use a separately migrated disposable PostgreSQL database for tests, never the cloud service containing manual device records:

```sh
TEST_DATABASE_URL=postgresql+asyncpg://re:LOCAL_TEST_PASSWORD@127.0.0.1:55433/re_test \
  uv run --directory backend pytest tests -q
uv run --directory backend ruff check app tests
uv run --directory backend ruff format --check app tests
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test
npm --prefix portal run typecheck
npm --prefix portal run lint
npm --prefix portal test
npm --prefix portal run build
python scripts/check_contracts.py
```

Do not run Next's production build concurrently with its development server; both write `.next` output. The initial contract/SQL/design artifacts remain unchanged.
