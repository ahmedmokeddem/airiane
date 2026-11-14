import test from 'node:test';
import assert from 'node:assert/strict';
import { PHQ9_QUESTION_IDS, type PHQ9ResponseValue } from '../src/features/phq9/phq9-config';
import type { PHQ9Answers } from '../src/features/phq9/phq9-session';
import {
  PHQ9ValidationError,
  isPHQ9ResponseValue,
  scorePHQ9,
  severityBandForScore,
  validatePHQ9Answers,
} from '../src/features/phq9/phq9-scoring';

const all = (value: PHQ9ResponseValue): PHQ9Answers =>
  Object.fromEntries(PHQ9_QUESTION_IDS.map(id => [id, value])) as PHQ9Answers;

/** Build a valid nine-answer set with a chosen total; optionally pin Q9. */
function answersForTotal(total: number, q9: number | null = null): PHQ9Answers {
  const answers = all(0);
  let remaining = total;
  if (q9 !== null) {
    answers.q9 = q9 as PHQ9ResponseValue;
    remaining -= q9;
  }
  for (const id of PHQ9_QUESTION_IDS) {
    if (id === 'q9' && q9 !== null) continue;
    const take = Math.min(3, remaining);
    answers[id] = take as PHQ9ResponseValue;
    remaining -= take;
  }
  assert.equal(remaining, 0, `could not build a valid answer set totaling ${total}`);
  return answers;
}

const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof PHQ9ValidationError);
    assert.equal(error.code, code);
    return true;
  });

test('PHQ-9: all responses zero score 0 and Minimal', () => {
  const result = scorePHQ9(all(0));
  assert.equal(result.totalScore, 0);
  assert.equal(result.maxScore, 27);
  assert.equal(result.severity, 'Minimal');
  assert.equal(result.q9SafetyFlag, false);
});

test('PHQ-9: all responses one score 9 and Mild', () => {
  const result = scorePHQ9(all(1));
  assert.equal(result.totalScore, 9);
  assert.equal(result.severity, 'Mild');
});

test('PHQ-9: all responses two score 18 and Moderately Severe', () => {
  const result = scorePHQ9(all(2));
  assert.equal(result.totalScore, 18);
  assert.equal(result.severity, 'Moderately Severe');
});

test('PHQ-9: all responses three score 27 and Severe', () => {
  const result = scorePHQ9(all(3));
  assert.equal(result.totalScore, 27);
  assert.equal(result.severity, 'Severe');
  assert.equal(result.q9SafetyFlag, true);
});

test('PHQ-9: every severity boundary is exact', () => {
  const expected: [number, string][] = [
    [0, 'Minimal'],
    [4, 'Minimal'],
    [5, 'Mild'],
    [9, 'Mild'],
    [10, 'Moderate'],
    [14, 'Moderate'],
    [15, 'Moderately Severe'],
    [19, 'Moderately Severe'],
    [20, 'Severe'],
    [27, 'Severe'],
  ];
  for (const [total, severity] of expected) {
    assert.equal(severityBandForScore(total).severity, severity, `score ${total}`);
    assert.equal(scorePHQ9(answersForTotal(total)).severity, severity, `answers totaling ${total}`);
  }
});

test('PHQ-9: negative values are rejected, never silently scored', () => {
  rejects(() => scorePHQ9({ ...all(0), q1: -1 }), 'invalid_response');
});

test('PHQ-9: values greater than three are rejected', () => {
  rejects(() => scorePHQ9({ ...all(0), q4: 4 }), 'invalid_response');
});

test('PHQ-9: non-integer values are rejected', () => {
  rejects(() => scorePHQ9({ ...all(0), q2: 1.5 }), 'invalid_response');
});

test('PHQ-9: non-numeric values are rejected', () => {
  rejects(() => scorePHQ9({ ...all(0), q3: '2' }), 'invalid_response');
});

test('PHQ-9: a missing answer is rejected', () => {
  const missing = { ...all(0) } as Record<string, unknown>;
  delete missing.q9;
  rejects(() => scorePHQ9(missing), 'incomplete');
});

test('PHQ-9: fewer than nine answers are rejected', () => {
  const eight = { ...all(0) } as Record<string, unknown>;
  delete eight.q8;
  delete eight.q9;
  rejects(() => scorePHQ9(eight), 'incomplete');
});

test('PHQ-9: more than nine answers are rejected', () => {
  rejects(
    () => scorePHQ9({ ...all(0), q10: 0 } as unknown as Record<string, unknown>),
    'invalid_shape',
  );
});

test('PHQ-9: a positive Q9 with a low total still raises the safety flag', () => {
  const result = scorePHQ9(answersForTotal(3, 1));
  assert.equal(result.totalScore, 3);
  assert.equal(result.severity, 'Minimal');
  assert.equal(result.q9SafetyFlag, true);
});

test('PHQ-9: a positive Q9 with a high total raises the safety flag', () => {
  const result = scorePHQ9(answersForTotal(24, 3));
  assert.equal(result.totalScore, 24);
  assert.equal(result.severity, 'Severe');
  assert.equal(result.q9SafetyFlag, true);
});

test('PHQ-9: Q9 zero does not raise the safety flag even with a severe total', () => {
  const result = scorePHQ9(answersForTotal(20, 0));
  assert.equal(result.totalScore, 20);
  assert.equal(result.severity, 'Severe');
  assert.equal(result.q9SafetyFlag, false);
});

test('PHQ-9: an invalid total cannot be classified', () => {
  rejects(() => severityBandForScore(-1), 'invalid_response');
  rejects(() => severityBandForScore(28), 'invalid_response');
  rejects(() => severityBandForScore(10.5), 'invalid_response');
});

test('PHQ-9: runtime value guard accepts only whole numbers 0 to 3', () => {
  for (const value of [0, 1, 2, 3]) assert.equal(isPHQ9ResponseValue(value), true);
  for (const value of [-1, 4, 1.5, '2', null, undefined, NaN]) {
    assert.equal(isPHQ9ResponseValue(value), false);
  }
});

test('PHQ-9: validation reports unanswered questions without scoring them', () => {
  const partial = { q1: 0, q2: 1 } as PHQ9Answers;
  const validation = validatePHQ9Answers(partial);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.unanswered, [
    'q3',
    'q4',
    'q5',
    'q6',
    'q7',
    'q8',
    'q9',
  ]);
  assert.equal(validation.invalid.length, 0);
});
