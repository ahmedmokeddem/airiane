/**
 * The independent PHQ-9 assessment domain object and the pure form state used by the UI.
 *
 * No result is persisted or transmitted from this module. The completed assessment stays in
 * memory so sensitive self-reported mental health data is not written to an unrelated table,
 * an unencrypted store or a model conversation record.
 */

import {
  PHQ9_QUESTIONS,
  PHQ9_QUESTION_IDS,
  type PHQ9Question,
  type PHQ9QuestionId,
  type PHQ9ResponseValue,
  type PHQ9Severity,
} from './phq9-config';
import {
  isPHQ9ResponseValue,
  scorePHQ9,
  validatePHQ9Answers,
  type PHQ9AnswerInput,
} from './phq9-scoring';

export type PHQ9Answers = Partial<Record<PHQ9QuestionId, PHQ9ResponseValue>>;

export interface PHQ9Response {
  questionId: PHQ9QuestionId;
  score: PHQ9ResponseValue;
}

export interface PHQ9SharingPreferences {
  /** This isolated feature never shares an assessment automatically. */
  shareWithTherapist: false;
}

export interface PHQ9Assessment {
  assessmentId: string;
  userId: string | null;
  assessmentType: 'PHQ-9';
  completedAt: string;
  responses: PHQ9Response[];
  totalScore: number;
  severity: PHQ9Severity;
  q9SafetyFlag: boolean;
  completionStatus: 'complete';
  sharing: PHQ9SharingPreferences;
}

export type PHQ9FormStatus = 'editing' | 'complete';

export interface PHQ9FormState {
  answers: PHQ9Answers;
  /** True after the patient has pressed “See my result” at least once. */
  attempted: boolean;
  status: PHQ9FormStatus;
  assessment: PHQ9Assessment | null;
  error: string | null;
}

export type PHQ9Action =
  | { type: 'select'; questionId: PHQ9QuestionId; value: number }
  | {
      type: 'submit';
      assessmentId: string;
      completedAt: string;
      userId?: string | null;
    }
  | { type: 'reset' };

export const NO_SHARING: PHQ9SharingPreferences = { shareWithTherapist: false };

export function createPHQ9FormState(): PHQ9FormState {
  return {
    answers: {},
    attempted: false,
    status: 'editing',
    assessment: null,
    error: null,
  };
}

export function phq9Reducer(state: PHQ9FormState, action: PHQ9Action): PHQ9FormState {
  switch (action.type) {
    case 'select':
      return selectPHQ9Answer(state, action.questionId, action.value);
    case 'submit':
      return submitPHQ9(state, action);
    case 'reset':
      return createPHQ9FormState();
    default:
      return state;
  }
}

/**
 * Record one answer. Selecting a different option for the same question replaces the old
 * value, so each question always has at most one answer.
 */
export function selectPHQ9Answer(
  state: PHQ9FormState,
  questionId: PHQ9QuestionId,
  value: number,
): PHQ9FormState {
  if (state.status !== 'editing') return state;
  if (!PHQ9_QUESTION_IDS.includes(questionId) || !isPHQ9ResponseValue(value)) {
    return {
      ...state,
      error: 'That answer is not valid. Choose 0, 1, 2 or 3.',
    };
  }
  return {
    ...state,
    answers: { ...state.answers, [questionId]: value },
    error: null,
  };
}

export function answeredPHQ9Count(answers: PHQ9AnswerInput): number {
  return PHQ9_QUESTION_IDS.filter(id => isPHQ9ResponseValue(answers[id])).length;
}

export function unansweredPHQ9Questions(answers: PHQ9AnswerInput): PHQ9Question[] {
  return PHQ9_QUESTIONS.filter(question => !isPHQ9ResponseValue(answers[question.id]));
}

export function phq9Progress(state: PHQ9FormState): {
  answered: number;
  total: number;
  label: string;
  percent: number;
} {
  const total = PHQ9_QUESTIONS.length;
  const answered = answeredPHQ9Count(state.answers);
  return {
    answered,
    total,
    label: `${answered} / ${total} completed`,
    percent: Math.round((answered / total) * 100),
  };
}

export function isPHQ9Complete(answers: PHQ9AnswerInput): boolean {
  return validatePHQ9Answers(answers).valid;
}

/**
 * Build the completed domain object. This is only called after validation, so an
 * incomplete answer set can never become an assessment or a severity category.
 */
export function buildPHQ9Assessment(
  answers: PHQ9Answers,
  options: { assessmentId: string; completedAt: string; userId?: string | null },
): PHQ9Assessment {
  const score = scorePHQ9(answers);
  return {
    assessmentId: options.assessmentId,
    userId: options.userId ?? null,
    assessmentType: 'PHQ-9',
    completedAt: options.completedAt,
    responses: PHQ9_QUESTIONS.map(question => ({
      questionId: question.id,
      score: answers[question.id] as PHQ9ResponseValue,
    })),
    totalScore: score.totalScore,
    severity: score.severity,
    q9SafetyFlag: score.q9SafetyFlag,
    completionStatus: 'complete',
    sharing: { ...NO_SHARING },
  };
}

function submitPHQ9(
  state: PHQ9FormState,
  action: Extract<PHQ9Action, { type: 'submit' }>,
): PHQ9FormState {
  // A second submit (including a rapid double tap) must not create another assessment.
  if (state.status === 'complete') return state;

  const validation = validatePHQ9Answers(state.answers);
  if (!validation.valid) {
    const invalidShape = !validation.shapeValid || validation.invalid.length > 0;
    return {
      ...state,
      attempted: true,
      assessment: null,
      error: invalidShape
        ? 'Your score is only calculated from exactly nine valid responses.'
        : null,
    };
  }

  return {
    ...state,
    attempted: true,
    status: 'complete',
    error: null,
    assessment: buildPHQ9Assessment(state.answers, {
      assessmentId: action.assessmentId,
      completedAt: action.completedAt,
      userId: action.userId,
    }),
  };
}
