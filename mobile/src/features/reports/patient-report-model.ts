import type { DTO } from '../../integration/types';
export const insightThemeLabels: Record<DTO<'ConfirmedInsight'>['theme'], string> = { fatigue: 'Energy & rest', sleep: 'Sleep', positive_experience: 'Positive experiences', concern: 'Concerns you shared', clinician_question: 'Questions for your clinician', reflection: 'Personal reflections', goal: 'Goals you chose' };
export function reportFacts(report: DTO<'Report'>) {
 const insights = [...new Map((report.confirmed_insights ?? []).filter(i => i.state === 'confirmed').map(i => [i.insight_id, i])).values()];
 const themes = Object.entries(insightThemeLabels).map(([theme, label]) => ({ theme, label, items: insights.filter(i => i.theme === theme).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)) })).filter(group => group.items.length);
 const activities = [...new Map(report.completed_activities.filter(a => a.state === 'completed').map(a => [a.activity_session_id, a])).values()];
 const activityIds = new Set(activities.map(a => a.activity_session_id));
 const feedback = [...new Map(report.feedback.filter(f => activityIds.has(f.activity_session_id)).map(f => [f.feedback_id, f])).values()];
 const observations = report.observations.filter(o => o.state === 'confirmed');
 const series = (['mood', 'energy', 'sleep_hours'] as const).map(kind => ({ kind, items: observations.filter(o => o.kind === kind).sort((a,b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)) })).filter(s => s.items.length >= 2);
 return { insights, themes, activities, feedback, observations, series, assessments: report.assessments.filter(a => a.complete), averageRating: feedback.length ? feedback.reduce((sum,f) => sum + f.rating,0) / feedback.length : null };
}
