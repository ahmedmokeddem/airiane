export type InsightEvidenceType =
  | 'user_reported'
  | 'observed_pattern'
  | 'insufficient_information'
  | 'not_assessed';

export interface InsightEvidence {
  message_id: string;
  session_id: string;
  event_at: string;
  speaker: 'patient';
  quote: string;
}

export interface InsightDimension {
  key: string;
  label: string;
  status: InsightEvidenceType;
  count: number;
  first_seen: string | null;
  last_seen: string | null;
  evidence: InsightEvidence[];
  note: string;
}

export interface InsightAssessmentSummary {
  instrument: 'phq9' | 'bdi_themes';
  title: string;
  version: number;
  observed_at: string;
  total: number;
  max_total: number;
  severity: string;
  validated: boolean;
  safety_item_positive: boolean;
}

export interface InsightReportResponse {
  report_id: string;
  patient_id: string;
  session_id: string;
  status: 'private_draft' | 'shared';
  schema_version: string;
  created_at: string;
  shared_at: string | null;
  recipient_care_link_id: string | null;
  report: {
    schema_version: 'conversation-insight/v1';
    report_id: string;
    generated_at: string;
    patient_id: string;
    coverage: {
      session_id: string;
      message_count: number;
      patient_message_count: number;
      assistant_message_count: number;
      period_start: string;
      period_end: string;
    };
    assessments: {
      phq9: InsightAssessmentSummary | null;
      bdi_ii: InsightAssessmentSummary | null;
      note: string;
    };
    dimensions: InsightDimension[];
    functional_impact: InsightDimension;
    positive_experiences: InsightDimension;
    safety: {
      present: boolean;
      evidence_type: InsightEvidenceType;
      evidence: InsightEvidence[];
      message: string;
    };
    information_gaps: string[];
    follow_up_suggestions: string[];
    limitations: string[];
    consent: {
      analysis_consent: boolean;
      sharing_status: 'private_draft' | 'shared';
      recipient_care_link_id: string | null;
      shared_at: string | null;
    };
  };
}
