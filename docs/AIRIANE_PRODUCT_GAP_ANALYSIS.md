# AIriane product gap analysis

14 November 2026. Reviewed the original DESIGN.md, every screen state in code.html, screen.png, frontend/architecture/status documents, canonical API/tool schemas, mobile/portal code and both official SVG logos before implementation. Existing voice/audio integration is retained.

| Screen | Original Stitch | Existing gap | Upgrade |
| --- | --- | --- | --- |
| Welcome/onboarding | Ivory introduction, horizontal identity, living companion | Plain sign-in form | Exact AIriane mark, calm welcome, accessible sign-in and truthful privacy information |
| Home | Greeting, navy companion anchor, paired actions, gentle invitations, Journey teaser | Navigation buttons and unstructured content | Real bottom destinations, branded living hero, real catalog and accepted-record counts |
| Companion/text | Compact header/voice shortcut, differentiated bubbles, pinned composer | Entire page/composer scrolls | Keyboard-aware chat, fixed composer, actual messages and tool cards |
| Voice | Immersive navy orb, PiP, floating controls | Recently verified | Preserve provider/session/routing/camera implementation; change visible name only |
| Activities | Editorial catalog, categories and compact actions | No dedicated catalog screen | Real eligible activities and backend recommendation-backed starts; no fictional playable entries |
| Journey | Animated constellation and chronology with detail | Plain completed-activity list | Real dated milestones, animated paths/nodes, selection details and honest empty state |
| Reports | Structured factual dossier and evidence | Sparse counts | Confirmed observations, coverage, factual overview, date/source details and sufficient-data trends |
| Profile/settings/privacy | Identity, preferences, motion controls, care links | Sharing controls only | Owned profile, privacy/confirmation/deletion, motion preferences and sharing entry points |
| Doctor portal | Horizontal identity and dense report | Minimal authorized report | Exact asset, structured factual evidence, chart thresholds and preserved authorization/revocation |

Prototype demo claims about treatment stages, neuroplasticity, recovery scores and fictional clinician identity will not be copied. Only actual accepted records contribute to counts/milestones/reports.

The official wordmark contains live Inter text. Raster exports must load Inter rather than substitute a local font. Original SVG shapes, colors, viewboxes and typography remain untouched. Dark surfaces use a contrasting plate rather than recoloring the logo.

Shared architecture stays one FastAPI application/PostgreSQL, Expo mobile, Next.js portal and provider-independent ElevenLabs adapter. Natural-language insight confirmation uses an additive shared contract; model proposals remain transient until a patient explicitly approves them. No new microservice or V1 Gemini dependency.
