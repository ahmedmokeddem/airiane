import { mode, request } from '../../integration/api';
import { uuid } from '../../integration/runtime';
import type { DTO } from '../../integration/types';
import type {
  InsightDimension,
  InsightEvidence,
  InsightReportPayload,
  InsightReportResponse,
} from './types';

interface ChatMessage {
  role: string;
  text: string;
}

const evidence = (
  messageId: string,
  text: string,
  eventAt: string,
): InsightEvidence => ({
  message_id: messageId,
  session_id: 'mock-session',
  event_at: eventAt,
  speaker: 'patient',
  quote: text.slice(0, 300),
});

const RULES: { key: string; label: string; pattern: RegExp }[] = [
  { key: 'emotional', label: 'Emotional experiences', pattern: /\b(sad|down|depressed|hopeless|upset|cry|frustrated|overwhelmed)\b/i },
  { key: 'interest', label: 'Interest and motivation', pattern: /\b(no interest|lost interest|no motivation|stopped doing|don't enjoy)\b/i },
  { key: 'energy', label: 'Energy and physical experiences', pattern: /\b(tired|exhausted|no energy|fatigue|drained)\b/i },
  { key: 'sleep_appetite', label: 'Sleep and appetite', pattern: /\b(sleep|insomnia|appetite|eating|overeating)\b/i },
  { key: 'cognitive', label: 'Cognitive experiences', pattern: /\b(concentrate|focus|decision|remember|forget)\b/i },
  { key: 'self_perception', label: 'Self-perception', pattern: /\b(failure|worthless|guilty|blame myself|ashamed)\b/i },
  { key: 'social', label: 'Social interaction', pattern: /\b(isolated|lonely|alone|friends|family|withdrew)\b/i },
  { key: 'anxiety', label: 'Anxiety-related experiences', pattern: /\b(anxious|worry|nervous|panic|restless)\b/i },
];
const FUNCTIONING = { key: 'functioning', label: 'Daily functioning', pattern: /\b(work|school|studies|chores|responsibilities|daily tasks)\b/i };
const POSITIVE = { key: 'positive', label: 'Positive experiences and support', pattern: /\b(better|helped|support|friend|walk|breathing|calm|hope|relaxed)\b/i };
const SAFETY = { key: 'safety', label: 'Safety-related information', pattern: /\b(kill myself|suicide|suicidal|better off dead|hurt myself|self[- ]?harm|want to die)\b/i };

const dimension = (
  label: string,
  key: string,
  pattern: RegExp,
  messages: ChatMessage[],
  eventAt: string,
  prefix: string,
): InsightDimension => {
  const patient = messages
    .map((message, index) => ({ ...message, index }))
    .filter(message => message.role === 'user');
  const hits = patient.filter(message => pattern.test(message.text));
  return {
    key,
    label,
    status: patient.length === 0
      ? 'insufficient_information'
      : hits.length === 0
        ? 'not_assessed'
        : hits.length >= 2
          ? 'observed_pattern'
          : 'user_reported',
    count: hits.length,
    first_seen: hits.length ? eventAt : null,
    last_seen: hits.length ? eventAt : null,
    evidence: hits.slice(0, 4).map(message =>
      evidence(`${prefix}-${message.index}`, message.text, eventAt),
    ),
    note: messageNote(patient.length, hits.length),
  };
};

const messageNote = (patientCount: number, hitCount: number) => {
  if (patientCount === 0) return 'No patient messages were available to review.';
  if (hitCount === 0) return 'The patient did not explicitly mention this area.';
  return hitCount >= 2
    ? 'Two or more patient messages explicitly referenced this area.'
    : 'One patient message explicitly referenced this area.';
};

/** A deterministic local preview used when the app is in mock mode. */
export function buildMockInsightReport(messages: ChatMessage[]): InsightReportResponse {
  const now = new Date().toISOString();
  const prefix = uuid();
  const dimensions = RULES.map(rule =>
    dimension(rule.label, rule.key, rule.pattern, messages, now, prefix),
  );
  const functional = dimension(
    FUNCTIONING.label,
    FUNCTIONING.key,
    FUNCTIONING.pattern,
    messages,
    now,
    prefix,
  );
  const positive = dimension(
    POSITIVE.label,
    POSITIVE.key,
    POSITIVE.pattern,
    messages,
    now,
    prefix,
  );
  const safety = dimension(
    SAFETY.label,
    SAFETY.key,
    SAFETY.pattern,
    messages,
    now,
    prefix,
  );
  const patientCount = messages.filter(message => message.role === 'user').length;
  const gaps = [...dimensions, functional, positive]
    .filter(item => item.status === 'not_assessed' || item.status === 'insufficient_information')
    .map(item => item.label);
  const report: InsightReportPayload = {
    schema_version: 'conversation-insight/v1',
    report_id: prefix,
    generated_at: now,
    patient_id: 'mock-patient',
    coverage: {
      session_id: 'mock-session',
      message_count: messages.length,
      patient_message_count: patientCount,
      assistant_message_count: messages.length - patientCount,
      period_start: now,
      period_end: now,
    },
    assessments: {
      phq9: null,
      bdi_ii: null,
      note: 'Mock mode: no persisted questionnaire results are available.',
    },
    dimensions,
    functional_impact: functional,
    positive_experiences: positive,
    safety: {
      present: safety.count > 0,
      evidence_type: safety.status,
      evidence: safety.evidence,
      message: safety.count > 0
        ? 'Safety-related language was present. This preview does not classify risk or replace the existing safety workflow.'
        : 'No explicit safety-related language was found in the current conversation.',
    },
    information_gaps: gaps,
    follow_up_suggestions: gaps.slice(0, 5).map(label => `Ask whether the patient has noticed changes related to ${label.toLowerCase()}.`),
    limitations: [
      'Mock mode: generated locally from the current in-app conversation only.',
      'This is not a diagnosis, risk classification or treatment recommendation.',
      'Assistant messages are not treated as patient-reported evidence.',
      'This report does not combine PHQ-9 and BDI-II scores.',
    ],
    consent: {
      analysis_consent: true,
      sharing_status: 'private_draft',
      recipient_care_link_id: null,
      shared_at: null,
    },
  };
  return {
    report_id: prefix,
    patient_id: 'mock-patient',
    session_id: 'mock-session',
    status: 'private_draft',
    schema_version: report.schema_version,
    created_at: now,
    shared_at: null,
    recipient_care_link_id: null,
    report,
  };
}

export async function createInsightReport(
  sessionId: string,
  messages: ChatMessage[],
): Promise<InsightReportResponse> {
  if (mode === 'mock') return buildMockInsightReport(messages);
  const eventAt = new Date().toISOString();
  const turns = messages.slice(-100).map(message => ({
    message_id: uuid(),
    session_id: sessionId,
    speaker: message.role === 'user' ? 'patient' : 'assistant',
    text: message.text,
    event_at: eventAt,
    channel: 'typed_text',
  }));
  return request<InsightReportResponse>('/insight-reports', {
    session_id: sessionId,
    messages: turns,
    consent_to_analyze: true,
  });
}

export async function careLinks(): Promise<DTO<'CareLink'>[]> {
  if (mode === 'mock') return [];
  return (await request<DTO<'CareLinkPage'>>('/care-links')).items;
}

export async function shareInsightReport(
  reportId: string,
  careLinkId: string,
): Promise<InsightReportResponse> {
  if (mode === 'mock') {
    throw new Error('Connect a therapist in live mode before sharing.');
  }
  return request<InsightReportResponse>(`/insight-reports/${reportId}/share`, {
    care_link_id: careLinkId,
    consent: true,
  });
}

export async function revokeInsightReport(reportId: string): Promise<InsightReportResponse> {
  if (mode === 'mock') {
    throw new Error('Mock reports are local only.');
  }
  return request<InsightReportResponse>(`/insight-reports/${reportId}/revoke`, {});
}
