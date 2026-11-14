-- Doctor-set medication reminder shown on the patient's Home while the connection stays active.
-- One reminder per patient/clinician pair; a repeat set overwrites the existing row. Additive:
-- no existing data is changed. Apply once after 0001 (and 0002, 0003):
BEGIN;
CREATE TABLE re.medication_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  clinician_id uuid NOT NULL REFERENCES re.clinician_profiles(clinician_id),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 500),
  schedule_time text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id,clinician_id)
);
CREATE INDEX medication_reminders_patient_active_idx ON re.medication_reminders(patient_id) WHERE active = true;
REVOKE ALL ON re.medication_reminders FROM PUBLIC;
COMMENT ON TABLE re.medication_reminders IS 'Doctor-set reminder shown on the patient Home only while the care link stays active; get/set is restricted to the connected pair.';
COMMIT;
