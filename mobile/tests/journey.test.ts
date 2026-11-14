import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../contracts/fixtures/my-journey.json';
import type { DTO, Journey } from '../src/integration/types';
import { buildJourneyMilestones, newlyAddedMilestoneIds } from '../src/features/journey/model';
const journey = fixture.data as Journey;
const observation = (overrides: Partial<DTO<'Observation'>> = {}): DTO<'Observation'> => ({ observation_id: 'observation-1', patient_id: 'patient', session_id: null, kind: 'sleep_hours', value: 7, observed_at: '2026-11-13T08:00:00Z', state: 'confirmed', version: 2, supersedes_observation_id: null, sources: [{ source_id: 'source-1', source_revision: 1 }], ...overrides });

test('Journey maps actual completion time and feedback provenance without inventing a second timestamp', () => {
 const [moment] = buildJourneyMilestones(journey);
 assert.equal(moment.occurredAt, journey.items[0].activity_session.ended_at);
 assert.equal(moment.title, journey.items[0].activity.title);
 assert.match(moment.detail, /4\/5/);
 assert.deepEqual(moment.provenance.sourceIds, [journey.items[0].feedback!.source_id]);
 assert.match(moment.provenance.dateBasis, /no separate recorded timestamp/);
 assert.equal(buildJourneyMilestones({ ...journey, items: [journey.items[0], journey.items[0]] }).length, 1);
});
test('Journey does not turn started, abandoned or undated records into milestones', () => {
 for (const state of ['started', 'abandoned', 'completed'] as const) {
  const item = structuredClone(journey.items[0]); item.activity_session.state = state; item.activity_session.ended_at = state === 'completed' ? null : item.activity_session.ended_at;
  assert.deepEqual(buildJourneyMilestones({ items: [item], next_cursor: null }), []);
 }
 assert.deepEqual(buildJourneyMilestones(null), []);
});
test('Journey includes confirmed values only, respects correction state and orders actual dates', () => {
 const records = [observation(), observation({ observation_id: 'proposal', state: 'proposed' }), observation({ observation_id: 'rejected', state: 'rejected' })];
 const moments = buildJourneyMilestones(journey, records);
 assert.equal(moments.length, 2); assert.equal(moments[0].title, 'Sleep: 7 hours');
 assert.equal(moments[0].provenance.status, 'confirmed');
 assert.deepEqual(moments[0].provenance.sourceIds, ['source-1']);
 assert.equal(buildJourneyMilestones(null, [observation(), observation({ version: 3, state: 'superseded' })]).length, 0);
 const corrected = buildJourneyMilestones(null, [observation(), observation({ observation_id: 'corrected', supersedes_observation_id: 'observation-1', value: 8 })]);
 assert.equal(corrected.length, 1); assert.equal(corrected[0].title, 'Sleep: 8 hours');
});
test('overlapping history refreshes do not celebrate or duplicate known milestones', () => {
 const before = buildJourneyMilestones(journey);
 const refreshed = buildJourneyMilestones({ ...journey, items: [...journey.items, ...journey.items] });
 assert.deepEqual(newlyAddedMilestoneIds(before.map(m => m.id), refreshed), []);
 const withObservation = buildJourneyMilestones(journey, [observation()]);
 assert.deepEqual(newlyAddedMilestoneIds(before.map(m => m.id), withObservation), ['observation:observation-1']);
});
test('feedback from another activity is never attached to a moment', () => {
 const item = structuredClone(journey.items[0]); item.feedback!.activity_session_id = 'another-activity';
 const [moment] = buildJourneyMilestones({ items: [item], next_cursor: null });
 assert.doesNotMatch(moment.detail, /rating/); assert.deepEqual(moment.provenance.sourceIds, []);
});

test('Journey maps confirmed narrative insights with explicit statement origin and correction lineage', () => {
 const insight: DTO<'ConfirmedInsight'> = { insight_id: 'insight-1', patient_id: 'patient', session_id: null, theme: 'reflection', text: 'I enjoyed sitting outside today.', observed_at: '2026-11-14T09:00:00Z', statement_kind: 'patient_approved_interpretation', confirmed_at: '2026-11-14T09:01:00Z', version: 1, state: 'confirmed', supersedes_insight_id: null, sources: [{ source_id: 'insight-source', source_revision: 1 }] };
 const [moment] = buildJourneyMilestones(null, [], [insight]);
 assert.equal(moment.title, 'Your reflection'); assert.equal(moment.occurredAt, insight.observed_at);
 assert.match(moment.detail, /AI interpretation reviewed and confirmed/);
 assert.deepEqual(moment.provenance.sourceIds, ['insight-source']);
 assert.equal(buildJourneyMilestones(null, [], [{ ...insight, state: 'superseded' }]).length, 0);
 const correction = { ...insight, insight_id: 'insight-2', supersedes_insight_id: insight.insight_id, text: 'Corrected experience' };
 const mapped = buildJourneyMilestones(null, [], [insight, correction]);
 assert.equal(mapped.length, 1); assert.match(mapped[0].detail, /Corrected experience/);
});
