-- RE:SONANCE planned PostgreSQL 16+ baseline. NOT applied; no application code.
-- Execute only in a disposable empty database after review; not an upgrade migration.
BEGIN;
CREATE SCHEMA re;
REVOKE ALL ON SCHEMA re FROM PUBLIC;
SET LOCAL search_path = re, pg_catalog;

-- Trusted role mapping; auth_subject is Supabase JWT sub, never user-editable role metadata.
CREATE TABLE re.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('patient','clinician')),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE re.users IS 'Trusted role mapping; auth_subject is Supabase JWT sub, never user-editable role metadata.';

-- Patient-owned profile; application validates IANA timezone and bounded preference/avatar keys.
CREATE TABLE re.patient_profiles (
  patient_id uuid PRIMARY KEY REFERENCES re.users(id),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  timezone text NOT NULL DEFAULT 'UTC',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(preferences) = 'object'),
  avatar jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(avatar) = 'object')
);
COMMENT ON TABLE re.patient_profiles IS 'Patient-owned profile; application validates IANA timezone and bounded preference/avatar keys.';

-- Manual verification only; no public endpoint can grant clinician role or verification.
CREATE TABLE re.clinician_profiles (
  clinician_id uuid PRIMARY KEY REFERENCES re.users(id),
  display_name text NOT NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES re.users(id)
);
COMMENT ON TABLE re.clinician_profiles IS 'Manual verification only; no public endpoint can grant clinician role or verification.';

-- Patient creates invitation for a known verified clinician; target accepts. Re-invitation reuses the pair with audited state change.
CREATE TABLE re.care_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  clinician_id uuid NOT NULL REFERENCES re.clinician_profiles(clinician_id),
  state text NOT NULL CHECK (state IN ('pending','active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (patient_id,clinician_id)
);
COMMENT ON TABLE re.care_links IS 'Patient creates invitation for a known verified clinician; target accepts. Re-invitation reuses the pair with audited state change.';

-- Retention consent is separate from doctor sharing. Never use a time-dependent partial index for expiry; compare now() in authorized reads.
CREATE TABLE re.consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  care_link_id uuid,
  scope text NOT NULL CHECK (scope IN ('transcripts','reports','alerts')),
  expires_at timestamptz NOT NULL,
  data_from timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  FOREIGN KEY (care_link_id,patient_id) REFERENCES re.care_links(id,patient_id),
  CHECK ((scope = 'transcripts' AND care_link_id IS NULL AND data_from IS NULL) OR (scope IN ('reports','alerts') AND care_link_id IS NOT NULL)),
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
COMMENT ON TABLE re.consent_grants IS 'Retention consent is separate from doctor sharing. Never use a time-dependent partial index for expiry; compare now() in authorized reads.';

-- Fictional plan context; not an autonomous treatment prescription.
CREATE TABLE re.recovery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(content) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE re.recovery_plans IS 'Fictional plan context; not an autonomous treatment prescription.';

-- Application state survives provider connections. Never store provider credentials or resumption handles here.
CREATE TABLE re.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  state text NOT NULL CHECK (state IN ('created','active','interrupted','ended')),
  mode text NOT NULL CHECK (mode IN ('voice','text')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  guided_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(guided_state) = 'object'),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  CHECK ((state = 'ended') = (ended_at IS NOT NULL))
);
COMMENT ON TABLE re.conversation_sessions IS 'Application state survives provider connections. Never store provider credentials or resumption handles here.';

-- V1 ElevenLabs transport epochs under one provider-independent application session. Opaque provider ID is not authority. Never store tokens, signed URLs, images, camera state or media. Future Gemini requires an explicit V2 schema revision.
CREATE TABLE re.provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = 'elevenlabs'),
  mode text NOT NULL CHECK (mode IN ('voice','text')),
  transport text NOT NULL CHECK (transport IN ('webrtc','websocket')),
  state text NOT NULL CHECK (state IN ('created','connecting','active','interrupted','closed')),
  connection_epoch integer NOT NULL CHECK (connection_epoch > 0),
  context_version integer NOT NULL CHECK (context_version > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  provider_conversation_id text,
  connect_before timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (id,session_id,connection_epoch,patient_id),
  UNIQUE (session_id,connection_epoch),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  CHECK ((mode = 'voice' AND transport = 'webrtc') OR (mode = 'text' AND transport = 'websocket')),
  CHECK ((state = 'closed') = (closed_at IS NOT NULL))
);
COMMENT ON TABLE re.provider_connections IS 'V1 ElevenLabs transport epochs under one provider-independent application session. Opaque provider ID is not authority. Never store tokens, signed URLs, images, camera state or media. Future Gemini requires an explicit V2 schema revision.';

-- Metadata only; no transcript excerpts, media or credentials. Entities point to a real same-patient source; tombstones mark deleted source availability.
CREATE TABLE re.source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  kind text NOT NULL CHECK (kind IN ('transcript_turn','structured_input','activity_event','feedback','assessment','summary','correction')),
  session_id uuid,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  occurred_at timestamptz NOT NULL,
  unavailable_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (id,patient_id,revision),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id)
);
COMMENT ON TABLE re.source_records IS 'Metadata only; no transcript excerpts, media or credentials. Entities point to a real same-patient source; tombstones mark deleted source availability.';

-- Consent scope/active status requires locked transaction validation at ingestion. Reconcile partial events locally; only final/interrupted utterances accepted.
CREATE TABLE re.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  provider_connection_id uuid NOT NULL,
  session_id uuid NOT NULL,
  consent_grant_id uuid NOT NULL,
  source_id uuid NOT NULL,
  client_message_id uuid NOT NULL,
  turn_id text NOT NULL,
  connection_epoch integer NOT NULL CHECK (connection_epoch > 0),
  sequence integer NOT NULL CHECK (sequence > 0),
  speaker text NOT NULL CHECK (speaker IN ('patient','assistant')),
  channel text NOT NULL CHECK (channel IN ('voice_transcription','typed_text')),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
  finality text NOT NULL CHECK (finality IN ('final','interrupted')),
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (session_id,client_message_id),
  UNIQUE (session_id,connection_epoch,sequence),
  FOREIGN KEY (provider_connection_id,session_id,connection_epoch,patient_id) REFERENCES re.provider_connections(id,session_id,connection_epoch,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (consent_grant_id,patient_id) REFERENCES re.consent_grants(id,patient_id),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id)
);
COMMENT ON TABLE re.conversation_messages IS 'Consent scope/active status requires locked transaction validation at ingestion. Reconcile partial events locally; only final/interrupted utterances accepted.';

-- Derived summary is not a confirmed fact. Without retention consent, use confirmed structured records only.
CREATE TABLE re.session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  basis text NOT NULL CHECK (basis IN ('consented_history','confirmed_records')),
  completeness text NOT NULL CHECK (completeness IN ('complete','partial')),
  text text NOT NULL CHECK (length(text) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (session_id,version),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id)
);
COMMENT ON TABLE re.session_summaries IS 'Derived summary is not a confirmed fact. Without retention consent, use confirmed structured records only.';

-- Normalized source lineage; unavailable text is not reconstructed from references.
CREATE TABLE re.summary_sources (
  summary_id uuid NOT NULL,
  source_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  PRIMARY KEY (summary_id,source_id,source_revision),
  FOREIGN KEY (summary_id,patient_id) REFERENCES re.session_summaries(id,patient_id),
  FOREIGN KEY (source_id,patient_id,source_revision) REFERENCES re.source_records(id,patient_id,revision)
);
COMMENT ON TABLE re.summary_sources IS 'Normalized source lineage; unavailable text is not reconstructed from references.';

-- Only current confirmed rows enter trends; corrections create a new row and supersede old head under a lock.
CREATE TABLE re.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid,
  kind text NOT NULL CHECK (kind IN ('mood','energy','sleep_hours')),
  value numeric(5,2) NOT NULL,
  observed_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('proposed','confirmed','rejected','superseded')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_observation_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (supersedes_observation_id,patient_id) REFERENCES re.observations(id,patient_id),
  CHECK ((kind IN ('mood','energy') AND value BETWEEN 0 AND 10) OR (kind = 'sleep_hours' AND value BETWEEN 0 AND 24)),
  CHECK (state NOT IN ('confirmed','superseded') OR confirmed_at IS NOT NULL),
  CHECK (supersedes_observation_id IS NULL OR supersedes_observation_id <> id)
);
COMMENT ON TABLE re.observations IS 'Only current confirmed rows enter trends; corrections create a new row and supersede old head under a lock.';

-- References explicit structured input, correction event, or a consented patient utterance; no assistant speech evidence.
CREATE TABLE re.observation_sources (
  observation_id uuid NOT NULL,
  source_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  PRIMARY KEY (observation_id,source_id,source_revision),
  FOREIGN KEY (observation_id,patient_id) REFERENCES re.observations(id,patient_id),
  FOREIGN KEY (source_id,patient_id,source_revision) REFERENCES re.source_records(id,patient_id,revision)
);
COMMENT ON TABLE re.observation_sources IS 'References explicit structured input, correction event, or a consented patient utterance; no assistant speech evidence.';

-- Explicitly patient-confirmed preferences. No model-authorized memory mutation.
CREATE TABLE re.patient_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  key text NOT NULL CHECK (key IN ('preferred_activity_kind','preferred_duration_seconds')),
  value jsonb NOT NULL,
  CHECK (jsonb_typeof(value) = 'object'),
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id,key),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id)
);
COMMENT ON TABLE re.patient_memories IS 'Explicitly patient-confirmed preferences. No model-authorized memory mutation.';

-- Immutable versioned catalog rows. Config keys/assets allowlisted; no arbitrary model-generated script or URL.
CREATE TABLE re.activity_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('breathing','nature','behavioral_activation','reflection','social_reconnection')),
  title text NOT NULL,
  description text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 30 AND 1800),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(config) = 'object'),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (id,version),
  UNIQUE (slug,version)
);
COMMENT ON TABLE re.activity_catalog IS 'Immutable versioned catalog rows. Config keys/assets allowlisted; no arbitrary model-generated script or URL.';

-- Current recommendation is latest created_at/id for that session; selection rechecks this and expiry/eligibility.
CREATE TABLE re.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  CHECK (expires_at > created_at)
);
COMMENT ON TABLE re.recommendations IS 'Current recommendation is latest created_at/id for that session; selection rechecks this and expiry/eligibility.';

-- Exact option IDs and order used for both visible cards and speech.
CREATE TABLE re.recommendation_items (
  recommendation_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  activity_id uuid NOT NULL,
  activity_version integer NOT NULL,
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 3),
  reason text NOT NULL,
  PRIMARY KEY (recommendation_id,activity_id),
  UNIQUE (recommendation_id,rank),
  UNIQUE (recommendation_id,activity_id,patient_id),
  FOREIGN KEY (recommendation_id,patient_id) REFERENCES re.recommendations(id,patient_id),
  FOREIGN KEY (activity_id,activity_version) REFERENCES re.activity_catalog(id,version)
);
COMMENT ON TABLE re.recommendation_items IS 'Exact option IDs and order used for both visible cards and speech.';

-- Backend additionally checks recommendation session and offered version match. One active activity per conversation, enforced below.
CREATE TABLE re.activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid NOT NULL,
  recommendation_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  activity_version integer NOT NULL,
  selection_channel text NOT NULL CHECK (selection_channel IN ('voice','touch')),
  state text NOT NULL CHECK (state IN ('started','completed','abandoned')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (recommendation_id,activity_id,patient_id) REFERENCES re.recommendation_items(recommendation_id,activity_id,patient_id),
  FOREIGN KEY (activity_id,activity_version) REFERENCES re.activity_catalog(id,version),
  CHECK ((state = 'started') = (ended_at IS NULL)),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
COMMENT ON TABLE re.activity_sessions IS 'Backend additionally checks recommendation session and offered version match. One active activity per conversation, enforced below.';

-- Events are reported by client, not physiological verification; terminal transitions checked under activity row lock.
CREATE TABLE re.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  activity_session_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  source_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('progress','complete','abandon')),
  elapsed_seconds integer NOT NULL CHECK (elapsed_seconds BETWEEN 0 AND 7200),
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_session_id,client_event_id),
  FOREIGN KEY (activity_session_id,patient_id) REFERENCES re.activity_sessions(id,patient_id),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id)
);
COMMENT ON TABLE re.activity_events IS 'Events are reported by client, not physiological verification; terminal transitions checked under activity row lock.';

-- Only completed activity accepts feedback; backend rule. Comments are patient data, not transcript history.
CREATE TABLE re.activity_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  activity_session_id uuid NOT NULL UNIQUE,
  source_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  FOREIGN KEY (activity_session_id,patient_id) REFERENCES re.activity_sessions(id,patient_id),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id)
);
COMMENT ON TABLE re.activity_feedback IS 'Only completed activity accepts feedback; backend rule. Comments are patient data, not transcript history.';

-- MVP fictional nonclinical wellbeing check-in. No licensed or diagnostic instrument assumed.
CREATE TABLE re.assessment_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  clinical_instrument boolean NOT NULL DEFAULT false CHECK (clinical_instrument = false),
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  UNIQUE (id,version)
);
COMMENT ON TABLE re.assessment_definitions IS 'MVP fictional nonclinical wellbeing check-in. No licensed or diagnostic instrument assumed.';

-- Backend validates exact question IDs, uniqueness, bounds and completeness against pinned version.
CREATE TABLE re.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid,
  assessment_id uuid NOT NULL,
  assessment_version integer NOT NULL,
  source_id uuid NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  complete boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (assessment_id,assessment_version) REFERENCES re.assessment_definitions(id,version),
  FOREIGN KEY (source_id,patient_id) REFERENCES re.source_records(id,patient_id)
);
COMMENT ON TABLE re.assessment_responses IS 'Backend validates exact question IDs, uniqueness, bounds and completeness against pinned version.';

-- Current versioned projection; refresh atomically increments version. Source revisions retained, prior generation metadata audited; no claim that old report payloads are archived.
CREATE TABLE re.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  calculation_version text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','ready','stale','failed')),
  generated_at timestamptz,
  data_cutoff timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  CHECK (period_end > period_start),
  CHECK (state NOT IN ('ready','stale') OR (payload IS NOT NULL AND jsonb_typeof(payload) = 'object' AND generated_at IS NOT NULL AND data_cutoff IS NOT NULL))
);
COMMENT ON TABLE re.reports IS 'Current versioned projection; refresh atomically increments version. Source revisions retained, prior generation metadata audited; no claim that old report payloads are archived.';

-- Report grant does not expose private source bodies; return IDs/availability and only permitted structured content.
CREATE TABLE re.report_sources (
  report_id uuid NOT NULL,
  source_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  PRIMARY KEY (report_id,source_id,source_revision),
  FOREIGN KEY (report_id,patient_id) REFERENCES re.reports(id,patient_id),
  FOREIGN KEY (source_id,patient_id,source_revision) REFERENCES re.source_records(id,patient_id,revision)
);
COMMENT ON TABLE re.report_sources IS 'Report grant does not expose private source bodies; return IDs/availability and only permitted structured content.';

-- Only patient_requested_review enabled for MVP; clinical thresholds remain unapproved and disabled.
CREATE TABLE re.alert_rules (
  rule_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  enabled boolean NOT NULL DEFAULT false,
  definition jsonb NOT NULL,
  CHECK (jsonb_typeof(definition) = 'object'),
  PRIMARY KEY (rule_key,version)
);
COMMENT ON TABLE re.alert_rules IS 'Only patient_requested_review enabled for MVP; clinical thresholds remain unapproved and disabled.';

-- Source IDs are validated against same-patient source_records before use. No notification equals read acknowledgement.
CREATE TABLE re.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  session_id uuid,
  rule_key text NOT NULL,
  rule_version integer NOT NULL,
  dedup_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('open','acknowledged','resolved')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_ids) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,patient_id),
  UNIQUE (patient_id,rule_key,dedup_key),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id),
  FOREIGN KEY (rule_key,rule_version) REFERENCES re.alert_rules(rule_key,version)
);
COMMENT ON TABLE re.alerts IS 'Source IDs are validated against same-patient source_records before use. No notification equals read acknowledgement.';

-- Revalidate active link and alerts grant before visibility and reads; suppress after revocation.
CREATE TABLE re.alert_recipients (
  alert_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  care_link_id uuid NOT NULL,
  consent_grant_id uuid NOT NULL,
  delivery_state text NOT NULL CHECK (delivery_state IN ('pending','visible','suppressed')),
  acknowledged_at timestamptz,
  PRIMARY KEY (alert_id,care_link_id),
  FOREIGN KEY (alert_id,patient_id) REFERENCES re.alerts(id,patient_id),
  FOREIGN KEY (care_link_id,patient_id) REFERENCES re.care_links(id,patient_id),
  FOREIGN KEY (consent_grant_id,patient_id) REFERENCES re.consent_grants(id,patient_id)
);
COMMENT ON TABLE re.alert_recipients IS 'Revalidate active link and alerts grant before visibility and reads; suppress after revocation.';

-- Append-only access/change metadata; no transcripts, values, credentials or report JSON. Runtime lacks UPDATE/DELETE on this table.
CREATE TABLE re.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES re.users(id),
  patient_id uuid REFERENCES re.patient_profiles(patient_id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE re.audit_events IS 'Append-only access/change metadata; no transcripts, values, credentials or report JSON. Runtime lacks UPDATE/DELETE on this table.';

-- Never persist provider credential responses; separate bounded ephemeral cache. Reauthorize before replay; sanitize/remove transcript bodies and private data upon retention changes.
CREATE TABLE re.idempotency_keys (
  actor_id uuid NOT NULL REFERENCES re.users(id),
  method text NOT NULL,
  route text NOT NULL,
  key uuid NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL CHECK (response_status BETWEEN 200 AND 599),
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id,method,route,key)
);
COMMENT ON TABLE re.idempotency_keys IS 'Never persist provider credential responses; separate bounded ephemeral cache. Reauthorize before replay; sanitize/remove transcript bodies and private data upon retention changes.';

-- Allowlisted name and typed args validated in service. Store sanitized resource references; never arbitrary prompt/tool payload logs.
CREATE TABLE re.tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  provider_connection_id uuid NOT NULL,
  session_id uuid NOT NULL,
  tool_call_id text NOT NULL,
  tool_name text NOT NULL,
  contract_version text NOT NULL,
  request_hash text NOT NULL,
  result_resource_id uuid,
  outcome_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_connection_id,tool_call_id),
  FOREIGN KEY (provider_connection_id,patient_id) REFERENCES re.provider_connections(id,patient_id),
  FOREIGN KEY (session_id,patient_id) REFERENCES re.conversation_sessions(id,patient_id)
);
COMMENT ON TABLE re.tool_calls IS 'Allowlisted name and typed args validated in service. Store sanitized resource references; never arbitrary prompt/tool payload logs.';

-- Commit with accepted write. Claim with SKIP LOCKED, fenced lease token and idempotent handlers; resource IDs only, no transcript payload copies.
CREATE TABLE re.outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES re.patient_profiles(patient_id),
  event_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('report_refresh','alert_delivery','session_summary','retention_cleanup')),
  resource_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','done','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE re.outbox_jobs IS 'Commit with accepted write. Claim with SKIP LOCKED, fenced lease token and idempotent handlers; resource IDs only, no transcript payload copies.';

CREATE INDEX fk_clinician_profiles_0_idx ON re.clinician_profiles (verified_by);
CREATE INDEX fk_care_links_1_idx ON re.care_links (clinician_id);
CREATE INDEX fk_consent_grants_2_idx ON re.consent_grants (patient_id);
CREATE INDEX fk_consent_grants_3_idx ON re.consent_grants (care_link_id,patient_id);
CREATE INDEX fk_recovery_plans_4_idx ON re.recovery_plans (patient_id);
CREATE INDEX fk_conversation_sessions_5_idx ON re.conversation_sessions (patient_id);
CREATE INDEX fk_provider_connections_6_idx ON re.provider_connections (patient_id);
CREATE INDEX fk_provider_connections_7_idx ON re.provider_connections (session_id,patient_id);
CREATE INDEX fk_source_records_8_idx ON re.source_records (patient_id);
CREATE INDEX fk_source_records_9_idx ON re.source_records (session_id,patient_id);
CREATE INDEX fk_conversation_messages_10_idx ON re.conversation_messages (patient_id);
CREATE INDEX fk_conversation_messages_11_idx ON re.conversation_messages (provider_connection_id,session_id,connection_epoch,patient_id);
CREATE INDEX fk_conversation_messages_12_idx ON re.conversation_messages (session_id,patient_id);
CREATE INDEX fk_conversation_messages_13_idx ON re.conversation_messages (consent_grant_id,patient_id);
CREATE INDEX fk_conversation_messages_14_idx ON re.conversation_messages (source_id,patient_id);
CREATE INDEX fk_session_summaries_15_idx ON re.session_summaries (patient_id);
CREATE INDEX fk_session_summaries_16_idx ON re.session_summaries (session_id,patient_id);
CREATE INDEX fk_summary_sources_17_idx ON re.summary_sources (patient_id);
CREATE INDEX fk_summary_sources_18_idx ON re.summary_sources (summary_id,patient_id);
CREATE INDEX fk_summary_sources_19_idx ON re.summary_sources (source_id,patient_id,source_revision);
CREATE INDEX fk_observations_20_idx ON re.observations (patient_id);
CREATE INDEX fk_observations_21_idx ON re.observations (session_id,patient_id);
CREATE INDEX fk_observations_22_idx ON re.observations (supersedes_observation_id,patient_id);
CREATE INDEX fk_observation_sources_23_idx ON re.observation_sources (patient_id);
CREATE INDEX fk_observation_sources_24_idx ON re.observation_sources (observation_id,patient_id);
CREATE INDEX fk_observation_sources_25_idx ON re.observation_sources (source_id,patient_id,source_revision);
CREATE INDEX fk_patient_memories_26_idx ON re.patient_memories (source_id,patient_id);
CREATE INDEX fk_recommendations_27_idx ON re.recommendations (patient_id);
CREATE INDEX fk_recommendations_28_idx ON re.recommendations (session_id,patient_id);
CREATE INDEX fk_recommendation_items_29_idx ON re.recommendation_items (patient_id);
CREATE INDEX fk_recommendation_items_30_idx ON re.recommendation_items (recommendation_id,patient_id);
CREATE INDEX fk_recommendation_items_31_idx ON re.recommendation_items (activity_id,activity_version);
CREATE INDEX fk_activity_sessions_32_idx ON re.activity_sessions (patient_id);
CREATE INDEX fk_activity_sessions_33_idx ON re.activity_sessions (session_id,patient_id);
CREATE INDEX fk_activity_sessions_34_idx ON re.activity_sessions (recommendation_id,activity_id,patient_id);
CREATE INDEX fk_activity_sessions_35_idx ON re.activity_sessions (activity_id,activity_version);
CREATE INDEX fk_activity_events_36_idx ON re.activity_events (patient_id);
CREATE INDEX fk_activity_events_37_idx ON re.activity_events (activity_session_id,patient_id);
CREATE INDEX fk_activity_events_38_idx ON re.activity_events (source_id,patient_id);
CREATE INDEX fk_activity_feedback_39_idx ON re.activity_feedback (patient_id);
CREATE INDEX fk_activity_feedback_40_idx ON re.activity_feedback (activity_session_id,patient_id);
CREATE INDEX fk_activity_feedback_41_idx ON re.activity_feedback (source_id,patient_id);
CREATE INDEX fk_assessment_responses_42_idx ON re.assessment_responses (patient_id);
CREATE INDEX fk_assessment_responses_43_idx ON re.assessment_responses (session_id,patient_id);
CREATE INDEX fk_assessment_responses_44_idx ON re.assessment_responses (assessment_id,assessment_version);
CREATE INDEX fk_assessment_responses_45_idx ON re.assessment_responses (source_id,patient_id);
CREATE INDEX fk_reports_46_idx ON re.reports (patient_id);
CREATE INDEX fk_report_sources_47_idx ON re.report_sources (patient_id);
CREATE INDEX fk_report_sources_48_idx ON re.report_sources (report_id,patient_id);
CREATE INDEX fk_report_sources_49_idx ON re.report_sources (source_id,patient_id,source_revision);
CREATE INDEX fk_alerts_50_idx ON re.alerts (session_id,patient_id);
CREATE INDEX fk_alerts_51_idx ON re.alerts (rule_key,rule_version);
CREATE INDEX fk_alert_recipients_52_idx ON re.alert_recipients (patient_id);
CREATE INDEX fk_alert_recipients_53_idx ON re.alert_recipients (alert_id,patient_id);
CREATE INDEX fk_alert_recipients_54_idx ON re.alert_recipients (care_link_id,patient_id);
CREATE INDEX fk_alert_recipients_55_idx ON re.alert_recipients (consent_grant_id,patient_id);
CREATE INDEX fk_audit_events_56_idx ON re.audit_events (actor_id);
CREATE INDEX fk_audit_events_57_idx ON re.audit_events (patient_id);
CREATE INDEX fk_tool_calls_58_idx ON re.tool_calls (patient_id);
CREATE INDEX fk_tool_calls_59_idx ON re.tool_calls (provider_connection_id,patient_id);
CREATE INDEX fk_tool_calls_60_idx ON re.tool_calls (session_id,patient_id);
CREATE INDEX fk_outbox_jobs_61_idx ON re.outbox_jobs (patient_id);
CREATE UNIQUE INDEX observations_one_successor_idx ON re.observations (supersedes_observation_id) WHERE supersedes_observation_id IS NOT NULL;
CREATE INDEX observations_confirmed_period_idx ON re.observations (patient_id,observed_at,id) WHERE state = 'confirmed';
CREATE UNIQUE INDEX activity_one_running_per_session_idx ON re.activity_sessions (session_id) WHERE state = 'started';
CREATE INDEX messages_session_order_idx ON re.conversation_messages (patient_id,session_id,connection_epoch,sequence);
CREATE INDEX reports_patient_period_idx ON re.reports (patient_id,period_start,period_end,id);
CREATE INDEX grants_authorization_idx ON re.consent_grants (patient_id,care_link_id,scope,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX summaries_session_version_idx ON re.session_summaries (patient_id,session_id,version DESC);
CREATE INDEX recommendations_session_current_idx ON re.recommendations (session_id,created_at DESC,id DESC);
CREATE INDEX jobs_claim_idx ON re.outbox_jobs (available_at,id) WHERE state = 'pending';
CREATE INDEX jobs_expired_lease_idx ON re.outbox_jobs (lease_until,id) WHERE state = 'running';
CREATE UNIQUE INDEX consent_one_transcript_grant_idx ON re.consent_grants (patient_id) WHERE scope = 'transcripts' AND revoked_at IS NULL;
CREATE UNIQUE INDEX consent_one_shared_scope_idx ON re.consent_grants (patient_id,care_link_id,scope) WHERE care_link_id IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX provider_one_active_connection_idx ON re.provider_connections (session_id) WHERE state IN ('created','connecting','active');
CREATE INDEX idempotency_expiry_idx ON re.idempotency_keys (expires_at);
CREATE INDEX audit_patient_time_idx ON re.audit_events (patient_id,created_at,id);
REVOKE ALL ON ALL TABLES IN SCHEMA re FROM PUBLIC;
-- Runtime and migration roles are provisioned separately by the database operator.
-- No RLS or Supabase auth.uid() is assumed on this separate Tiger Data database.
COMMIT;
