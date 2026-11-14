# Conversation persistence and report visual review

Artifact: `docs/architecture.html`

SHA-256: `98651e972275da4c9a5fb879384b730024a89d4ebd9a97180c043fb42b086375`

Inspected the final 1440×900 dark capture. Conversation Service and Observation Extraction are explicit logical modules inside Application Services and the unified FastAPI Backend. The diagram shows Gemini transcription events through the bridge and authenticated API, opt-in history and summaries, confirmed facts and revisions, completion/feedback/assessment storage, PostgreSQL reads by Report Service, factual JSON output and authorized client delivery. The default no-media-storage rule, source references and patient correction behavior are documented in the accompanying cards and specification.

Automated validation, artifact checks and browser checks passed. Remaining routed crossings are resolved as distinct paths, not junctions. The placement-only alternative was rejected and the passing layout retained. No new database, microservice, PDF generation or report file export was added.
