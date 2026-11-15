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
- 🛠️ **Installation & developer guide:** [INSTALLATION.md](INSTALLATION.md)

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

For running the project locally, development setup, integration checks and codebase ownership, see [INSTALLATION.md](INSTALLATION.md).
