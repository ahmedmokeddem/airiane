# Four-developer ownership and integration

| Owner | Primary paths | Contract with others |
| --- | --- | --- |
| Frontend | `mobile/src` screens/components, application state, local camera preview | Bridge presents backend activity IDs before tool completion; accepted completion refreshes My Journey. Provider does not own UI state. |
| Backend | `backend`, `database/migrations` | Supabase identity, ownership, versioned writes, idempotency, PostgreSQL persistence. Test real HTTP responses against canonical OpenAPI. |
| Agent | `mobile` voice adapters/bridge and `backend` conversation controller | ElevenLabs private credentials from FastAPI, blocking client tools, same session context, no camera input. Coordinate edits in shared mobile/backend paths before merging. |
| Portal | `portal` | Canonical report projection and active consent authorization through FastAPI. Fictional data remains labeled. |

The frontend/agent share `mobile`; assign screen/state files to frontend and voice adapter/provider files to agent in every PR. The agent's controller changes go through the backend owner. No duplicate controller rules inside the provider prompt.

Every merge must keep the minimal slice running. Start with fixture-backed clients, then switch the same client to FastAPI without changing wire DTOs. Keep mock and API modes explicit. CI validates fixtures, client types/lint/tests and backend contracts/integration. Provider/device credentials are deliberately outside CI; record manual voice/camera/privacy evidence separately. Do not bypass release privacy gates to make a demo look connected.

Integration checkpoints: session → recommendation/cards → breathing start → completion and feedback → accepted My Journey item. Real ElevenLabs audio connects only after account configuration and native build gates pass. Portal report/consent endpoints can remain visibly unavailable in API mode until implemented; fictional mock reports must never masquerade as persisted patient reports.

Existing `docs/design` assets and architecture contracts are preserved. See `IMPLEMENTATION_STATUS.md` for the delivered scope and verification limits; the earlier planning documents describe the target system, not proof that all of it runs.
