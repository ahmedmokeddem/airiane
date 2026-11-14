/**
 * Deterministic scoring for the project-authorized adapted BDI-II-themed questionnaire.
 * No model, network or UI code is used. This produces an indicative adapted score, never
 * the validated standard BDI-II score.
 */

import {
  BDI_MAX_SCORE,
  BDI_QUESTION_IDS,
  BDI_SEVERITY_BANDS,
  type BDIQuestionId,
  type BDIResponseValue,
  type BDIPreliminaryLevel,
  type BDISeverity,
  type BDISeverityBand,
} from './bdi-config';

export type BDIAnswerInput = Partial<Record<BDIQuestionId, unknown>>;

export type BDIResponses = Record<BDIQuestionId, BDIResponseValue>;

export type BDIValidationCode = 'invalid_shape' | 'incomplete' | 'invalid_response';

export interface BDIScore {
  totalScore: number;
  maxScore: number;
  severity: BDISeverity;
  preliminaryLevel: BDIPreliminaryLevel;
  preliminaryLabel: string;
  band: BDISeverityBand;
  q9SafetyFlag: boolean;
  validated: false;
}

export class BDIValidationError extends Error {
  readonly code: BDIValidationCode;
  readonly details: readonly string[];

  constructor(code: BDIValidationCode, details: readonly string[]) {
    super(details.join(' '));
    this.name = 'BDIValidationError';
    this.code = code;
    this.details = details;
  }
}

export function isBDIResponseValue(value: unknown): value is BDIResponseValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
}

export function validateBDIAnswers(answers: BDIAnswerInput): {
  valid: boolean;
  unanswered: BDIQuestionId[];
  invalid: BDIQuestionId[];
  shapeValid: boolean;
} {
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    return { valid: false, unanswered: [], invalid: [], shapeValid: false };
  }

  const expected = new Set<string>(BDI_QUESTION_IDS);
  const keys = Object.keys(answers);
  const shapeValid = keys.every(key => expected.has(key));

  const unanswered: BDIQuestionId[] = [];
  const invalid: BDIQuestionId[] = [];
  for (const id of BDI_QUESTION_IDS) {
    if (!Object.prototype.hasOwnProperty.call(answers, id) || answers[id] === undefined) {
      unanswered.push(id);
    } else if (!isBDIResponseValue(answers[id])) {
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
 * Score a complete adapted BDI-II answer set. Missing answers are never silently treated as
 * zero, and incomplete data cannot produce a severity. The result is explicitly unvalidated.
 */
export function scoreBDI(answers: BDIAnswerInput): BDIScore {
  const validation = validateBDIAnswers(answers);
  if (!validation.shapeValid) {
    const keys = answers !== null && typeof answers === 'object' && !Array.isArray(answers)
      ? Object.keys(answers)
      : [];
    const unknown = keys.filter(key => !BDI_QUESTION_IDS.includes(key as BDIQuestionId));
    throw new BDIValidationError('invalid_shape', [
      `The adapted BDI-II check requires exactly 21 responses (q1–q21); received ${keys.length}.`,
      ...(unknown.length ? [`Unknown response keys: ${unknown.join(', ')}.`] : []),
    ]);
  }
  if (validation.unanswered.length) {
    throw new BDIValidationError('incomplete', [
      `Missing answers: ${validation.unanswered.map(id => id.toUpperCase()).join(', ')}.`,
    ]);
  }
  if (validation.invalid.length) {
    throw new BDIValidationError('invalid_response', [
      'Each response must be a whole number from 0 to 3. ' +
        `Invalid answers: ${validation.invalid.map(id => id.toUpperCase()).join(', ')}.`,
    ]);
  }

  const responses = answers as BDIResponses;
  const totalScore = BDI_QUESTION_IDS.reduce((sum, id) => sum + responses[id], 0);
  const band = severityBandForScore(totalScore);
  return {
    totalScore,
    maxScore: BDI_MAX_SCORE,
    severity: band.severity,
    preliminaryLevel: band.preliminaryLevel,
    preliminaryLabel: band.preliminaryLabel,
    band,
    q9SafetyFlag: responses.q9 > 0,
    validated: false,
  };
}

export function severityBandForScore(totalScore: number): BDISeverityBand {
  if (!Number.isInteger(totalScore) || totalScore < 0 || totalScore > BDI_MAX_SCORE) {
    throw new BDIValidationError('invalid_response', [
      `An adapted BDI-II total must be a whole number from 0 to ${BDI_MAX_SCORE}.`,
    ]);
  }
  const band = BDI_SEVERITY_BANDS.find(
    item => totalScore >= item.min && totalScore <= item.max,
  );
  if (!band) {
    throw new BDIValidationError('invalid_response', [
      'No adapted BDI-II severity band matches this score.',
    ]);
  }
  return band;
}
