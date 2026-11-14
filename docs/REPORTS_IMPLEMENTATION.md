# Evidence-grounded reports and private PDF export

Implemented 14 November 2026 using the existing stack. No OpenAI, Nemotron or other new LLM/provider is installed or called. The existing ElevenLabs conversation and patient-confirmed note workflow are retained. No migration is required: new documents are stored in the existing PostgreSQL report JSON payload.

## Data and narrative contract

`backend/app/reports/evidence.py` aggregates owned, traceable completed activities, explicit feedback, current confirmed notes, confirmed numeric values and complete questionnaire records. Raw transcripts and recordings are not report inputs. Numeric input and validated clinical scoring remain unavailable in the present product; missing data is disclosed. Untraceable legacy rows are not promoted to findings.

`ReportNarrativeGenerator` is a provider-independent interface. Only `DeterministicNarrativeGenerator` is implemented. Version **deterministic-v3.1** produces patient and clinician wording from one stored snapshot. A separate validator recomputes the accepted fact/quotation catalogue and charts; a plausible source ID alone cannot validate invented prose, numbers, quotations or medical claims. Future narrative implementations must pass an explicitly reviewed validation policy; no permissive external-model implementation is included.

The optional `Report.document` contains versioned evidence, dual-perspective claims, sections, charts, lineage and content/snapshot hashes. Existing wire fields, tool version **2.0.0** and baseline SQL remain compatible. Existing reports without a supported document remain readable and require regeneration for export. Regeneration creates a new report ID and increments its predecessor's version; it does not overwrite it.

Comparisons are opt-in at the API (`compare_previous`); the mobile recent-report action explicitly includes the preceding equal-length period. A theme-count comparison requires at least three confirmed notes on two local dates in **each** window. Counts describe reporting, never symptom rates or treatment changes. Numeric charts require three actual points across two local dates, show at most 16 entries and never interpolate missing dates. Explicit helpfulness ratings can describe a recorded preference sample, not establish a permanent preference or clinical benefit.

Every substantive claim references evidence. Methodology and missing-data statements are generated from the same snapshot. Patient-approved interpretations remain distinguished from direct statements. Existing review/edit/confirm/reject/correct/withdraw controls are reused; no automatic conversation recording was introduced.

## Authorization and document lifecycle

- Patient PDF: `GET /v1/reports/{report_id}/pdf?perspective=patient` (optional clinician edition).
- Clinician PDF: `GET /v1/doctor/patients/{patient_id}/reports/{report_id}/pdf` (clinician edition only).
- Both support `disposition=inline|attachment`. Every call authenticates and checks ownership/current clinician permission.
- A comparison's **entire evidence window** is checked for clinician list/read/export access, including sparse prior evidence. Mobile grant text and `data_from` use this earliest boundary.
- Rendering happens off the async request thread, outside a database transaction. `RE_PDF_MAX_CONCURRENT` defaults to one render per application worker (maximum two); excess requests receive retryable `EXPORT_BUSY`. Cancellation retains capacity until the render worker finishes. Input size is bounded by existing report/evidence limits. This is not a distributed job queue or a hard process-level render timeout.
- After rendering, a fresh transaction locks the patient/report and applicable relationship, rechecks current authorization, source availability/revision and document hash, then records content-free export audit metadata. Tests revoke permission or withdraw evidence during rendering and confirm no PDF is delivered.
- Correction/withdrawal invalidates affected stored documents, including documents using only prior-period notes. Narrative snapshots are removed, the non-text `evidence_period_start` boundary is retained so narrower grants cannot reveal stale prior-source metadata, stale export is denied, and a new report is required. Already downloaded copies remain independent.
- PDFs are generated in memory. There is no public storage, permanent download URL or server PDF cache. Responses are private/no-store. Patient text is HTML-escaped; resource fetching accepts only exact embedded application assets and denies external/filesystem resources.

The portal's `/reports/[patientId]/[reportId]/pdf` route forwards the HttpOnly session credential server-side and checks backend authorization on every download. It does not expose the token in a URL or substitute fixtures after denial. Both interfaces explain that downloaded copies cannot be remotely revoked.

## Presentation and native behavior

The server uses **WeasyPrint 70.0**, Jinja escaping, the existing official wordmark raster (derived from `assets/brand/logo/airiane-wordmark.svg`) and the existing licensed Manrope font. A4 documents have an editorial cover, separate patient/clinician language, source-linked sections, conditional charts, evidence index, folios and confidentiality footer. Text is selectable and the PDF includes a structure tree. PDF/UA certification, exhaustive assistive-technology testing and all Unicode scripts are **not** claimed; Latin diacritics/Finnish/Greek extraction was tested.

Mobile **Export PDF** downloads authenticated bytes into app-private cache. **Save / print PDF** opens the operating system's print/save preview. **Share PDF…** separately opens native file sharing; downloading alone never opens a share sheet. Cache files expire after 15 minutes while the process remains alive and old files are swept on the next export. OS termination can defer cleanup; files remain in private cache, subject to OS cache management. Expired references require re-export. Deliberately saved/shared copies are outside this cache policy.

On web, Export PDF uses a browser download; native print and share controls are hidden. The clinician portal downloads through its same-origin authenticated proxy. Browser checks do not establish native sharing behavior.

## Verification

Four wholly fictional examples were generated and visually inspected: [empty](implementation-validation/reports/examples/empty.pdf), [activities only](implementation-validation/reports/examples/activities.pdf), [confirmed experiences](implementation-validation/reports/examples/confirmed.pdf), and [longitudinal clinician edition](implementation-validation/reports/examples/longitudinal.pdf). The latter includes sufficient prior notes and numeric data for charts. No clinical improvement is inferred. See the [cover/body/chart layout review](implementation-validation/reports/layout-review.jpg). A4/selectable text/structure and Unicode checks are recorded in [pdf-checks.json](implementation-validation/reports/pdf-checks.json).

A new report generated through the actual Android UI was regenerated as version 2, read back from the configured PostgreSQL database, displayed in the clinician portal and exported through both applications. [PostgreSQL metadata](implementation-validation/reports/postgresql.json) contains no report text. Live tests use existing fictional identities and existing grants; no existing sharing permission was revoked for this pass. Revocation, withdrawal and period restrictions are exercised against disposable databases.

See [verification receipt](implementation-validation/reports/verification.json) for final native save/share results and explicit limits. Existing voice/camera code and audio SDK versions were preserved; this report pass does not claim another live conversation or a new Bluetooth/camera audit.

## Reproduce and launch

Use the repository root. Keep the existing backend/Metro/portal if already running.

```sh
uv sync --directory backend
uv run --directory backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
npm --prefix portal run dev
```

WeasyPrint requires native Pango/HarfBuzz/fontconfig libraries. On Debian/Ubuntu, provision `libpango-1.0-0`, `libharfbuzz-subset0`, `libfontconfig1` and suitable Noto fonts (including required scripts) before deployment. Deploy the monorepo assets used by the renderer: `portal/public/brand/airiane-wordmark.png` and `mobile/assets/fonts/Manrope-Regular.ttf`, with their source/license files. No headless browser or external resource server is needed. No hosted SQL migration is required.

Native modules were added at Expo SDK 58-compatible versions through the Expo installer. Expo Go cannot replace the existing development build.

```sh
cd mobile
npx --yes @expo/agent-cli@latest install
ANDROID_HOME="$HOME/Android/Sdk" npx --yes @expo/agent-cli@latest prebuild --platform android --no-clean
ANDROID_HOME="$HOME/Android/Sdk" npx --yes @expo/agent-cli@latest run:android --no-bundler --device SERIAL
adb -s SERIAL reverse tcp:8000 tcp:8000
adb -s SERIAL reverse tcp:8082 tcp:8082
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npx --yes @expo/agent-cli@latest dev --android --device SERIAL --local --dev-client --detach --wait-ready --port 8082 --localhost --json
```

Use the existing fictional development sign-in only in this local development environment. Real production account configuration remains a separate gate. Do not start a second backend on port 8000.

```sh
uv run --directory backend python -m app.reports.examples --output ../docs/implementation-validation/reports/examples
uv run --directory backend python ../scripts/check_contracts.py
uv run --directory backend pytest -q
uv run --directory backend ruff check app tests
uv run --directory backend ruff format --check app tests
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test
npm --prefix portal run typecheck
npm --prefix portal run lint
npm --prefix portal test
npm --prefix portal run build
```

For PostgreSQL regression testing, use a **separate disposable database**, apply 0001 and 0002 there, and set `TEST_DATABASE_URL` before pytest. Never rerun the baseline against the populated cloud service.

## Changed files

- Backend: `app/reports/{evidence,narrative,pdf,routes,examples}.py`, `templates/report.html`, package initializer; existing `reporting.py`, `insights.py`, `care_routes.py`, `main.py`; `tests/test_report_documents.py`; `pyproject.toml`, `uv.lock` and README.
- Contracts: additive schemas/operations in `openapi.yaml`, regenerated `generated/api.ts`, fictional `fixtures/report-document.json` and fixture README. No tool declarations or migrations changed.
- Mobile: `features/reports/{report-document,pdf-export,export-controller}.tsx/ts`, existing `patient-report.tsx`, `reports-sharing.tsx`, `integration/api.ts`, accessible report entry in `product-screens.tsx`, export tests/test runner; SDK-compatible package/lock and sharing config plugin.
- Portal: `components/{report-document,pdf-download}.tsx`, existing `report-view.tsx`, `app/page.tsx`, `globals.css`, protected PDF route and README.
- Documentation: gap assessment, this review, implementation status and fictional verification artifacts.
