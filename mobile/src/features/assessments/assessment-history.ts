export type AssessmentHistoryType = 'PHQ-9' | 'BDI-II-adapted';

export interface AssessmentHistoryEntry {
  assessmentId: string;
  completedAt: string;
  totalScore: number;
  maxScore: number;
  severity: string;
  preliminaryLabel?: string;
}

export type AssessmentHistory = Record<AssessmentHistoryType, AssessmentHistoryEntry[]>;

export function emptyAssessmentHistory(): AssessmentHistory {
  return { 'PHQ-9': [], 'BDI-II-adapted': [] };
}

/** Keep a bounded, in-memory session history; no assessment data is persisted here. */
export function appendAssessmentHistory(
  history: AssessmentHistory,
  type: AssessmentHistoryType,
  entry: AssessmentHistoryEntry,
): AssessmentHistory {
  return {
    ...history,
    [type]: [entry, ...history[type]].slice(0, 20),
  };
}

export function latestAssessment(
  history: AssessmentHistory,
  type: AssessmentHistoryType,
): AssessmentHistoryEntry | undefined {
  return history[type][0];
}
