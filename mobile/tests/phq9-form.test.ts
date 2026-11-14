import test from 'node:test';
import assert from 'node:assert/strict';
import { PHQ9_QUESTION_IDS, type PHQ9QuestionId } from '../src/features/phq9/phq9-config';
import {
  buildPHQ9Assessment,
  createPHQ9FormState,
  isPHQ9Complete,
  phq9Progress,
  phq9Reducer,
  unansweredPHQ9Questions,
} from '../src/features/phq9/phq9-session';

const submitAction = {
  type: 'submit' as const,
  assessmentId: '33333333-3333-4333-8333-333333333339',
  completedAt: '2026-11-14T12:00:00.000Z',
};

test('PHQ-9 form: initial progress is 0 / 9 and no result exists', () => {
  const state = createPHQ9FormState();
  assert.equal(state.answers.q1, undefined);
  assert.equal(state.status, 'editing');
  assert.equal(state.assessment, null);
  assert.deepEqual(phq9Progress(state), {
    answered: 0,
    total: 9,
    label: '0 / 9 completed',
    percent: 0,
  });
});

test('PHQ-9 form: each question accepts exactly one answer', () => {
  let state = createPHQ9FormState();
  state = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 3 });
  assert.equal(state.answers.q1, 3);
  assert.equal(Object.keys(state.answers).length, 1);

  state = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 1 });
  assert.equal(state.answers.q1, 1);
  assert.equal(Object.keys(state.answers).length, 1, 'the previous value is replaced');
});

test('PHQ-9 form: changing an answer updates the selection and keeps progress stable', () => {
  let state = createPHQ9FormState();
  state = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 2 });
  state = phq9Reducer(state, { type: 'select', questionId: 'q2', value: 0 });
  assert.equal(phq9Progress(state).label, '2 / 9 completed');

  state = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 3 });
  assert.equal(state.answers.q1, 3);
  assert.equal(phq9Progress(state).label, '2 / 9 completed');
});

test('PHQ-9 form: progress reaches 9 / 9 and updates immediately', () => {
  let state = createPHQ9FormState();
  for (const [index, id] of PHQ9_QUESTION_IDS.entries()) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 3 });
    assert.equal(phq9Progress(state).label, `${index + 1} / 9 completed`);
  }
  assert.deepEqual(phq9Progress(state), {
    answered: 9,
    total: 9,
    label: '9 / 9 completed',
    percent: 100,
  });
  assert.equal(isPHQ9Complete(state.answers), true);
});

test('PHQ-9 form: an incomplete submission is rejected and names the gaps', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS.slice(0, 7)) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 1 });
  }
  state = phq9Reducer(state, submitAction);

  assert.equal(state.attempted, true);
  assert.equal(state.status, 'editing');
  assert.equal(state.assessment, null, 'no severity can be produced from partial answers');
  assert.deepEqual(
    unansweredPHQ9Questions(state.answers).map(question => question.id),
    ['q8', 'q9'],
  );
});

test('PHQ-9 form: a complete submission builds the independent assessment object', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 2 });
  }
  state = phq9Reducer(state, submitAction);

  assert.equal(state.status, 'complete');
  assert.ok(state.assessment);
  const assessment = state.assessment;
  assert.equal(assessment.assessmentId, submitAction.assessmentId);
  assert.equal(assessment.assessmentType, 'PHQ-9');
  assert.equal(assessment.completedAt, submitAction.completedAt);
  assert.equal(assessment.totalScore, 18);
  assert.equal(assessment.severity, 'Moderately Severe');
  assert.equal(assessment.q9SafetyFlag, true);
  assert.equal(assessment.completionStatus, 'complete');
  assert.deepEqual(assessment.sharing, { shareWithTherapist: false });
  assert.equal(assessment.userId, null);
  assert.equal(assessment.responses.length, 9);
  for (const response of assessment.responses) {
    assert.equal(typeof response.score, 'number');
    assert.ok(response.score >= 0 && response.score <= 3);
  }
});

test('PHQ-9 form: the signed-in user id is retained only on the in-memory object', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 0 });
  }
  state = phq9Reducer(state, { ...submitAction, userId: 'patient-123' });
  assert.equal(state.assessment?.userId, 'patient-123');
});

test('PHQ-9 form: a rapid duplicate submission cannot create a second result', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 1 });
  }
  const first = phq9Reducer(state, submitAction);
  const second = phq9Reducer(first, {
    ...submitAction,
    assessmentId: '44444444-4444-4444-8444-444444444444',
    completedAt: '2026-11-14T12:00:01.000Z',
  });
  assert.equal(second, first);
  assert.equal(second.assessment?.assessmentId, submitAction.assessmentId);
});

test('PHQ-9 form: an answer cannot be changed after the result is complete', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 0 });
  }
  state = phq9Reducer(state, submitAction);
  const after = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 3 });
  assert.equal(after, state);
  assert.equal(after.assessment?.totalScore, 0);
});

test('PHQ-9 form: a positive Q9 keeps its independent safety flag with a low total', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 0 });
  }
  state = phq9Reducer(state, { type: 'select', questionId: 'q9', value: 1 });
  state = phq9Reducer(state, submitAction);
  assert.equal(state.assessment?.totalScore, 1);
  assert.equal(state.assessment?.severity, 'Minimal');
  assert.equal(state.assessment?.q9SafetyFlag, true);
});

test('PHQ-9 form: invalid answers are rejected by the reducer', () => {
  let state = createPHQ9FormState();
  state = phq9Reducer(state, { type: 'select', questionId: 'q1', value: 4 });
  assert.equal(state.answers.q1, undefined);
  assert.ok(state.error);

  state = phq9Reducer(state, {
    type: 'select',
    questionId: 'q10' as unknown as PHQ9QuestionId,
    value: 1,
  });
  assert.equal((state.answers as Record<string, unknown>).q10, undefined);
});

test('PHQ-9 form: reset returns to an empty editable form', () => {
  let state = createPHQ9FormState();
  for (const id of PHQ9_QUESTION_IDS) {
    state = phq9Reducer(state, { type: 'select', questionId: id, value: 2 });
  }
  state = phq9Reducer(state, submitAction);
  state = phq9Reducer(state, { type: 'reset' });
  assert.equal(state.status, 'editing');
  assert.equal(state.attempted, false);
  assert.equal(state.assessment, null);
  assert.deepEqual(state.answers, {});
});

test('PHQ-9 form: the domain builder refuses incomplete answers', () => {
  assert.throws(() =>
    buildPHQ9Assessment(
      { q1: 0 },
      {
        assessmentId: '55555555-5555-4555-8555-555555555555',
        completedAt: '2026-11-14T12:00:00.000Z',
      },
    ),
  );
});

test('PHQ-9 form: unanswered questions are returned in questionnaire order', () => {
  const questions = unansweredPHQ9Questions({ q5: 1, q1: 0 });
  assert.deepEqual(
    questions.map(question => question.id),
    ['q2', 'q3', 'q4', 'q6', 'q7', 'q8', 'q9'],
  );
});
