# AIriane

**Junction hackathon — "Beyond the Clinic" challenge, in partnership with Aalto University.**

> The challenge: build a product that helps people stay well at home after depression treatment — using anything from natural stimuli to a phone, music, games, light or AI.

## Our solution

AIriane is a smartphone app that supports people after depression treatment. It helps them keep healthy daily routines and stay socially connected.

Our goal is to make everyday life easier, encourage meaningful activities, and help users feel less alone.

At the center of the app is an AI virtual companion. Patients can talk to it about their day, their hobbies, or anything else they want to share. The app also includes features to help them relax and stay physically active. And from those conversations, our AI can assess the patient's level of depression, using a mental health test together with the content of the chat. That analysis is shared with the patient's therapist, so the therapist can follow how the patient is doing after treatment.

## Resources

- 🎥 **Demo video:** _[add link here]_
- 📺 **YouTube (marketing):** _[add link here]_
- 📊 **Presentation (slides):** _[add link here]_

## Tech stack

**Mobile app — patient-facing** (`mobile/`)
- Expo / React Native 0.88 + Expo Router, TypeScript
- ElevenLabs Conversational AI (`@elevenlabs/react-native`, `@elevenlabs/client`) — the AI voice companion
- LiveKit (`@livekit/react-native`, `livekit-client`, WebRTC) — real-time voice transport for the companion calls
- `expo-audio`, `expo-camera`, `expo-notifications` and the rest of the Expo SDK 58 toolkit — soundscapes/activities, local camera preview, reminders

**Clinician portal — web** (`portal/`)
- Next.js 16, React 19, TypeScript

**Backend API** (`backend/`)
- Python 3.12, FastAPI, Uvicorn
- SQLAlchemy (async) + asyncpg over PostgreSQL
- WeasyPrint + Jinja2 — generated PDF reports for therapists
- PyJWT — verifying Supabase-issued session tokens

**Platform & infrastructure**
- PostgreSQL (Tiger Data) — patient, activity and report storage
- Supabase — authentication
- Docker, deployed via Aiven Runtime
- GitHub Actions — CI (contract checks, lint, typecheck, pytest, container smoke tests)
- uv (Python) and npm workspaces (mobile/portal) — dependency management

---

# Developer foundation

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
