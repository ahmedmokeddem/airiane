BEGIN;
-- Private generated definitions project into inactive existing catalogue rows.
CREATE TABLE re.activity_generation_grants (
 id uuid PRIMARY KEY REFERENCES re.conversation_sessions(id),
 patient_id uuid NOT NULL REFERENCES re.users(id),
 allowed boolean NOT NULL DEFAULT false,
 reserved_calls integer NOT NULL DEFAULT 0 CHECK (reserved_calls BETWEEN 0 AND 6),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_generation_grants_patient ON re.activity_generation_grants(patient_id);
CREATE TABLE re.activity_generation_jobs (
 id uuid PRIMARY KEY,
 patient_id uuid NOT NULL REFERENCES re.users(id),
 session_id uuid NOT NULL REFERENCES re.conversation_sessions(id),
 request_key uuid NOT NULL,
 request_hash text NOT NULL,
 state text NOT NULL CHECK (state IN ('generating','ready','fallback','cancelled')),
 recommendation_id uuid REFERENCES re.recommendations(id),
 reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(patient_id, session_id, request_key)
);
CREATE INDEX activity_generation_jobs_owner ON re.activity_generation_jobs(patient_id,session_id);
CREATE TABLE re.generated_activity_definitions (
 id uuid PRIMARY KEY REFERENCES re.activity_catalog(id),
 patient_id uuid NOT NULL REFERENCES re.users(id),
 session_id uuid NOT NULL REFERENCES re.conversation_sessions(id),
 recommendation_id uuid NOT NULL REFERENCES re.recommendations(id),
 definition jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('proposed','declined','accepted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generated_activity_definitions_owner ON re.generated_activity_definitions(patient_id,session_id);
CREATE TABLE re.generated_activity_progress (
 id uuid PRIMARY KEY REFERENCES re.activity_sessions(id),
 patient_id uuid NOT NULL REFERENCES re.users(id),
 step integer NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 8),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 paused boolean NOT NULL DEFAULT false,
 confirmed boolean NOT NULL DEFAULT false,
 last_hash text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generated_activity_progress_owner ON re.generated_activity_progress(patient_id);

COMMIT;
