# Installation & developer guide

One repository, three applications, canonical HTTP/tool contracts, and a PostgreSQL baseline. The initial slice is recommendation → Calm Breathing → completion + feedback → My Journey. See [physical Android launch/test commands](docs/DEVICE_VERIFICATION.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md) for tested, mocked and blocked behavior; planning documents describe the larger target system.

## Prerequisites and install

Use Node 24.3+ (24 was used locally), npm, Python 3.12+, [uv](https://docs.astral.sh/uv/), and Docker for PostgreSQL. Install each app independently so the four developers can work without coupling native and web dependency graphs:

```sh
node scripts/setup.mjs
```

This installs locked root/mobile/portal dependencies and the backend dev group. Copy each application's `.env.example` to `.env` and follow its README. Never commit credentials. The fictional local development auth token is explicitly gated by `RE_DEMO_AUTH=true` and rejected outside the development environment.

## Run locally

Start and migrate PostgreSQL using [backend instructions](backend/README.md), then open separate terminals:

```sh
npm run dev:backend
npm run dev:mobile
npm run dev:portal
```

FastAPI uses port 8000; portal uses 3000. On a physical phone, set the mobile API URL to the development machine's LAN address, not phone localhost. Supabase email/password authentication needs a configured project. Mock frontend mode is available independently of backend and provider credentials and must remain visibly labeled.

ElevenLabs requires a native Expo development build with the installed LiveKit plugins, a private agent with matching **blocking** client tools, and reviewed provider retention settings. No server key belongs in mobile or portal. Without those requirements, bootstrap fails explicitly; the simulated voice path does not make a real call. Camera preview remains local with independent permission/lifecycle and the disclosure **“Camera preview only — RE cannot see your video yet.”**

## Integration and checks

```sh
npm run check:contracts
uv run --directory backend ruff check app tests
uv run --directory backend ruff format --check app tests
uv run --directory backend pytest tests
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test
npm --prefix portal run typecheck
npm --prefix portal run lint
npm --prefix portal test
npm --prefix portal run build
npm run format:check
```

Set `TEST_DATABASE_URL` to a disposable PostgreSQL database when running backend integration tests; never point it at shared or production data. The test suite may recreate its test schema. See [integration instructions](docs/INTEGRATION.md) for the real client/backend loop and provider setup. CI runs contract, client and PostgreSQL checks on pushes and pull requests; native device/provider verification is a separate gate.

## Ownership and sources

[Four-developer ownership](docs/DEVELOPMENT_OWNERSHIP.md) defines shared boundaries. Read [canonical OpenAPI](contracts/openapi.yaml), [agent tool contract](contracts/tool_contracts.json), [shared fixtures](contracts/fixtures/README.md), [architecture](docs/ARCHITECTURE.md), and [frontend specification](docs/FRONTEND_SPEC.md). Original [Stitch references](docs/design/DESIGN.md) are preserved; native components use their warm surfaces, navy type and teal accents. Existing unrelated changes are not reset.
