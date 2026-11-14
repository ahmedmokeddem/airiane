import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../contracts/fixtures/assessment-definitions.json';
import {
  BDI_INTENSITY_OPTIONS,
  BDI_Q4_OPTIONS,
  BDI_QUESTION_IDS,
  BDI_QUESTIONS,
  BDI_SEVERITY_BANDS,
  type BDIResponseValue,
} from '../src/features/bdi/bdi-config';
import type { BDIAnswers } from '../src/features/bdi/bdi-session';
import {
  BDIValidationError,
  isBDIResponseValue,
  scoreBDI,
  severityBandForScore,
  validateBDIAnswers,
} from '../src/features/bdi/bdi-scoring';

const all = (value: BDIResponseValue): BDIAnswers =>
  Object.fromEntries(BDI_QUESTION_IDS.map(id => [id, value])) as BDIAnswers;

function answersForTotal(total: number, q9: number | null = null): BDIAnswers {
  const answers = all(0);
  let remaining = total;
  if (q9 !== null) {
    answers.q9 = q9 as BDIResponseValue;
    remaining -= q9;
  }
  for (const id of BDI_QUESTION_IDS) {
    if (id === 'q9' && q9 !== null) continue;
    const take = Math.min(3, remaining);
    answers[id] = take as BDIResponseValue;
    remaining -= take;
  }
  assert.equal(remaining, 0, `could not build a valid answer set totaling ${total}`);
  return answers;
}

const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof BDIValidationError);
    assert.equal(error.code, code);
    return true;
  });

test('Adapted BDI-II: 21 items and project response options match the existing fixture', () => {
  const bdi = fixture.data.items[1];
  assert.equal(BDI_QUESTIONS.length, 21);
  assert.deepEqual(BDI_QUESTION_IDS, bdi.questions.map((question: { question_id: string }) => question.question_id));
  assert.deepEqual(
    BDI_QUESTIONS.map(question => question.prompt),
    bdi.questions.map((question: { wording: string }) => question.wording),
  );
  assert.deepEqual(
    BDI_INTENSITY_OPTIONS.map(option => option.label),
    bdi.questions[0].options.map((option: { label: string }) => option.label),
  );
  assert.deepEqual(
    BDI_Q4_OPTIONS.map(option => option.label),
    bdi.questions[3].options.map((option: { label: string }) => option.label),
  );
  assert.equal(bdi.validated, false);
});

test('Adapted BDI-II: all zero scores 0 and Minimal/low concern', () => {
  const result = scoreBDI(all(0));
  assert.equal(result.totalScore, 0);
  assert.equal(result.maxScore, 63);
  assert.equal(result.severity, 'Minimal');
  assert.equal(result.preliminaryLevel, 'low');
  assert.equal(result.q9SafetyFlag, false);
  assert.equal(result.validated, false);
});

test('Adapted BDI-II: all ones scores 21 and Moderate/moderate concern', () => {
  const result = scoreBDI(all(1));
  assert.equal(result.totalScore, 21);
  assert.equal(result.severity, 'Moderate');
  assert.equal(result.preliminaryLevel, 'moderate');
});

test('Adapted BDI-II: all twos scores 42 and Severe/high concern', () => {
  const result = scoreBDI(all(2));
  assert.equal(result.totalScore, 42);
  assert.equal(result.severity, 'Severe');
  assert.equal(result.preliminaryLevel, 'high');
});

test('Adapted BDI-II: all threes scores 63 and Severe/high concern', () => {
  const result = scoreBDI(all(3));
  assert.equal(result.totalScore, 63);
  assert.equal(result.severity, 'Severe');
  assert.equal(result.q9SafetyFlag, true);
});

test('Adapted BDI-II: every severity boundary is exact', () => {
  const expected: [number, string, string][] = [
    [0, 'Minimal', 'low'],
    [13, 'Minimal', 'low'],
    [14, 'Mild', 'moderate'],
    [19, 'Mild', 'moderate'],
    [20, 'Moderate', 'moderate'],
    [28, 'Moderate', 'moderate'],
    [29, 'Severe', 'high'],
    [63, 'Severe', 'high'],
  ];
  for (const [total, severity, level] of expected) {
    const band = severityBandForScore(total);
    assert.equal(band.severity, severity, `score ${total}`);
    assert.equal(band.preliminaryLevel, level, `score ${total}`);
    const result = scoreBDI(answersForTotal(total));
    assert.equal(result.severity, severity, `answers totaling ${total}`);
    assert.equal(result.preliminaryLevel, level, `answers totaling ${total}`);
  }
  assert.equal(BDI_SEVERITY_BANDS.length, 4);
});

test('Adapted BDI-II: negative, >3, non-integer and non-numeric values are rejected', () => {
  rejects(() => scoreBDI({ ...all(0), q1: -1 }), 'invalid_response');
  rejects(() => scoreBDI({ ...all(0), q4: 4 }), 'invalid_response');
  rejects(() => scoreBDI({ ...all(0), q2: 1.5 }), 'invalid_response');
  rejects(() => scoreBDI({ ...all(0), q3: '2' }), 'invalid_response');
});

test('Adapted BDI-II: missing, fewer and extra answers are rejected', () => {
  const missing = { ...all(0) } as Record<string, unknown>;
  delete missing.q21;
  rejects(() => scoreBDI(missing), 'incomplete');

  const eight = { ...all(0) } as Record<string, unknown>;
  for (const id of BDI_QUESTION_IDS.slice(0, 13)) delete eight[id];
  rejects(() => scoreBDI(eight), 'incomplete');

  rejects(
    () => scoreBDI({ ...all(0), q22: 0 } as unknown as Record<string, unknown>),
    'invalid_shape',
  );
});

test('Adapted BDI-II: Q9 raises the safety flag at low and high totals', () => {
  const low = scoreBDI(answersForTotal(3, 1));
  assert.equal(low.totalScore, 3);
  assert.equal(low.severity, 'Minimal');
  assert.equal(low.q9SafetyFlag, true);

  const high = scoreBDI(answersForTotal(60, 3));
  assert.equal(high.totalScore, 60);
  assert.equal(high.severity, 'Severe');
  assert.equal(high.q9SafetyFlag, true);

  const none = scoreBDI(answersForTotal(29, 0));
  assert.equal(none.severity, 'Severe');
  assert.equal(none.q9SafetyFlag, false);
});

test('Adapted BDI-II: invalid totals cannot be classified', () => {
  rejects(() => severityBandForScore(-1), 'invalid_response');
  rejects(() => severityBandForScore(64), 'invalid_response');
  rejects(() => severityBandForScore(10.5), 'invalid_response');
});

test('Adapted BDI-II: value guard and incomplete validation', () => {
  for (const value of [0, 1, 2, 3]) assert.equal(isBDIResponseValue(value), true);
  for (const value of [-1, 4, 1.5, '2', null, undefined, NaN]) {
    assert.equal(isBDIResponseValue(value), false);
  }
  const partial = { q1: 0, q2: 1 } as BDIAnswers;
  const validation = validateBDIAnswers(partial);
  assert.equal(validation.valid, false);
  assert.equal(validation.unanswered.length, 19);
});
