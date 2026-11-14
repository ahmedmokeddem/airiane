/**
 * Central PHQ-9 questionnaire configuration and copy.
 *
 * This is a standalone screening feature. It intentionally does not reuse the conversational
 * assessment flow or the backend assessment tables, which combine several questionnaires and
 * have different severity bands. Keeping the wording and scoring here makes the feature easy to
 * isolate, review and translate later.
 */

export type PHQ9QuestionId =
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "q7"
  | "q8"
  | "q9";

/** PHQ-9 responses are the integers 0–3; the number itself is the score. */
export type PHQ9ResponseValue = 0 | 1 | 2 | 3;

export type PHQ9Severity =
  | "Minimal"
  | "Mild"
  | "Moderate"
  | "Moderately Severe"
  | "Severe";

export interface PHQ9Option {
  value: PHQ9ResponseValue;
  label: string;
}

export interface PHQ9Question {
  id: PHQ9QuestionId;
  /** 1-based position shown as “Q1”. */
  number: number;
  /** Short, friendly heading; the standard wording is `prompt`. */
  title: string;
  prompt: string;
}

export const PHQ9_RESPONSE_OPTIONS: readonly PHQ9Option[] = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

/** The nine standard English PHQ-9 items, in order. Do not reword without review. */
export const PHQ9_QUESTIONS: readonly PHQ9Question[] = [
  {
    id: "q1",
    number: 1,
    title: "Little interest or pleasure",
    prompt: "Little interest or pleasure in doing things?",
  },
  {
    id: "q2",
    number: 2,
    title: "Depressed mood",
    prompt: "Feeling down, depressed, or hopeless?",
  },
  {
    id: "q3",
    number: 3,
    title: "Sleep disturbance",
    prompt: "Trouble falling or staying asleep, or sleeping too much?",
  },
  {
    id: "q4",
    number: 4,
    title: "Fatigue",
    prompt: "Feeling tired or having little energy?",
  },
  {
    id: "q5",
    number: 5,
    title: "Appetite changes",
    prompt: "Poor appetite or overeating?",
  },
  {
    id: "q6",
    number: 6,
    title: "Negative self-perception",
    prompt:
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down?",
  },
  {
    id: "q7",
    number: 7,
    title: "Concentration difficulties",
    prompt:
      "Trouble concentrating on things, such as reading the newspaper or watching television?",
  },
  {
    id: "q8",
    number: 8,
    title: "Psychomotor changes",
    // The standalone feature follows the supplied task wording ("a lot more"). The existing
    // conversational assessment uses a different rendering and is intentionally unchanged.
    prompt:
      "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?",
  },
  {
    id: "q9",
    number: 9,
    title: "Thoughts of death or self-harm",
    prompt:
      "Thoughts that you would be better off dead or of hurting yourself in some way?",
  },
];

export const PHQ9_QUESTION_IDS: readonly PHQ9QuestionId[] = PHQ9_QUESTIONS.map(
  (question) => question.id,
);

export const PHQ9_MAX_SCORE = 27;
export const PHQ9_MIN_SCORE = 0;

export const PHQ9_TITLE = "Depression Symptom Screening (PHQ-9)";

export const PHQ9_INTRO =
  "Take a moment to reflect on how you have been feeling over the past two weeks. This questionnaire helps you assess the frequency of common depressive symptoms. Your results may help you understand whether further professional assessment could be useful.";

export const PHQ9_TIMEFRAME =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems? Count the previous two weeks, including today.";

export const PHQ9_GUIDANCE: readonly string[] = [
  "There are nine questions, each with four response options.",
  "Choose one response per question. Selecting another option changes your answer.",
  "Your score is calculated only when all nine questions are answered.",
  "This questionnaire does not provide a medical diagnosis.",
  "You may leave the assessment at any time. Nothing is saved or shared.",
];

export const PHQ9_DISCLAIMER =
  "This questionnaire is a screening tool, not a diagnostic test. Your result does not confirm or rule out depression. A qualified healthcare professional can assess your symptoms and determine whether further evaluation or support is appropriate.";

export const PHQ9_PRIVACY_NOTE =
  "Your answers are scored on this device and are not saved, sent or shared with anyone from this screen.";

export const PHQ9_INCOMPLETE_SUMMARY =
  "Your result is only calculated when all nine questions are answered. Please choose one response for each unanswered question highlighted in the form.";

export interface PHQ9SeverityBand {
  min: number;
  max: number;
  severity: PHQ9Severity;
}

export const PHQ9_SEVERITY_BANDS: readonly PHQ9SeverityBand[] = [
  { min: 0, max: 4, severity: "Minimal" },
  { min: 5, max: 9, severity: "Mild" },
  { min: 10, max: 14, severity: "Moderate" },
  { min: 15, max: 19, severity: "Moderately Severe" },
  { min: 20, max: 27, severity: "Severe" },
];

/**
 * Neutral, non-diagnostic explanations. Each one states that the result is self-reported and
 * does not establish a diagnosis, and suggests professional assessment without prescribing care.
 */
export const PHQ9_INTERPRETATIONS: Readonly<Record<PHQ9Severity, string>> = {
  Minimal:
    "Your responses indicate minimal or no depressive symptoms over the past two weeks. These results are based on self-reported information and do not establish a diagnosis of depression. If things change or you are concerned, consider discussing your experiences with a qualified mental health professional.",
  Mild: "Your responses indicate a mild level of depressive symptoms over the past two weeks. These results are based on self-reported information and do not establish a diagnosis of depression. Consider discussing your experiences with a qualified mental health professional if these symptoms persist or affect your daily life.",
  Moderate:
    "Your responses indicate a moderate level of depressive symptoms over the past two weeks. These results are based on self-reported information and do not establish a diagnosis of depression. Consider discussing your experiences with a qualified mental health professional.",
  "Moderately Severe":
    "Your responses indicate a moderately severe level of depressive symptoms over the past two weeks. These results are based on self-reported information and do not establish a diagnosis of depression. Consider discussing your experiences with a qualified mental health professional soon.",
  Severe:
    "Your responses indicate a severe level of depressive symptoms over the past two weeks. These results are based on self-reported information and do not establish a diagnosis of depression. Please consider reaching out to a qualified mental health professional soon; you do not have to wait for things to get harder.",
};

/** Simple, non-prescriptive next steps. No medication or treatment plan is recommended. */
export const PHQ9_NEXT_STEPS: Readonly<Record<PHQ9Severity, readonly string[]>> = {
  Minimal: [
    "Reflect on how these experiences have affected your everyday activities.",
    "You may revisit the questionnaire later as part of an appropriate monitoring plan.",
  ],
  Mild: [
    "Consider discussing the results with a qualified therapist or healthcare professional if the experiences continue.",
    "Reflect on how these experiences have affected your everyday activities.",
    "You may revisit the questionnaire later as part of an appropriate monitoring plan.",
  ],
  Moderate: [
    "Consider discussing the results with a qualified therapist or healthcare professional.",
    "Reflect on how these experiences have affected your everyday activities.",
    "You may revisit the questionnaire later as part of an appropriate monitoring plan.",
  ],
  "Moderately Severe": [
    "Consider discussing the results with a qualified therapist or healthcare professional soon.",
    "If you have a trusted person, you may find it helpful to tell them how you have been feeling.",
    "You may revisit the questionnaire later as part of an appropriate monitoring plan.",
  ],
  Severe: [
    "Please consider discussing the results with a qualified therapist or healthcare professional soon.",
    "If you have a trusted person, you may find it helpful to tell them how you have been feeling.",
    "You may revisit the questionnaire later as part of an appropriate monitoring plan.",
  ],
};

/**
 * Question 9 safety copy. It is deliberately separate from the severity interpretation and never
 * turns a positive Q9 answer into an automatic emergency classification or diagnosis.
 */
export const PHQ9_SAFETY_COPY = {
  eyebrow: "SAFETY SUPPORT",
  title: "You don’t have to carry this alone",
  lead: "You answered question 9 with something other than “Not at all”. This notice is separate from your total score. It can be a sign that extra support or a safety conversation may be helpful.",
  encourage:
    "Consider telling someone you trust, or contacting a qualified mental health professional.",
  emergency:
    "If you are in immediate danger, call 112 now. Outside Finland, call your local emergency number.",
  limitation:
    "This notice does not classify your level of risk, and AIriane is not monitored in real time.",
} as const;
