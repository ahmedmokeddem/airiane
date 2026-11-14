-- Allow screening questionnaires approved by the product owner (PHQ-9 and the extended
-- BDI-II-themed questions from assets/Book1.ods). Scoring stays deterministic in the backend,
-- results are screening information for the patient's clinician and never a diagnosis.
-- Additive: no data is changed. Apply once to a database that already has 0001.
BEGIN;
ALTER TABLE re.assessment_definitions
  DROP CONSTRAINT IF EXISTS assessment_definitions_clinical_instrument_check;
COMMENT ON TABLE re.assessment_definitions IS 'Versioned questionnaires. clinical_instrument marks product-owner-approved screening instruments; scoring is deterministic in the backend and is not a diagnosis.';
-- A positive Q9 sends the questionnaire to connected doctors (the patient is told before
-- starting), so that delivery is not tied to a separate alerts consent grant.
ALTER TABLE re.alert_recipients ALTER COLUMN consent_grant_id DROP NOT NULL;
COMMIT;
