/**
 * Project-authorized adapted BDI-II-themed questionnaire.
 *
 * The hackathon project owner has authorized use of the project's BDI-II material. The
 * repository does not contain the licensed standard instrument's item-specific response
 * statements, so this feature uses the project's existing paraphrased item wording and the
 * existing project-defined intensity choices. It is therefore labelled as adapted/indicative
 * and must not be presented as the validated standard BDI-II.
 *
 * Sources used by the project:
 * - assets/Book1.ods (Sheet1/Sheet2/Sheet3)
 * - backend/app/assessments.py (existing authorized project content)
 */

export type BDIQuestionId =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'q6'
  | 'q7'
  | 'q8'
  | 'q9'
  | 'q10'
  | 'q11'
  | 'q12'
  | 'q13'
  | 'q14'
  | 'q15'
  | 'q16'
  | 'q17'
  | 'q18'
  | 'q19'
  | 'q20'
  | 'q21';

export type BDIResponseValue = 0 | 1 | 2 | 3;

export type BDISeverity = 'Minimal' | 'Mild' | 'Moderate' | 'Severe';

export type BDIPreliminaryLevel = 'low' | 'moderate' | 'high';

export interface BDIOption {
  value: BDIResponseValue;
  label: string;
}

export interface BDIQuestion {
  id: BDIQuestionId;
  number: number;
  title: string;
  prompt: string;
  options: readonly BDIOption[];
}

export const BDI_TITLE = 'BDI-II (adapted themes) — Extended Depression Check';

export const BDI_SHORT_TITLE = 'BDI-II (adapted themes)';

export const BDI_INSTRUMENT_VERSION = 'adapted-1';

export const BDI_INTRO =
  'This 21-item check is based on project-provided BDI-II themes. It asks about how you ' +
  'have been feeling over the past two weeks. It is an adapted, indicative self-reflection ' +
  'tool, not the licensed standard BDI-II, and it does not provide a diagnosis.';

export const BDI_TIMEFRAME =
  'Thinking about the past two weeks, including today, choose the answer that fits best for each item.';

export const BDI_GUIDANCE = [
  'There are 21 items and four response options for each item.',
  'Choose one answer per item. Selecting another option changes your answer.',
  'Every item must be answered before a result can be calculated.',
  'This adapted check is not the validated standard BDI-II and does not provide a diagnosis.',
  'You may leave at any time. Nothing is saved or shared automatically.',
] as const;

export const BDI_PRIVACY_NOTE =
  'Your answers are scored on this screen only. They are not saved or shared automatically.';

export const BDI_INCOMPLETE_SUMMARY =
  'Your result is only calculated when all 21 items have one answer. Please answer the items highlighted in the form.';

export const BDI_SOURCE_NOTE =
  'Adapted from project-provided BDI-II themes. The wording and response choices are ' +
  'project-defined, not the licensed standard BDI-II, and the result is indicative only.';

export const BDI_DISCLAIMER =
  'This adapted questionnaire is a self-reflection and screening aid, not a diagnostic test. ' +
  'It is not the validated standard BDI-II. Your result does not confirm or rule out depression. ' +
  'A qualified healthcare professional can assess your symptoms and determine whether further ' +
  'evaluation or support is appropriate.';

export const BDI_CITATIONS = [
  'https://www.hiv.uw.edu/page/mental-health-screening/phq-9',
  'https://www.healthquality.va.gov/guidelines/MH/mdd/VADoDMDDCPGFinal508.pdf',
  'https://www.apa.org/depression-guideline/assessment',
  'https://pmc.ncbi.nlm.nih.gov/articles/PMC3782729/',
] as const;

export const BDI_MAX_SCORE = 63;

export const BDI_INTENSITY_OPTIONS: readonly BDIOption[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little' },
  { value: 2, label: 'Quite a lot' },
  { value: 3, label: 'Very much' },
];

/** Q4 asks about enjoyment, so more enjoyment must score lower. */
export const BDI_Q4_OPTIONS: readonly BDIOption[] = [
  { value: 0, label: 'As much as usual' },
  { value: 1, label: 'A little less' },
  { value: 2, label: 'Much less' },
  { value: 3, label: 'None at all' },
];

const question = (
  number: number,
  title: string,
  prompt: string,
  options: readonly BDIOption[] = BDI_INTENSITY_OPTIONS,
): BDIQuestion => ({
  id: `q${number}` as BDIQuestionId,
  number,
  title,
  prompt,
  options,
});

export const BDI_QUESTIONS: readonly BDIQuestion[] = [
  question(
    1,
    'Sadness',
    'How frequently have you experienced feelings of sadness or emotional distress during the past two weeks?',
  ),
  question(
    2,
    'Pessimism',
    'How pessimistic have you felt about your future and the possibility of positive things happening in your life?',
  ),
  question(
    3,
    'Sense of failure',
    'To what extent have you felt unsuccessful or believed that you have failed in important areas of your life?',
  ),
  question(
    4,
    'Loss of pleasure',
    'How much enjoyment or satisfaction have you experienced from activities that previously made you happy?',
    BDI_Q4_OPTIONS,
  ),
  question(
    5,
    'Guilt',
    'How frequently have you experienced feelings of guilt or blamed yourself for things that happened?',
  ),
  question(
    6,
    'Feelings of punishment',
    'Have you experienced feelings that you deserve to be punished or that something negative is happening to you as a form of punishment?',
  ),
  question(
    7,
    'Self-dislike',
    'How negatively have you felt about yourself, including feelings of disappointment or dissatisfaction with who you are?',
  ),
  question(
    8,
    'Self-criticism',
    'How frequently have you criticized yourself or blamed yourself for mistakes and shortcomings?',
  ),
  question(
    9,
    'Suicidal thoughts or wishes',
    'Have you experienced thoughts about death, not wanting to live, or ending your own life?',
  ),
  question(
    10,
    'Crying',
    'How frequently have you experienced episodes of crying or felt an increased urge to cry?',
  ),
  question(
    11,
    'Loss of interest',
    'How much has your interest in other people, social activities, hobbies, or everyday experiences decreased?',
  ),
  question(
    12,
    'Indecisiveness',
    'How difficult has it been for you to make decisions, including relatively simple decisions in everyday life?',
  ),
  question(
    13,
    'Worthlessness',
    'To what extent have you felt worthless, inadequate, or less valuable as a person?',
  ),
  question(
    14,
    'Loss of energy',
    'How much has your overall energy level decreased, making everyday activities more difficult to complete?',
  ),
  question(
    15,
    'Changes in sleeping patterns',
    'Have you experienced noticeable changes in your sleeping patterns, including sleeping less or more than usual?',
  ),
  question(
    16,
    'Irritability',
    'How easily have you become irritated, frustrated, or emotionally upset by situations that normally would not bother you?',
  ),
  question(
    17,
    'Changes in appetite',
    'Have you experienced significant changes in your appetite, including eating less or more than your usual amount?',
  ),
  question(
    18,
    'Concentration difficulties',
    'How difficult has it been for you to maintain concentration, focus on tasks, or follow conversations?',
  ),
  question(
    19,
    'Tiredness or fatigue',
    'How frequently have you felt physically or mentally exhausted, even when you have not engaged in particularly demanding activities?',
  ),
  question(
    20,
    'Loss of interest in sex',
    'To what extent has your interest in sexual activity or intimacy decreased compared with your usual level?',
  ),
  question(
    21,
    'Agitation',
    'How frequently have you experienced restlessness, difficulty remaining still, or an increased need to move around?',
  ),
];

export const BDI_QUESTION_IDS: readonly BDIQuestionId[] = BDI_QUESTIONS.map(
  question => question.id,
);

export interface BDISeverityBand {
  min: number;
  max: number;
  severity: BDISeverity;
  preliminaryLevel: BDIPreliminaryLevel;
  preliminaryLabel: string;
  interpretation: string;
  nextSteps: readonly string[];
}

export const BDI_SEVERITY_BANDS: readonly BDISeverityBand[] = [
  {
    min: 0,
    max: 13,
    severity: 'Minimal',
    preliminaryLevel: 'low',
    preliminaryLabel: 'Low concern',
    interpretation:
      'Your responses indicate minimal or no depressive symptoms over the past two weeks. ' +
      'These results come from an adapted, indicative questionnaire and do not establish a diagnosis.',
    nextSteps: [
      'Reflect on how these experiences have affected your everyday activities.',
      'You may revisit this check later as part of an appropriate monitoring plan.',
    ],
  },
  {
    min: 14,
    max: 19,
    severity: 'Mild',
    preliminaryLevel: 'moderate',
    preliminaryLabel: 'Moderate concern',
    interpretation:
      'Your responses indicate a mild level of depressive symptoms over the past two weeks. ' +
      'These results come from an adapted, indicative questionnaire and do not establish a diagnosis. ' +
      'Consider discussing your experiences with a qualified mental health professional.',
    nextSteps: [
      'Consider discussing these results with a qualified therapist or healthcare professional.',
      'Reflect on how these experiences have affected your everyday activities.',
      'You may revisit this check later as part of an appropriate monitoring plan.',
    ],
  },
  {
    min: 20,
    max: 28,
    severity: 'Moderate',
    preliminaryLevel: 'moderate',
    preliminaryLabel: 'Moderate concern',
    interpretation:
      'Your responses indicate a moderate level of depressive symptoms over the past two weeks. ' +
      'These results come from an adapted, indicative questionnaire and do not establish a diagnosis. ' +
      'Consider discussing your experiences with a qualified mental health professional.',
    nextSteps: [
      'Consider discussing these results with a qualified therapist or healthcare professional.',
      'Reflect on how these experiences have affected your everyday activities.',
      'You may revisit this check later as part of an appropriate monitoring plan.',
    ],
  },
  {
    min: 29,
    max: 63,
    severity: 'Severe',
    preliminaryLevel: 'high',
    preliminaryLabel: 'High concern',
    interpretation:
      'Your responses indicate a severe level of depressive symptoms over the past two weeks. ' +
      'These results come from an adapted, indicative questionnaire and do not establish a diagnosis. ' +
      'Consider discussing your experiences with a qualified mental health professional soon.',
    nextSteps: [
      'Consider reaching out to a qualified therapist or healthcare professional soon.',
      'If you have a trusted person, you may find it helpful to tell them how you have been feeling.',
      'You may revisit this check later as part of an appropriate monitoring plan.',
    ],
  },
];

export const BDI_SAFETY_COPY = {
  eyebrow: 'SAFETY SUPPORT',
  title: 'You don’t have to carry this alone',
  lead:
    'You answered item 9 with something other than “Not at all”. This notice is separate ' +
    'from your total score. It can be a sign that extra support or a safety conversation may be helpful.',
  support:
    'Consider telling someone you trust, or contacting a qualified mental health professional.',
  immediate:
    'If you are in immediate danger, call 112 now. Outside Finland, call your local emergency number.',
  limitation:
    'AIriane is not monitored in real time. This notice does not classify your level of risk.',
} as const;

export function bdiQuestionById(id: BDIQuestionId): BDIQuestion {
  const found = BDI_QUESTIONS.find(item => item.id === id);
  if (!found) throw new Error(`Unknown BDI-II question: ${id}`);
  return found;
}

export function bdiOptionLabel(questionId: BDIQuestionId, value: BDIResponseValue): string {
  const found = bdiQuestionById(questionId).options.find(option => option.value === value);
  return found?.label ?? String(value);
}
