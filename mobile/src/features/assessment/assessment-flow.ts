import type { DTO } from '../../integration/types';

export type Definition = DTO<'AssessmentDefinition'>;
export type Question = Definition['questions'][number];
export type Answers = Record<string, number>;
export type AssessmentResult = NonNullable<DTO<'AssessmentResponse'>['result']>;

/** Questions that apply given the answers so far (a follow-up applies only after an answer above 0). */
export const applicable = (definition: Definition, answers: Answers) =>
  definition.questions.filter(q => !q.follow_up_of || (answers[q.follow_up_of] ?? 0) > 0);

/** The next unanswered question, in the questionnaire's order, or undefined when complete. */
export const nextQuestion = (definition: Definition, answers: Answers) =>
  applicable(definition, answers).find(q => answers[q.question_id] === undefined);

export function progress(definition: Definition, answers: Answers) {
  const list = applicable(definition, answers);
  const current = nextQuestion(definition, answers);
  return { number: current ? list.indexOf(current) + 1 : list.length, total: list.length };
}

/** Answers in submission form; only questions that apply, in questionnaire order. */
export const submission = (definition: Definition, answers: Answers) =>
  applicable(definition, answers).map(q => ({ question_id: q.question_id, value: answers[q.question_id] }));

/** The self-harm question; any answer above 0 shows crisis support straight away. */
export const isSafetyQuestion = (question: Question) => question.question_id === 'q9';

const SYNONYMS: Record<string, string[]> = {
  'not at all': ['not at all', 'never', 'none', 'no days', 'not really', 'nope', 'zero'],
  'several days': ['several days', 'a few days', 'some days', 'sometimes', 'occasionally', 'a couple of days'],
  'more than half the days': ['more than half', 'most days', 'often', 'a lot of days', 'majority'],
  'nearly every day': ['nearly every day', 'every day', 'everyday', 'always', 'all the time', 'daily', 'constantly'],
  'a little': ['a little', 'slightly', 'a bit', 'somewhat', 'mildly'],
  'quite a lot': ['quite a lot', 'quite a bit', 'moderately', 'a lot', 'fairly'],
  'very much': ['very much', 'extremely', 'severely', 'completely', 'totally'],
  'as much as usual': ['as much as usual', 'same as usual', 'as usual', 'normal'],
  'a little less': ['a little less', 'slightly less', 'bit less'],
  'much less': ['much less', 'a lot less', 'way less'],
  'none at all': ['none at all', 'no enjoyment', 'nothing'],
  'not difficult at all': ['not difficult', 'no difficulty', 'easy', 'fine'],
  'somewhat difficult': ['somewhat difficult', 'a little difficult', 'bit difficult'],
  'very difficult': ['very difficult', 'really difficult', 'hard'],
  'extremely difficult': ['extremely difficult', 'impossible', 'very hard'],
  'no': ['no', 'nope', 'not now', "i'm not", 'i am not'],
  'yes': ['yes', 'yeah', 'i am', 'i have'],
  "i'd rather not say": ["rather not", 'prefer not', 'skip', "don't want to say", 'pass'],
};

/**
 * Match a typed or spoken answer to one of the question's options. Returns null when unclear,
 * so the companion asks again. The match is only highlighted; the patient taps to record it.
 */
export function matchOption(question: Question, text: string): number | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const options = question.options ?? [];
  const digit = lower.match(/\b(\d+)\b/);
  if (digit && options.some(o => o.value === Number(digit[1]))) return Number(digit[1]);
  // Longest phrase wins, so "a little less" beats "a little" and "not at all" beats "no".
  const phrases = options.flatMap(o => [o.label.toLowerCase(), ...(SYNONYMS[o.label.toLowerCase()] ?? [])].map(p => ({ p, value: o.value })));
  phrases.sort((a, b) => b.p.length - a.p.length);
  const hit = phrases.find(({ p }) => lower.includes(` ${p} `));
  return hit ? hit.value : null;
}

/** "my mood is a 6 now", "slept 7 hours": a check-in update the patient states in conversation. */
export function checkInUpdate(text: string): { kind: 'mood' | 'energy' | 'sleep_hours'; value: string } | null {
  const lower = text.toLowerCase();
  if (!/\d|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve/.test(lower)) return null;
  if (/\b(slept|sleep|sleeping|hours? of sleep)\b/.test(lower)) return { kind: 'sleep_hours', value: text };
  if (/\b(energy|energetic|tired)\b/.test(lower)) return { kind: 'energy', value: text };
  if (/\b(mood|feel|feeling)\b/.test(lower)) return { kind: 'mood', value: text };
  return null;
}

export const wantsAssessment = (text: string) =>
  /\b(full|fuller|deeper|longer)\b.*\b(check|assessment|questions)\b|\bquestionnaire\b|\bassessment\b|\bphq\b/i.test(text);
