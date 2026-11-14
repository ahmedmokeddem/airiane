import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../contracts/fixtures/report.json';
import type { DTO } from '../src/integration/types';
import { reportFacts } from '../src/features/reports/patient-report-model';
const base = fixture.data as DTO<'Report'>;
test('patient report keeps absent insights and observations absent; never invents a clinical score', () => {
 const facts = reportFacts({ ...base, confirmed_insights: [], observations: [], assessments: [] });
 assert.deepEqual(facts.themes, []); assert.deepEqual(facts.series, []); assert.deepEqual(facts.assessments, []);
 assert.equal('clinicalScore' in facts, false);
});
test('patient report theme counts use current confirmed records and label interpretations by their stored origin', () => {
 const insight: DTO<'ConfirmedInsight'> = { insight_id: 'insight', patient_id: base.patient_id, session_id: null, theme: 'sleep', text: 'I had trouble falling asleep.', observed_at: base.period_start, confirmed_at: base.period_end, version: 1, state: 'confirmed', supersedes_insight_id: null, sources: [], statement_kind: 'patient_approved_interpretation' };
 const facts = reportFacts({ ...base, confirmed_insights: [insight, insight, { ...insight, insight_id: 'old', state: 'superseded' }] });
 assert.equal(facts.insights.length, 1); assert.equal(facts.themes[0].items.length, 1); assert.equal(facts.insights[0].statement_kind, 'patient_approved_interpretation');
});
test('a patient report needs two actual confirmed values of one kind for a trend', () => {
 const observation: DTO<'Observation'> = { observation_id: 'one', patient_id: base.patient_id, session_id: null, kind: 'energy', value: 5, observed_at: base.period_start, state: 'confirmed', version: 1, supersedes_observation_id: null, sources: [] };
 assert.equal(reportFacts({ ...base, observations: [observation] }).series.length, 0);
 assert.equal(reportFacts({ ...base, observations: [observation, { ...observation, observation_id: 'proposal', state: 'proposed' }] }).series.length, 0);
 const facts = reportFacts({ ...base, observations: [{ ...observation, observation_id: 'two', observed_at: base.period_end, value: 6 }, observation] });
 assert.deepEqual(facts.series[0].items.map(i => i.value), [5, 6]);
});
test('patient report ignores feedback unrelated to its completed activities', () => {
 const facts = reportFacts({ ...base, completed_activities: [], feedback: base.feedback });
 assert.equal(facts.averageRating, null); assert.equal(facts.feedback.length, 0);
});
