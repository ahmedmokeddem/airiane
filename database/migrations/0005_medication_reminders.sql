-- Persist the original-main reminder feature on PostgreSQL as well as SQLite.
BEGIN;
CREATE TABLE re.medication_reminders (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  clinician_id uuid NOT NULL REFERENCES re.users(id),
  message text NOT NULL,
  schedule_time text NOT NULL,
  active boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (patient_id, clinician_id)
);
REVOKE ALL ON re.medication_reminders FROM PUBLIC;
COMMIT;
