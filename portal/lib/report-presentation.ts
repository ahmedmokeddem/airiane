import type { Report } from './types';

export const metricLabel = (value: string) => ({ mood: 'Mood', energy: 'Energy', sleep_hours: 'Sleep', activity_completions: 'Completed activities', activity_rating: 'Patient activity rating' }[value] ?? value.replaceAll('_', ' '));
export const metricUnit = (value: string) => ({ mood: '/10', energy: '/10', sleep_hours: 'hours' }[value] ?? '');

/** Only confirmed records belong in a clinician-facing self-report series. */
export function observationSeries(report: Report) {
  return ['mood', 'energy', 'sleep_hours'].map(kind => ({
    kind,
    points: report.observations.filter(item => item.kind === kind && item.state === 'confirmed').toSorted((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)),
  })).filter(series => series.points.length > 0);
}
export function reportOverview(report: Report) {
  const confirmed = report.observations.filter(item => item.state === 'confirmed');
  return { confirmed, completed: report.completed_activities.filter(item => item.state === 'completed'), assessmentCount: report.assessments.filter(item => item.complete).length };
}
export const confirmedInsights = (report: Report) => (report.confirmed_insights ?? []).filter(item => item.state === 'confirmed');
