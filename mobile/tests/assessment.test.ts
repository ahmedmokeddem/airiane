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
  // Crisis support follows the current Q9 answer, so correcting Q9 with Back clears it.
  assert.ok(hook.includes("setSafety((answers.q9 ?? 0) > 0 ? 'concern' : 'none')"));
  const panel = read('../src/features/assessment/assessment-panel.tsx');
  assert.ok(!/result\.severity|result\.interpretation|suggested_action/.test(panel));
  assert.ok(read('../src/features/assessment/crisis-support.tsx').includes("tel:112"));
  // Told before starting, and confirmed afterwards, when answers go to the doctor.
  assert.ok(panel.includes('all your answers will be sent to your connected doctor'));
  assert.ok(panel.includes('all your answers were sent to your doctor'));
});

test('lagging taps cannot skip from question 3 to question 10', async () => {
  const { acceptAnswer, TAP_SETTLE_MS, nextQuestion: next } = await import('../src/features/assessment/assessment-flow');
  // Replays the reported bug: five taps on "Nearly every day" in quick succession at question 3.
  const answers: Answers = { q1: 1, q2: 1 };
  let shownAt = 0; let clock = 0; let recorded = 0;
  for (let tap = 0; tap < 5; tap++) {
    clock += 120; // taps 120 ms apart, delivered to whatever question is on screen
    const current = next(phq9, answers)!;
    if (acceptAnswer(current, current.question_id, 3, 'tap', clock - shownAt, false)) {
      answers[current.question_id] = 3; recorded++; shownAt = clock;
    }
  }
  assert.equal(recorded, 0, 'question 3 had just appeared, so none of the burst counts');
  clock = shownAt + TAP_SETTLE_MS + 1;
  const q3 = next(phq9, answers)!;
  assert.ok(acceptAnswer(q3, 'q3', 3, 'tap', clock - shownAt, false));
  answers.q3 = 3; shownAt = clock;
  // An immediate second tap lands on question 4 and is ignored; Q9 is never reached by a burst.
  const q4 = next(phq9, answers)!;
  assert.equal(acceptAnswer(q4, 'q4', 3, 'tap', 150, false), false);
  assert.equal(answers.q9, undefined);
  // A stale button for an earlier question, a submission in progress, or an unknown option: ignored.
  assert.equal(acceptAnswer(q4, 'q3', 3, 'tap', 5000, false), false);
  assert.equal(acceptAnswer(q4, 'q4', 3, 'tap', 5000, true), false);
  assert.equal(acceptAnswer(q4, 'q4', 7, 'tap', 5000, false), false);
  // A spoken confirmation is deliberate, so it does not wait for the settle time.
  assert.ok(acceptAnswer(q4, 'q4', 2, 'voice', 0, false));
});

test('back undoes the last answer, including the extra question that depended on it', async () => {
  const { previousQuestion, withoutAnswer } = await import('../src/features/assessment/assessment-flow');
  const answers: Answers = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 2, q10: 1 };
  assert.equal(previousQuestion(phq9, answers)?.question_id, 'q10');
  const corrected = withoutAnswer(phq9, withoutAnswer(phq9, answers, 'q10'), 'q9');
  assert.equal(nextQuestion(phq9, corrected)?.question_id, 'q9');
  assert.equal('q10' in withoutAnswer(phq9, answers, 'q9'), false);
});

test('spoken confirmations and the resume request are recognised', async () => {
  const { isAffirmative, isNegative, wantsResume } = await import('../src/features/assessment/assessment-flow');
  for (const yes of ['yes', 'Yeah', "that's right", 'correct', 'ok']) assert.ok(isAffirmative(yes), yes);
  for (const no of ['no', 'not quite', 'nope']) assert.ok(isNegative(no), no);
  assert.equal(isAffirmative('several days'), false);
  assert.equal(isAffirmative('not right'), false);
  assert.ok(wantsResume("let's continue the questionnaire"));
});
