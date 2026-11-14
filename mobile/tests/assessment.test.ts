import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fixture from '../../contracts/fixtures/assessment-definitions.json';
import { applicable, checkInUpdate, matchOption, nextQuestion, progress, submission, wantsAssessment, type Answers, type Definition } from '../src/features/assessment/assessment-flow';

const [phq9, extended] = fixture.data.items as Definition[];
const answerAll = (definition: Definition, value: (id: string) => number) => {
  const answers: Answers = {};
  for (let q = nextQuestion(definition, answers); q; q = nextQuestion(definition, answers)) answers[q.question_id] = value(q.question_id);
  return answers;
};

test('PHQ-9 asks the extra question (Q10) only after a Q9 answer above 0', () => {
  const none = answerAll(phq9, () => 0);
  assert.deepEqual(Object.keys(none), ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']);
  const positive = answerAll(phq9, id => (id === 'q9' ? 1 : 0));
  assert.deepEqual(Object.keys(positive).slice(8), ['q9', 'q10']);
  assert.equal(submission(phq9, positive).length, 10);
  // Changing Q9 back to 0 removes Q10 from what is submitted.
  assert.equal(submission(phq9, { ...positive, q9: 0 }).some(a => a.question_id === 'q10'), false);
});

test('progress counts only questions that apply', () => {
  assert.deepEqual(progress(phq9, {}), { number: 1, total: 9 });
  assert.deepEqual(progress(phq9, { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 2 }), { number: 10, total: 10 });
  assert.equal(applicable(extended, {}).length, 21);
  assert.equal(nextQuestion(extended, answerAll(extended, () => 1)), undefined);
});

test('spoken and typed answers are matched to the right option, or not at all', () => {
  const q1 = phq9.questions[0];
  assert.equal(matchOption(q1, 'Not at all really'), 0);
  assert.equal(matchOption(q1, 'hmm, several days I think'), 1);
  assert.equal(matchOption(q1, 'probably more than half the days'), 2);
  assert.equal(matchOption(q1, 'nearly every day'), 3);
  assert.equal(matchOption(q1, 'every day'), 3);
  assert.equal(matchOption(q1, '2'), 2);
  assert.equal(matchOption(q1, "I'm not sure"), null);
  const enjoyment = extended.questions.find(q => q.question_id === 'q4')!;
  assert.equal(matchOption(enjoyment, 'a little less than usual'), 1);
  assert.equal(matchOption(enjoyment, 'as much as usual'), 0);
  const q10 = phq9.questions.find(q => q.question_id === 'q10')!;
  assert.equal(matchOption(q10, 'somewhat difficult'), 1);
  assert.equal(matchOption(q10, 'extremely difficult'), 3);
});

test('check-in updates and assessment requests are recognised in conversation', () => {
  assert.equal(checkInUpdate('my mood is more like a 6 now')?.kind, 'mood');
  assert.equal(checkInUpdate('actually I slept 8 hours')?.kind, 'sleep_hours');
  assert.equal(checkInUpdate('energy is about three')?.kind, 'energy');
  assert.equal(checkInUpdate('I feel a bit better'), null);
  assert.ok(wantsAssessment('can we do a full assessment?'));
  assert.ok(wantsAssessment('I want the longer questions'));
  assert.equal(wantsAssessment('hello'), false);
});

test('safety: crisis support is shown immediately and patients never see severity labels', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const hook = read('../src/features/assessment/use-assessment.ts');
  assert.ok(hook.includes("question.question_id === 'q9' && value > 0) setSafety('concern')"));
  const panel = read('../src/features/assessment/assessment-panel.tsx');
  assert.ok(!/result\.severity|result\.interpretation|suggested_action/.test(panel));
  assert.ok(read('../src/features/assessment/crisis-support.tsx').includes("tel:112"));
  // Told before starting, and confirmed afterwards, when answers go to the doctor.
  assert.ok(panel.includes('all your answers will be sent to your connected doctor'));
  assert.ok(panel.includes('all your answers were sent to your doctor'));
});
