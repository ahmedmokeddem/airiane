import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PHQ9_DISCLAIMER,
  PHQ9_INTERPRETATIONS,
  PHQ9_NEXT_STEPS,
  PHQ9_QUESTIONS,
  PHQ9_RESPONSE_OPTIONS,
  PHQ9_SAFETY_COPY,
  PHQ9_TITLE,
} from '../src/features/phq9/phq9-config';

const featureDir = fileURLToPath(new URL('../src/features/phq9/', import.meta.url));
const source = (file: string) => readFileSync(`${featureDir}${file}`, 'utf8');

test('PHQ-9 UI contract: the nine standard items and four response options are centralised', () => {
  assert.equal(PHQ9_TITLE, 'Depression Symptom Screening (PHQ-9)');
  assert.deepEqual(
    PHQ9_QUESTIONS.map(question => question.id),
    ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'],
  );
  assert.deepEqual(
    PHQ9_QUESTIONS.map(question => question.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.deepEqual(
    PHQ9_QUESTIONS.map(question => question.prompt),
    [
      'Little interest or pleasure in doing things?',
      'Feeling down, depressed, or hopeless?',
      'Trouble falling or staying asleep, or sleeping too much?',
      'Feeling tired or having little energy?',
      'Poor appetite or overeating?',
      'Feeling bad about yourself — or that you are a failure or have let yourself or your family down?',
      'Trouble concentrating on things, such as reading the newspaper or watching television?',
      'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?',
      'Thoughts that you would be better off dead or of hurting yourself in some way?',
    ],
  );
  assert.deepEqual(PHQ9_RESPONSE_OPTIONS, [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ]);
});

test('PHQ-9 UI contract: all nine cards render from one config map, not nine copies', () => {
  const screen = source('phq9-assessment-screen.tsx');
  assert.match(screen, /PHQ9_QUESTIONS\.map\(/);
  assert.match(screen, /<PHQ9QuestionCard/);
  const card = source('phq9-question-card.tsx');
  assert.match(card, /PHQ9_RESPONSE_OPTIONS\.map\(/);
  assert.match(card, /<PHQ9ResponseOption/);
});

test('PHQ-9 UI contract: each question is a radio group with keyboard-focusable radios', () => {
  const option = source('phq9-response-option.tsx');
  assert.match(option, /accessibilityRole="radio"/);
  assert.match(option, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(option, /focusable/);
  const card = source('phq9-question-card.tsx');
  assert.match(card, /accessibilityRole="radiogroup"/);
});

test('PHQ-9 UI contract: options wrap on narrow screens and show the numeric score', () => {
  const option = source('phq9-response-option.tsx');
  assert.match(option, /flexBasis: 160/);
  assert.match(option, /\{option\.value\}/);
  const card = source('phq9-question-card.tsx');
  assert.match(card, /flexWrap: 'wrap'/);
});

test('PHQ-9 UI contract: progress, incomplete validation and exit are present', () => {
  const screen = source('phq9-assessment-screen.tsx');
  assert.match(screen, /<PHQ9ProgressIndicator/);
  assert.match(screen, /phq9-validation-summary/);
  assert.match(screen, /PHQ9_INCOMPLETE_SUMMARY/);
  assert.match(screen, /unanswered\.map/);
  assert.match(screen, /phq9-leave/);
  assert.match(screen, /Leave without finishing/);
});

test('PHQ-9 UI contract: results show total, severity, interpretation, steps and disclaimer', () => {
  const results = source('phq9-results.tsx');
  assert.match(results, /PHQ-9 Total Score:/);
  assert.match(results, /\{assessment\.totalScore\}/);
  assert.match(results, /PHQ9_MAX_SCORE/);
  assert.match(results, /phq9-severity/);
  assert.match(results, /PHQ9_INTERPRETATIONS\[assessment\.severity\]/);
  assert.match(results, /PHQ9_NEXT_STEPS\[assessment\.severity\]/);
  assert.match(results, /PHQ9_DISCLAIMER/);
  assert.match(results, /phq9-disclaimer/);
});

test('PHQ-9 UI contract: the Q9 notice is independent of the total score', () => {
  const results = source('phq9-results.tsx');
  assert.match(results, /assessment\.q9SafetyFlag \? <PHQ9SafetyNotice \/> : null/);
  assert.match(results, /PHQ9_INTERPRETATIONS\[assessment\.severity\]/);

  const screen = source('phq9-assessment-screen.tsx');
  assert.match(screen, /state\.answers\.q9 \?\? 0\) > 0/);
  assert.match(screen, /<PHQ9SafetyNotice compact \/>/);

  const notice = source('phq9-safety-notice.tsx');
  assert.match(notice, /phq9-safety-notice/);
  assert.match(notice, /CRISIS_EMERGENCY_LINK/);
  assert.match(notice, /CRISIS_HELPLINE_LINK/);
  assert.match(notice, /PHQ9_SAFETY_COPY/);
});

test('PHQ-9 integration: route, entry points and nudge blocking are wired', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /import \{ PHQ9AssessmentScreen \}/);
  assert.match(app, /screen === "phq9"/);
  assert.match(app, /screen === "bdi"/);
  assert.match(app, /screen === "assessments"/);
  assert.match(app, /onAssessments=\{\(\) => setScreen\("assessments"\)\}/);
  assert.match(
    app,
    /blocked: immersive \|\| screen === "breathing" \|\| screen === "phq9" \|\| screen === "bdi" \|\| screen === "assessments"/,
  );

  const screens = readFileSync(
    new URL('../src/features/product/product-screens.tsx', import.meta.url),
    'utf8',
  );
  assert.match(screens, /onAssessments\?: \(\) => void/);
  assert.match(screens, /PHQ-9 and adapted BDI-II/);
  assert.match(screens, /Open Assessment Center/);
});

test('PHQ-9 UI contract: the incomplete summary is announced beside the submit action', () => {
  const screen = source('phq9-assessment-screen.tsx');
  assert.match(screen, /accessibilityLiveRegion="assertive"/);
  assert.match(screen, /phq9-validation-summary/);
  assert.match(screen, /<Button label="See my result" onPress=\{submit\} \/>/);
});

test('PHQ-9 UI contract: the safety alert wraps the message, not the action buttons', () => {
  const notice = source('phq9-safety-notice.tsx');
  assert.match(notice, /accessibilityRole="alert"/);
  assert.match(notice, /style=\{s\.message\}/);
  assert.match(notice, /PHQ9_SAFETY_COPY\.lead/);
});

test('PHQ-9 copy: preliminary screening is never presented as a diagnosis or probability', () => {
  const allCopy = [
    PHQ9_DISCLAIMER,
    ...Object.values(PHQ9_INTERPRETATIONS),
    ...Object.values(PHQ9_NEXT_STEPS).flat(),
    ...Object.values(PHQ9_SAFETY_COPY),
  ]
    .join(' ')
    .toLowerCase();

  assert.match(allCopy, /screening tool, not a diagnostic test/);
  assert.match(allCopy, /do not establish a diagnosis/);
  for (const forbidden of [
    'you have depression',
    'clinically depressed',
    'probability',
    'percent chance',
    '80%',
    'prescribe',
    'start medication',
  ]) {
    assert.equal(allCopy.includes(forbidden), false, `copy must not contain “${forbidden}”`);
  }
});

test('PHQ-9 isolation: the feature performs no network, chatbot or model call', () => {
  for (const file of readdirSync(featureDir)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const text = source(file);
    for (const forbidden of [
      'fetch(',
      '/v1/',
      'api.',
      'openai',
      'llm',
      'gemini',
      'elevenlabs',
      'localstorage',
      'sessionstorage',
      'asyncstorage',
    ]) {
      assert.equal(
        text.toLowerCase().includes(forbidden),
        false,
        `${file} must not reference ${forbidden}`,
      );
    }
  }
});
