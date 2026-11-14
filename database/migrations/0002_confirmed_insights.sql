BEGIN;
-- Only patient-approved short structured summaries; rejected/transient proposals never enter SQL.
CREATE TABLE re.confirmed_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid,
  theme text NOT NULL CHECK (theme IN ('fatigue','sleep','positive_experience','concern','clinician_question','reflection','goal')),
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  observed_at timestamptz NOT NULL,
  statement_kind text NOT NULL CHECK (statement_kind IN ('direct_statement','patient_approved_interpretation')),
  confirmed_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('confirmed','superseded','deleted')),
  version integer NOT NULL CHECK (version > 0),
  supersedes_insight_id uuid,
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (supersedes_insight_id,patient_id) REFERENCES re.confirmed_insights(id,patient_id),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id),
  CHECK (supersedes_insight_id IS NULL OR supersedes_insight_id <> id),
  CHECK (confirmed_at >= created_at)
);
CREATE UNIQUE INDEX confirmed_insights_one_successor_idx ON re.confirmed_insights(supersedes_insight_id) WHERE supersedes_insight_id IS NOT NULL;
CREATE INDEX confirmed_insights_patient_period_idx ON re.confirmed_insights(patient_id,observed_at,id) WHERE state='confirmed';
CREATE INDEX confirmed_insights_source_idx ON re.confirmed_insights(source_id,patient_id);
CREATE INDEX confirmed_insights_session_idx ON re.confirmed_insights(session_id,patient_id);
REVOKE ALL ON re.confirmed_insights FROM PUBLIC;
COMMENT ON TABLE re.confirmed_insights IS 'Explicit patient-approved structured summaries only; no raw transcript. Corrections retain approved prior versions until deletion scrubs the whole lineage and affected stored reports.';
COMMIT;
