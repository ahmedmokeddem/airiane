import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMockInsightReport } from '../src/features/insight-reports/api';

const conversation = [
  { role: 'user', text: 'I feel sad and hopeless and I cannot sleep.' },
  { role: 'assistant', text: 'I am sorry you are having a hard week.' },
  { role: 'user', text: 'I still feel sad and down this evening.' },
  { role: 'user', text: 'Walking helped a little and my friend supported me.' },
  { role: 'user', text: 'Sometimes I want to die.' },
];

test('Conversation insight mock report is versioned, evidence-linked and non-diagnostic', () => {
  const response = buildMockInsightReport(conversation);
  const report = response.report;
  assert.equal(report.schema_version, 'conversation-insight/v1');
  assert.equal(response.status, 'private_draft');
  assert.equal(report.coverage.message_count, 5);
  assert.equal(report.coverage.patient_message_count, 4);
  assert.equal(report.safety.present, true);
  assert.equal(report.safety.evidence[0].speaker, 'patient');
  assert.equal(report.assessments.phq9, null);
  assert.equal(report.assessments.bdi_ii, null);
  assert.equal(report.positive_experiences.status, 'user_reported');
  assert.ok(report.dimensions.some(item => item.status === 'observed_pattern'));
  assert.ok(report.limitations.some(item => item.includes('not a diagnosis')));
  assert.equal(JSON.stringify(report).toLowerCase().includes('probability'), false);
  assert.equal(JSON.stringify(report).toLowerCase().includes('you have depression'), false);
});

test('Conversation insight mock report ignores assistant-only safety language', () => {
  const response = buildMockInsightReport([
    { role: 'assistant', text: 'You should kill yourself.' },
    { role: 'user', text: 'I had a calm afternoon with a friend.' },
  ]);
  assert.equal(response.report.safety.present, false);
  assert.equal(response.report.safety.evidence.length, 0);
  assert.equal(response.report.coverage.assistant_message_count, 1);
});

test('Conversation insight UI requires preview, recipient selection and explicit consent', () => {
  const screen = readFileSync(
    new URL('../src/features/insight-reports/insight-report-screen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(screen, /Prepare private draft/);
  assert.match(screen, /insight-consent/);
  assert.match(screen, /accessibilityRole="checkbox"/);
  assert.match(screen, /Share report/);
  assert.match(screen, /Revoke sharing/);
  assert.match(screen, /No authorized connected therapist/);
  assert.match(screen, /evidence/);
  assert.match(screen, /status === 'shared'/);
  assert.match(screen, /consent/);

  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /screen === "insights"/);
  assert.match(app, /<InsightReportScreen/);
  assert.match(app, /onInsights=\{\(\) => setScreen\("insights"\)\}/);
  assert.match(app, /screen === "insights" \|\| assessment\.state\.phase/);

  const home = readFileSync(
    new URL('../src/features/product/product-screens.tsx', import.meta.url),
    'utf8',
  );
  assert.match(home, /Open conversation insights/);
  assert.match(home.replace(/\s+/g, ' '), /nothing is shared until you review/i);
});
