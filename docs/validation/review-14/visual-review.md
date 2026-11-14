# Unified Application Services and authorization review

Artifact: `docs/architecture.html`

SHA-256: `ba0177e6ef844fff7cffb2e658dc48f81bd29c51523f64590403df2e23814eda`

Inspected the final 1440×900 dark capture. One Application Services container wraps Patient Context & Activities, Conversation Service, Observation Extraction, Care Link & Consent Check and Report Service, all inside one FastAPI Backend. The former duplicate application-services node now names the existing context/activity responsibilities.

The clinician request is explicitly Doctor Portal → FastAPI → Care Link & Consent Check → Report Service → PostgreSQL. Database result and JSON response directions remain separate. The check handles patient ownership or an active authorized clinician relationship. There is no direct API-to-Report request edge bypassing the check. Transcript opt-in, source-linked summaries/facts, confirmations/corrections and factual JSON report aggregation remain.

Automated validation, artifact checks and browser checks passed. Remaining route crossings are visually resolved as distinct paths, not junctions. A placement-only alternative was rejected; existing layout and dark neon design were preserved. No new microservice, database or PDF/report export was introduced.
