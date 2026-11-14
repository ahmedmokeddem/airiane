/**
 * Independent adapted BDI-II domain object and pure form state.
 *
 * Results are held in memory only. They are not persisted, combined with PHQ-9, or shared
 * automatically.
 */

import {
  BDI_INSTRUMENT_VERSION,
  BDI_QUESTION_IDS,
  BDI_QUESTIONS,
  type BDIQuestion,
  type BDIQuestionId,
  type BDIResponseValue,
  type BDIPreliminaryLevel,
  type BDISeverity,
} from './bdi-config';
import {
  isBDIResponseValue,
  scoreBDI,
  validateBDIAnswers,
  type BDIAnswerInput,
} from './bdi-scoring';

export type BDIAnswers = Partial<Record<BDIQuestionId, BDIResponseValue>>;

export interface BDIResponse {
  questionId: BDIQuestionId;
  score: BDIResponseValue;
}

export interface BDIAssessment {
  assessmentId: string;
  userId: string | null;
  assessmentType: 'BDI-II-adapted';
  instrumentVersion: typeof BDI_INSTRUMENT_VERSION;
  completedAt: string;
  responses: BDIResponse[];
  totalScore: number;
  severity: BDISeverity;
  preliminaryLevel: BDIPreliminaryLevel;
  preliminaryLabel: string;
  q9SafetyFlag: boolean;
  completionStatus: 'complete';
  validated: false;
  sharing: { shareWithTherapist: false };
}

export interface BDIFormState {
  answers: BDIAnswers;
  attempted: boolean;
  status: 'editing' | 'complete';
  assessment: BDIAssessment | null;
  error: string | null;
}

export type BDIAction =
  | { type: 'select'; questionId: BDIQuestionId; value: number }
  | {
      type: 'submit';
      assessmentId: string;
      completedAt: string;
      userId?: string | null;
    }
  | { type: 'reset' };

export function createBDIFormState(): BDIFormState {
  return { answers: {}, attempted: false, status: 'editing', assessment: null, error: null };
}

export function bdiReducer(state: BDIFormState, action: BDIAction): BDIFormState {
  switch (action.type) {
    case 'select':
      return selectBDIAnswer(state, action.questionId, action.value);
    case 'submit':
      return submitBDI(state, action);
    case 'reset':
      return createBDIFormState();
    default:
      return state;
  }
}

export function selectBDIAnswer(
  state: BDIFormState,
  questionId: BDIQuestionId,
  value: number,
): BDIFormState {
  if (state.status !== 'editing') return state;
  if (!BDI_QUESTION_IDS.includes(questionId) || !isBDIResponseValue(value)) {
    return { ...state, error: 'That answer is not valid. Choose 0, 1, 2 or 3.' };
  }
  return {
    ...state,
    answers: { ...state.answers, [questionId]: value },
    error: null,
  };
}

export function answeredBDICount(answers: BDIAnswerInput): number {
  return BDI_QUESTION_IDS.filter(id => isBDIResponseValue(answers[id])).length;
}

export function unansweredBDIQuestions(answers: BDIAnswerInput): BDIQuestion[] {
  return BDI_QUESTIONS.filter(item => !isBDIResponseValue(answers[item.id]));
}

export function bdiProgress(state: BDIFormState): {
  answered: number;
  total: number;
  label: string;
  percent: number;
} {
  const total = BDI_QUESTIONS.length;
  const answered = answeredBDICount(state.answers);
  return {
    answered,
    total,
    label: `${answered} / ${total} completed`,
    percent: Math.round((answered / total) * 100),
  };
}

export function isBDIComplete(answers: BDIAnswerInput): boolean {
  return validateBDIAnswers(answers).valid;
}

export function buildBDIAssessment(
  answers: BDIAnswers,
  options: { assessmentId: string; completedAt: string; userId?: string | null },
): BDIAssessment {
  const score = scoreBDI(answers);
  return {
    assessmentId: options.assessmentId,
    userId: options.userId ?? null,
    assessmentType: 'BDI-II-adapted',
    instrumentVersion: BDI_INSTRUMENT_VERSION,
    completedAt: options.completedAt,
    responses: BDI_QUESTIONS.map(item => ({
      questionId: item.id,
      score: answers[item.id] as BDIResponseValue,
    })),
    totalScore: score.totalScore,
    severity: score.severity,
    preliminaryLevel: score.preliminaryLevel,
    preliminaryLabel: score.preliminaryLabel,
    q9SafetyFlag: score.q9SafetyFlag,
    completionStatus: 'complete',
    validated: false,
    sharing: { shareWithTherapist: false },
  };
}

function submitBDI(
  state: BDIFormState,
  action: Extract<BDIAction, { type: 'submit' }>,
): BDIFormState {
  if (state.status === 'complete') return state;

  const validation = validateBDIAnswers(state.answers);
  if (!validation.valid) {
    const invalidShape = !validation.shapeValid || validation.invalid.length > 0;
    return {
      ...state,
      attempted: true,
      assessment: null,
      error: invalidShape
        ? 'Your result is only calculated from exactly 21 valid responses.'
        : null,
    };
  }

  return {
    ...state,
    attempted: true,
    status: 'complete',
    error: null,
    assessment: buildBDIAssessment(state.answers, {
      assessmentId: action.assessmentId,
      completedAt: action.completedAt,
      userId: action.userId,
    }),
  };
}
