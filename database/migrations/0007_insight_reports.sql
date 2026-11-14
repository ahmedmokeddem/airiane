-- Additive isolated storage for patient-owned conversation insight report drafts.
-- Raw conversation histories are not duplicated here; the validated report payload contains
-- bounded evidence quotes and source message references only.
BEGIN;
CREATE TABLE re.insight_reports (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('private_draft','shared')),
  schema_version text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  shared_care_link_id uuid,
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (shared_care_link_id,patient_id) REFERENCES re.care_links(id,patient_id),
  CHECK (period_end >= period_start),
  CHECK ((status = 'shared') = (shared_care_link_id IS NOT NULL AND shared_at IS NOT NULL))
);
COMMENT ON TABLE re.insight_reports IS 'Patient-owned conversation insight drafts. Sharing is explicit, in-app and revocable; no raw transcript copy is stored here.';
CREATE INDEX insight_reports_patient_idx ON re.insight_reports (patient_id, created_at DESC);
CREATE INDEX insight_reports_shared_idx ON re.insight_reports (patient_id, shared_care_link_id) WHERE status = 'shared';
COMMIT;
