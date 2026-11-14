import test from 'node:test';
import assert from 'node:assert/strict';
import { BDI_QUESTION_IDS, type BDIQuestionId } from '../src/features/bdi/bdi-config';
import {
  buildBDIAssessment,
  bdiProgress,
  bdiReducer,
  createBDIFormState,
  isBDIComplete,
  unansweredBDIQuestions,
} from '../src/features/bdi/bdi-session';

const submitAction = {
  type: 'submit' as const,
  assessmentId: '77777777-7777-4777-8777-777777777777',
  completedAt: '2026-11-14T15:00:00.000Z',
};

test('Adapted BDI-II form: initial progress is 0 / 21', () => {
  const state = createBDIFormState();
  assert.deepEqual(bdiProgress(state), {
    answered: 0,
    total: 21,
    label: '0 / 21 completed',
    percent: 0,
  });
});

test('Adapted BDI-II form: each item accepts exactly one answer', () => {
  let state = createBDIFormState();
  state = bdiReducer(state, { type: 'select', questionId: 'q1', value: 3 });
  assert.equal(state.answers.q1, 3);
  assert.equal(Object.keys(state.answers).length, 1);
  state = bdiReducer(state, { type: 'select', questionId: 'q1', value: 1 });
  assert.equal(state.answers.q1, 1);
  assert.equal(Object.keys(state.answers).length, 1);
});

test('Adapted BDI-II form: progress updates immediately and reaches 21 / 21', () => {
  let state = createBDIFormState();
  for (const [index, id] of BDI_QUESTION_IDS.entries()) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 2 });
    assert.equal(bdiProgress(state).label, `${index + 1} / 21 completed`);
  }
  assert.equal(bdiProgress(state).percent, 100);
  assert.equal(isBDIComplete(state.answers), true);
});

test('Adapted BDI-II form: incomplete submission is rejected without a severity', () => {
  let state = createBDIFormState();
  for (const id of BDI_QUESTION_IDS.slice(0, 18)) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 1 });
  }
  state = bdiReducer(state, submitAction);
  assert.equal(state.attempted, true);
  assert.equal(state.status, 'editing');
  assert.equal(state.assessment, null);
  assert.deepEqual(
    unansweredBDIQuestions(state.answers).map(question => question.id),
    ['q19', 'q20', 'q21'],
  );
});

test('Adapted BDI-II form: complete submission builds the independent adapted domain object', () => {
  let state = createBDIFormState();
  for (const id of BDI_QUESTION_IDS) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 2 });
  }
  state = bdiReducer(state, submitAction);
  assert.ok(state.assessment);
  const assessment = state.assessment;
  assert.equal(assessment.assessmentType, 'BDI-II-adapted');
  assert.equal(assessment.instrumentVersion, 'adapted-1');
  assert.equal(assessment.totalScore, 42);
  assert.equal(assessment.severity, 'Severe');
  assert.equal(assessment.preliminaryLevel, 'high');
  assert.equal(assessment.q9SafetyFlag, true);
  assert.equal(assessment.validated, false);
  assert.equal(assessment.completionStatus, 'complete');
  assert.deepEqual(assessment.sharing, { shareWithTherapist: false });
  assert.equal(assessment.responses.length, 21);
  for (const response of assessment.responses) {
    assert.equal(typeof response.score, 'number');
  }
});

test('Adapted BDI-II form: duplicate submit cannot create a second assessment', () => {
  let state = createBDIFormState();
  for (const id of BDI_QUESTION_IDS) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 0 });
  }
  const first = bdiReducer(state, submitAction);
  const second = bdiReducer(first, {
    ...submitAction,
    assessmentId: '88888888-8888-4888-8888-888888888888',
    completedAt: '2026-11-14T15:00:01.000Z',
  });
  assert.equal(second, first);
  assert.equal(second.assessment?.assessmentId, submitAction.assessmentId);
});

test('Adapted BDI-II form: Q9 positive keeps its independent safety flag at a low total', () => {
  let state = createBDIFormState();
  for (const id of BDI_QUESTION_IDS) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 0 });
  }
  state = bdiReducer(state, { type: 'select', questionId: 'q9', value: 1 });
  state = bdiReducer(state, submitAction);
  assert.equal(state.assessment?.totalScore, 1);
  assert.equal(state.assessment?.severity, 'Minimal');
  assert.equal(state.assessment?.q9SafetyFlag, true);
});

test('Adapted BDI-II form: invalid answers and post-complete edits are ignored', () => {
  let state = createBDIFormState();
  state = bdiReducer(state, { type: 'select', questionId: 'q1', value: 4 });
  assert.equal(state.answers.q1, undefined);
  state = bdiReducer(state, {
    type: 'select',
    questionId: 'q22' as unknown as BDIQuestionId,
    value: 1,
  });
  assert.equal((state.answers as Record<string, unknown>).q22, undefined);

  for (const id of BDI_QUESTION_IDS) {
    state = bdiReducer(state, { type: 'select', questionId: id, value: 1 });
  }
  state = bdiReducer(state, submitAction);
  const after = bdiReducer(state, { type: 'select', questionId: 'q1', value: 3 });
  assert.equal(after, state);
});

test('Adapted BDI-II form: reset clears the form and builder rejects incomplete data', () => {
  let state = createBDIFormState();
  state = bdiReducer(state, { type: 'select', questionId: 'q1', value: 2 });
  state = bdiReducer(state, { type: 'reset' });
  assert.deepEqual(state.answers, {});
  assert.throws(() =>
    buildBDIAssessment(
      { q1: 0 },
      {
        assessmentId: '99999999-9999-4999-8999-999999999999',
        completedAt: '2026-11-14T15:00:00.000Z',
      },
    ),
  );
});
