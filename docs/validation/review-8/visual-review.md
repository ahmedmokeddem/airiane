# Compact architecture visual review

Artifact: `docs/architecture.html`

SHA-256: `000494a38497ed95566cba090ef3664604b280d7bee62a00ea81ec40c06a0bc6`

Inspected the final 1440×900 dark capture. Gemini Session Bootstrap is inside API Layer; the external credential-service node and its arrows are removed. The bridge explicitly lists tool calls, activity cards, voice/touch selection and UI state. Recommendation retrieval, card rendering and Gemini verbal presentation share backend activity IDs. PostgreSQL is centered directly below Application Services, outside the backend container, and optional Background Jobs are nearby inside it.

The dark neon styling, dotted field, rounded cards, viewer controls and exports remain. Automated validation and browser checks passed with no reported crossings. Authentication, direct media streaming, tool responses, clinician access, persistence and outbox job flows remain. All produced artifacts are documentation.
