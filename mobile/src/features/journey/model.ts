import type { DTO, Journey } from '../../integration/types';

export interface JourneyMilestone {
  id: string;
  kind: 'activity' | 'observation' | 'insight';
  title: string;
  category: string;
  occurredAt: string;
  detail: string;
  provenance: { resourceId: string; sourceIds: string[]; status: 'completed' | 'confirmed'; dateBasis: string };
}

/** A record becomes a moment only after a real completion or patient confirmation. */
export function buildJourneyMilestones(journey: Journey | null, observations: readonly DTO<'Observation'>[] = [], insights: readonly DTO<'ConfirmedInsight'>[] = []): JourneyMilestone[] {
  const records = new Map<string, JourneyMilestone>();
  for (const item of journey?.items ?? []) {
    const session = item.activity_session;
    if (session.state !== 'completed' || !session.ended_at || !Number.isFinite(Date.parse(session.ended_at))) continue;
    const validFeedback = item.feedback?.activity_session_id === session.activity_session_id ? item.feedback : null;
    const feedback = validFeedback ? ` Your helpfulness rating: ${validFeedback.rating}/5.${validFeedback.comment ? ` You wrote: “${validFeedback.comment}”` : ''}` : '';
    const id = `activity:${session.activity_session_id}`;
    records.set(id, { id, kind: 'activity', title: item.activity.title, category: 'Activity completed', occurredAt: session.ended_at,
      detail: `You completed this activity.${feedback}`, provenance: { resourceId: session.activity_session_id, sourceIds: validFeedback ? [validFeedback.source_id] : [], status: 'completed', dateBasis: 'Activity completion time; feedback belongs to this activity and has no separate recorded timestamp.' } });
  }
  // Highest revision wins if overlapping pages include the same observation.
  const latest = new Map<string, DTO<'Observation'>>();
  for (const observation of observations) {
    const prior = latest.get(observation.observation_id);
    if (!prior || observation.version > prior.version) latest.set(observation.observation_id, observation);
  }
  const superseded = new Set([...latest.values()].filter(o => o.state === 'confirmed').map(o => o.supersedes_observation_id).filter(Boolean));
  for (const observation of latest.values()) {
    if (observation.state !== 'confirmed' || superseded.has(observation.observation_id) || !Number.isFinite(Date.parse(observation.observed_at))) continue;
    const label = { mood: 'Mood', energy: 'Energy', sleep_hours: 'Sleep' }[observation.kind];
    const unit = observation.kind === 'sleep_hours' ? ' hours' : ' / 10';
    const id = `observation:${observation.observation_id}`;
    records.set(id, { id, kind: 'observation', title: `${label}: ${observation.value}${unit}`, category: 'Patient-confirmed check-in', occurredAt: observation.observed_at,
      detail: 'A value you reported and confirmed. This is a personal record, without a clinical interpretation.', provenance: { resourceId: observation.observation_id, sourceIds: observation.sources.map(s => s.source_id), status: 'confirmed', dateBasis: 'Time the experience was reported to have occurred; not the confirmation time.' } });
  }
  const replacedInsights = new Set(insights.filter(i => i.state === 'confirmed').map(i => i.supersedes_insight_id).filter(Boolean));
  for (const insight of insights) {
    if (insight.state !== 'confirmed' || replacedInsights.has(insight.insight_id) || !Number.isFinite(Date.parse(insight.observed_at))) continue;
    const id = `insight:${insight.insight_id}`;
    const labels = { fatigue: 'Energy & rest', sleep: 'Sleep', positive_experience: 'A positive experience', concern: 'A concern you shared', clinician_question: 'A question to revisit', reflection: 'Your reflection', goal: 'A goal you chose' };
    records.set(id, { id, kind: 'insight', title: labels[insight.theme], category: 'Patient-confirmed insight', occurredAt: insight.observed_at,
      detail: `${insight.text}${insight.statement_kind === 'patient_approved_interpretation' ? ' (AI interpretation reviewed and confirmed by you.)' : ' (Your reported experience.)'}`, provenance: { resourceId: insight.insight_id, sourceIds: insight.sources.map(source => source.source_id), status: 'confirmed', dateBasis: `Experience time supplied with this record. Confirmed ${formatMomentDate(insight.confirmed_at)}.` } });
  }
  return [...records.values()].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
}

export function newlyAddedMilestoneIds(previous: readonly string[], next: readonly JourneyMilestone[]): string[] {
  const known = new Set(previous);
  return next.filter(moment => !known.has(moment.id)).map(moment => moment.id);
}

export function formatMomentDate(date: string): string {
  return new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
