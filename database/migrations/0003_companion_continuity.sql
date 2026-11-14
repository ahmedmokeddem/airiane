BEGIN;
CREATE TABLE re.companion_state (
 id uuid PRIMARY KEY REFERENCES re.patient_profiles(patient_id),
 patient_id uuid NOT NULL UNIQUE REFERENCES re.patient_profiles(patient_id),
 relationship_status text NOT NULL CHECK (relationship_status IN ('new','returning','unknown')),
 memory_enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL
);
CREATE TABLE re.daily_checkins (
 id uuid PRIMARY KEY,
 patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
 local_day text NOT NULL CHECK (local_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 timezone text NOT NULL,
 state text NOT NULL CHECK (state IN ('available','declined','completed')),
 offered_at timestamptz,
 completed_at timestamptz,
 version integer NOT NULL CHECK (version > 0),
 UNIQUE(patient_id,local_day)
);
CREATE INDEX daily_checkins_patient_state_idx ON re.daily_checkins(patient_id,state);
REVOKE ALL ON re.companion_state,re.daily_checkins FROM PUBLIC;
COMMENT ON TABLE re.companion_state IS 'Backend-owned relationship marker and explicit patient opt-in for reuse of confirmed records. No raw transcripts.';
COMMENT ON TABLE re.daily_checkins IS 'One optional patient-local-day check-in. Serializes through patient profile lock; values persist as confirmed observations only after explicit UI confirmation.';
COMMIT;
