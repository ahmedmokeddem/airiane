# RE planning and implementation package

Current physical-device commands: [Android verification](DEVICE_VERIFICATION.md).

Current implementation: [status](IMPLEMENTATION_STATUS.md), [integration](INTEGRATION.md), and [developer ownership](DEVELOPMENT_OWNERSHIP.md). The planning documents below describe the target, including features beyond the initial slice.

Read [PRD](PRD.md), [architecture](ARCHITECTURE.md), [API contracts](API_CONTRACTS.md), and [architecture review](ARCHITECTURE_REVIEW.md) first. This is a pre-implementation package: no app scaffolding, dependency installation, service deployment, or database migration was performed.

## Authoritative artifacts

| File | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Scope, personas, requirements, journeys and acceptance criteria. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current implementation blueprint, component/deployment diagrams, decisions and failures. |
| [API_CONTRACTS.md](API_CONTRACTS.md) | Every operation, permissions, semantic rules and canonical schema index. |
| [AGENT_DESIGN.md](AGENT_DESIGN.md) | Live integration, tools, controller, transcription and UI synchronization. |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | SQL ownership, entities, constraints, lifecycle and migration plan. |
| [USER_FLOWS.md](USER_FLOWS.md) | Twelve sequence diagrams and race/failure cases. |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Four developer workstreams, ownership, checkpoints and first slice. |
| [SECURITY.md](SECURITY.md) | Identity, patient authorization, retention and threat model. |
| [TEST_PLAN.md](TEST_PLAN.md) | Future unit/contract/integration/device/E2E tests and gates. |
| [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) | Repository findings, decisions, requirement coverage, risks and readiness. |
| [../contracts/openapi.yaml](../contracts/openapi.yaml) | Canonical HTTP DTO names, fields, enums and operations. |
| [../contracts/tool_contracts.json](../contracts/tool_contracts.json) | Six tool declarations; parameters/results derived from the same schema registry. |
| [../database/schema.sql](../database/schema.sql) | Unapplied PostgreSQL baseline; tables, keys, constraints and indexes. |
| [planning-validation/consistency.json](planning-validation/consistency.json) | Automated document/contract consistency findings and limits. |

The current [overview](architecture.md) and [dark neon diagram](architecture.html) reflect the V1 rollout; the previous diagram/source/overview are retained in archive/before-elevenlabs-*. Design references are unchanged. Uppercase ARCHITECTURE.md is the detailed implementation blueprint. Filenames differ only by case, so this checkout needs a case-sensitive filesystem.

Read [phased rollout](MULTIMODAL_ROLLOUT.md), [frontend specification](FRONTEND_SPEC.md), and [provider verification](PROVIDER_VERIFICATION.md) for the new boundaries and outstanding launch gates. See [adapter contract](../contracts/voice_agent_adapter.json) and [privacy requirements](../contracts/provider_privacy.requirements.json). No runtime or account verification has been performed.
