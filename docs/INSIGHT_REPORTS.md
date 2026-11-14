# Conversation Insight & Therapist Reporting Agent

Status: implementation note for the isolated `ConversationInsightAgent` added in this branch.

## Scope and isolation

- New backend module: `backend/app/insight_agent.py` (deterministic extraction and JSON report).
- New service/routes: `backend/app/insight_reports.py` (patient drafts, explicit sharing, doctor reads).
- New table/migration: `re.insight_reports` (`database/migrations/0007_insight_reports.sql`).
- New mobile preview/consent screen: `mobile/src/features/insight-reports/`.
- New portal panel: `portal/components/insight-report.tsx`.

The agent does not modify conversations, chatbot prompts, existing reports, alerts, assessments
or the therapist dashboard's existing data flow. Retrieved conversation text is treated as
untrusted data and is never interpreted as instructions.

## Data source

The mobile client submits the current conversation excerpt (bounded to 100 turns) with an
explicit `consent_to_analyze` flag. The backend verifies that the session belongs to the
authenticated patient. The report stores bounded evidence quotes and message references in
`insight_reports.payload`; it does not copy the full transcript into a separate table.

Existing `assessment_responses` rows are read only for the authenticated patient and included as
separate PHQ-9 and BDI-II summaries. Device-only standalone results are not available to the
agent and are reported as unavailable. Scores are never combined or averaged.

## JSON contract

- Version: `conversation-insight/v1`
- Pydantic model: `InsightReportPayload` in `backend/app/insight_agent.py`
- Generated JSON Schema: `contracts/insight-report.schema.json`
- Evidence types: `user_reported`, `observed_pattern`, `insufficient_information`, `not_assessed`
- Every evidence item includes `message_id`, `session_id`, `event_at`, `speaker` and a bounded
  quote.
- The report contains no diagnosis, probability, medication recommendation or unsupported
  symptom classification.

## Consent and authorization

1. `POST /v1/insight-reports` creates a `private_draft` for the authenticated patient.
2. The mobile preview shows the draft and the intended connected therapist.
3. `POST /v1/insight-reports/{id}/share` requires `consent: true` and an active care link owned by
   the patient.
4. `POST /v1/insight-reports/{id}/revoke` returns the report to private.
5. Doctor endpoints require a verified clinician with an active care link and a report shared to
   that link. Revoked links lose access.

No external email or arbitrary-address delivery is implemented.

## Safety

- Safety-related language is separated into `safety` in the report and shown independently of
  the total or any questionnaire score.
- The agent does not classify risk, diagnose or replace the existing safety workflow.
- Assistant messages are coverage metadata only and are never used as patient evidence.
- Prompt-like text in a conversation is quoted as evidence only; it cannot alter extraction.

## Known limitations

- No conversation transcription ingestion is wired into the existing chatbot. The agent
  currently works only from the current conversation excerpt explicitly submitted by the
  mobile client. The existing `conversation_messages` schema is not read or written by this
  feature.
- Standalone PHQ-9/adapted BDI-II results are in-memory on the device; only backend-persisted
  questionnaire records appear in the agent report.
- The agent is deterministic and rule-based. It does not use an LLM; this is intentional for
  auditability and to avoid unsupported clinical claims.
