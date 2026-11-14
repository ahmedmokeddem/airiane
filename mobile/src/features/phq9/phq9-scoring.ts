/**
 * Deterministic PHQ-9 scoring. This module never calls a model, the network or a UI
 * component. It accepts exactly nine integer responses, each 0–3, and returns the total
 * plus the conventional severity band.
 */

import {
  PHQ9_MAX_SCORE,
  PHQ9_QUESTION_IDS,
  PHQ9_SEVERITY_BANDS,
  type PHQ9QuestionId,
  type PHQ9ResponseValue,
  type PHQ9Severity,
  type PHQ9SeverityBand,
} from './phq9-config';

export type PHQ9AnswerInput = Partial<Record<PHQ9QuestionId, unknown>>;

export type PHQ9Responses = Record<PHQ9QuestionId, PHQ9ResponseValue>;

export type PHQ9ValidationCode = 'invalid_shape' | 'incomplete' | 'invalid_response';

export interface PHQ9Score {
  totalScore: number;
  maxScore: number;
  severity: PHQ9Severity;
  band: PHQ9SeverityBand;
  q9SafetyFlag: boolean;
}

export class PHQ9ValidationError extends Error {
  readonly code: PHQ9ValidationCode;
  readonly details: readonly string[];

  constructor(code: PHQ9ValidationCode, details: readonly string[]) {
    super(details.join(' '));
    this.name = 'PHQ9ValidationError';
    this.code = code;
    this.details = details;
  }
}

export function isPHQ9ResponseValue(value: unknown): value is PHQ9ResponseValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
}

/**
 * Validate the answer map without scoring it. Callers use this before enabling a submit
 * action; `scorePHQ9` uses it again so no incomplete answer set can ever be scored.
 */
export function validatePHQ9Answers(answers: PHQ9AnswerInput): {
  valid: boolean;
  unanswered: PHQ9QuestionId[];
  invalid: PHQ9QuestionId[];
  shapeValid: boolean;
} {
  if (
    answers === null ||
    typeof answers !== 'object' ||
    Array.isArray(answers)
  ) {
    return { valid: false, unanswered: [], invalid: [], shapeValid: false };
  }

  const keys = Object.keys(answers);
  const expected = new Set<string>(PHQ9_QUESTION_IDS);
  const shapeValid = keys.every(key => expected.has(key));

  const unanswered: PHQ9QuestionId[] = [];
  const invalid: PHQ9QuestionId[] = [];

  for (const id of PHQ9_QUESTION_IDS) {
    if (!Object.prototype.hasOwnProperty.call(answers, id) || answers[id] === undefined) {
      unanswered.push(id);
    } else if (!isPHQ9ResponseValue(answers[id])) {
      invalid.push(id);
    }
  }

  return {
    valid: shapeValid && unanswered.length === 0 && invalid.length === 0,
    unanswered,
    invalid,
    shapeValid,
  };
}

/**
 * Score a complete PHQ-9 response set.
 *
 * Throws `PHQ9ValidationError` when the answer map is not exactly q1–q9, when a value is
 * missing, non-integer, negative or greater than 3. Missing answers are never silently
 * treated as zero.
 */
export function scorePHQ9(answers: PHQ9AnswerInput): PHQ9Score {
  const validation = validatePHQ9Answers(answers);
  if (!validation.shapeValid) {
    const keys = answers !== null && typeof answers === 'object' && !Array.isArray(answers)
      ? Object.keys(answers)
      : [];
    const unknown = keys.filter(key => !PHQ9_QUESTION_IDS.includes(key as PHQ9QuestionId));
    const details = [
      `PHQ-9 requires exactly nine responses (q1–q9); received ${keys.length}.`,
      ...(unknown.length ? [`Unknown response keys: ${unknown.join(', ')}.`] : []),
    ];
    throw new PHQ9ValidationError('invalid_shape', details);
  }
  if (validation.unanswered.length) {
    throw new PHQ9ValidationError(
      'incomplete',
      [`Missing answers: ${validation.unanswered.map(id => id.toUpperCase()).join(', ')}.`],
    );
  }
  if (validation.invalid.length) {
    throw new PHQ9ValidationError(
      'invalid_response',
      [
        'Each response must be a whole number from 0 to 3. ' +
          `Invalid answers: ${validation.invalid.map(id => id.toUpperCase()).join(', ')}.`,
      ],
    );
  }

  const responses = answers as PHQ9Responses;
  const totalScore = PHQ9_QUESTION_IDS.reduce((sum, id) => sum + responses[id], 0);
  const band = severityBandForScore(totalScore);

  return {
    totalScore,
    maxScore: PHQ9_MAX_SCORE,
    severity: band.severity,
    band,
    q9SafetyFlag: responses.q9 > 0,
  };
}

export function severityBandForScore(totalScore: number): PHQ9SeverityBand {
  if (!Number.isInteger(totalScore) || totalScore < 0 || totalScore > PHQ9_MAX_SCORE) {
    throw new PHQ9ValidationError(
      'invalid_response',
      [`A PHQ-9 total must be a whole number from 0 to ${PHQ9_MAX_SCORE}.`],
    );
  }
  const band = PHQ9_SEVERITY_BANDS.find(
    item => totalScore >= item.min && totalScore <= item.max,
  );
  if (!band) {
    throw new PHQ9ValidationError('invalid_response', ['No PHQ-9 severity band matches this score.']);
  }
  return band;
}
