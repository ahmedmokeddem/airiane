-- Preserve PR #10's stronger reminder schema after the existing 0005 table creation.
BEGIN;
ALTER TABLE re.medication_reminders
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ADD CONSTRAINT medication_reminders_message_length_check
    CHECK (length(btrim(message)) BETWEEN 1 AND 500);
ALTER TABLE re.medication_reminders
  DROP CONSTRAINT medication_reminders_clinician_id_fkey,
  ADD CONSTRAINT medication_reminders_clinician_id_fkey
    FOREIGN KEY (clinician_id) REFERENCES re.clinician_profiles(clinician_id);
CREATE INDEX medication_reminders_patient_active_idx
  ON re.medication_reminders(patient_id) WHERE active = true;
COMMENT ON TABLE re.medication_reminders IS 'Doctor-set reminder shown on the patient Home only while the care link stays active; get/set is restricted to the connected pair.';
COMMIT;
