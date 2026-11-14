import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BDI_DISCLAIMER,
  BDI_INTENSITY_OPTIONS,
  BDI_Q4_OPTIONS,
  BDI_QUESTIONS,
  BDI_SOURCE_NOTE,
  BDI_TITLE,
} from '../src/features/bdi/bdi-config';

const bdiDir = fileURLToPath(new URL('../src/features/bdi/', import.meta.url));
const source = (file: string) => readFileSync(`${bdiDir}${file}`, 'utf8');
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Adapted BDI-II UI: 21 items and per-item options are centralised', () => {
  assert.equal(BDI_QUESTIONS.length, 21);
  assert.deepEqual(
    BDI_QUESTIONS.map(question => question.number),
    Array.from({ length: 21 }, (_, index) => index + 1),
  );
  assert.deepEqual(BDI_INTENSITY_OPTIONS.map(option => option.label), [
    'Not at all',
    'A little',
    'Quite a lot',
    'Very much',
  ]);
  assert.deepEqual(BDI_Q4_OPTIONS.map(option => option.label), [
    'As much as usual',
    'A little less',
    'Much less',
    'None at all',
  ]);
  assert.equal(BDI_QUESTIONS[3].options, BDI_Q4_OPTIONS);
  assert.match(BDI_TITLE, /adapted/i);
});

test('Adapted BDI-II UI: all 21 cards render from one config map', () => {
  const screen = source('bdi-assessment-screen.tsx');
  assert.match(screen, /BDI_QUESTIONS\.map\(/);
  assert.match(screen, /<BDIQuestionCard/);
  const card = source('bdi-question-card.tsx');
  assert.match(card, /question\.options\.map\(/);
  assert.match(card, /<BDIResponseOption/);
});

test('Adapted BDI-II UI: radio groups, keyboard focus, numeric scores and wrapping', () => {
  const card = source('bdi-question-card.tsx');
  assert.match(card, /accessibilityRole="radiogroup"/);
  assert.match(card, /flexWrap: 'wrap'/);
  const option = source('bdi-response-option.tsx');
  assert.match(option, /accessibilityRole="radio"/);
  assert.match(option, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(option, /focusable/);
  assert.match(option, /flexBasis: 160/);
  assert.match(option, /option\.value/);
});

test('Adapted BDI-II UI: progress, validation, submit and exit are present', () => {
  const screen = source('bdi-assessment-screen.tsx');
  assert.match(screen, /<BDIProgressIndicator/);
  assert.match(screen, /bdi-validation-summary/);
  assert.match(screen, /BDI_INCOMPLETE_SUMMARY/);
  assert.match(screen, /unanswered\.map/);
  assert.match(screen, /<Button label="See my result"/);
  assert.match(screen, /bdi-leave/);
  assert.match(screen, /Leave without finishing/);
});

test('Adapted BDI-II UI: results show score, four-level severity, date, preliminary level and disclaimer', () => {
  const results = source('bdi-results.tsx');
  assert.match(results, /Adapted BDI-II Score:/);
  assert.match(results, /assessment\.totalScore/);
  assert.match(results, /BDI_MAX_SCORE/);
  assert.match(results, /assessment\.completedAt/);
  assert.match(results, /bdi-severity/);
  assert.match(results, /bdi-preliminary-level/);
  assert.match(results, /BDI_SEVERITY_BANDS/);
  assert.match(results, /BDI_DISCLAIMER/);
  assert.match(results, /BDI_SOURCE_NOTE/);
  assert.match(results, /BDI_CITATIONS/);
});

test('Adapted BDI-II safety: item 9 notice is independent of the total score', () => {
  const results = source('bdi-results.tsx');
  assert.match(results, /assessment\.q9SafetyFlag \? <BDISafetyNotice \/> : null/);
  const screen = source('bdi-assessment-screen.tsx');
  assert.match(screen, /question\.id === 'q9' && \(state\.answers\.q9 \?\? 0\) > 0/);
  const notice = source('bdi-safety-notice.tsx');
  assert.match(notice, /bdi-safety-notice/);
  assert.match(notice, /CRISIS_EMERGENCY_LINK/);
  assert.match(notice, /CRISIS_HELPLINE_LINK/);
  assert.match(notice, /accessibilityRole="alert"/);
});

test('Adapted BDI-II copy: adapted/indicative labeling is explicit and non-diagnostic', () => {
  const copy = [BDI_TITLE, BDI_SOURCE_NOTE, BDI_DISCLAIMER].join(' ').toLowerCase();
  assert.match(copy, /adapted/);
  assert.match(copy, /indicative/);
  assert.match(copy, /not the validated standard bdi-ii/);
  assert.match(copy, /not a diagnostic test/);
  for (const forbidden of ['you have depression', 'clinically depressed', 'probability', '80%']) {
    assert.equal(copy.includes(forbidden), false, `copy must not contain “${forbidden}”`);
  }
});

test('Adapted BDI-II isolation: no network, model or persistence calls', () => {
  for (const file of readdirSync(bdiDir)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const text = source(file).toLowerCase();
    for (const forbidden of [
      'fetch(',
      '/v1/',
      'api.',
      'openai',
      'llm',
      'gemini',
      'elevenlabs',
      'localstorage',
      'asyncstorage',
    ]) {
      assert.equal(text.includes(forbidden), false, `${file} must not reference ${forbidden}`);
    }
  }
});

test('Assessment Center: both instruments are present and remain independent', () => {
  const center = read('../src/features/assessments/assessment-center-screen.tsx');
  assert.match(center, /assessment-phq9/);
  assert.match(center, /assessment-bdi/);
  assert.match(center, /onPHQ9/);
  assert.match(center, /onBDI/);
  assert.match(center, /does not combine their scores/);
  const history = read('../src/features/assessments/assessment-history.ts');
  assert.match(history, /'PHQ-9'/);
  assert.match(history, /'BDI-II-adapted'/);
  assert.match(history, /emptyAssessmentHistory/);
});

test('Assessment integration: routes and nudge blocking cover both instruments', () => {
  const app = read('../App.tsx');
  assert.match(app, /screen === "phq9"/);
  assert.match(app, /screen === "bdi"/);
  assert.match(app, /screen === "assessments"/);
  assert.match(app, /onAssessments=\{\(\) => setScreen\("assessments"\)\}/);
  assert.match(
    app,
    /blocked: immersive \|\| screen === "breathing" \|\| screen === "phq9" \|\| screen === "bdi" \|\| screen === "assessments"/,
  );
  const screens = read('../src/features/product/product-screens.tsx');
  assert.match(screens, /PHQ-9 and adapted BDI-II/);
  assert.match(screens, /Open Assessment Center/);
});
