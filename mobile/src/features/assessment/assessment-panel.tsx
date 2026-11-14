import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import { CrisisSupport } from './crisis-support';
import type { useAssessment } from './use-assessment';

/**
 * The questionnaire inside the conversation: one question at a time with tappable answers.
 * A spoken or typed answer is only highlighted; tapping records it. Patients see their total
 * neutrally; severity wording is written for the doctor's report.
 */
export function AssessmentPanel({ assessment, busy, dark = false, hasDoctor, onAnswer, onAskCareTeam }: { assessment: ReturnType<typeof useAssessment>; busy: boolean; dark?: boolean; hasDoctor: boolean; onAnswer: (value: number) => void; onAskCareTeam: () => void }) {
  const { state, safety, requested } = assessment;
  const ink = dark ? '#f1f6f8' : t.ink;
  const muted = dark ? '#a0b3c3' : t.muted;
  const card = [c.card, dark ? c.cardDark : c.cardLight];
  const crisis = safety !== 'none' && <CrisisSupport urgent={false} requested={requested} busy={busy} onAskCareTeam={onAskCareTeam} />;
  // Told before starting: a Q9 answer above 0 sends every answer to the connected doctor.
  const notice = hasDoctor && <Text testID="assessment-sharing-notice" style={[c.small, c.notice, dark && c.noticeDark]}>If you answer question 9 with anything other than “Not at all”, all your answers will be sent to your connected doctor so they can follow up with you.</Text>;
  if (state.phase === 'idle') return crisis || null;
  if (state.phase === 'offer')
    return <View testID="assessment-offer" style={card}>
      <Text style={[c.eyebrow, { color: dark ? '#83c9bd' : t.accent }]}>A FULLER CHECK · OPTIONAL</Text>
      <Text style={[c.body, { color: ink }]}>These questions help your doctor understand the last two weeks. You can stop at any time; nothing is saved until you finish.</Text>
      {notice}
      {state.definitions.map(d => <Pressable key={d.assessment_id} testID={`assessment-start-${d.assessment_id}`} accessibilityRole="button" disabled={busy} onPress={() => assessment.begin(d)} style={[c.option, dark ? c.optionDark : c.optionLight]}>
        <Text style={[c.optionText, { color: ink }]}>{d.title}</Text>
        <Text style={[c.small, { color: muted }]}>About {d.estimated_minutes ?? 5} minutes · {d.questions.filter(q => q.scored !== false).length} questions</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" onPress={assessment.stop} style={c.quiet}><Text style={[c.small, { color: muted }]}>Not now</Text></Pressable>
    </View>;
  if (state.phase === 'asking') {
    const { definition, question, number, total, suggested } = state;
    return <View style={c.stack}>
      {crisis}
      <View testID="assessment-question" style={card}>
        <View style={c.row}><Text style={[c.eyebrow, { color: dark ? '#83c9bd' : t.accent }]}>{definition.title.split(' · ')[0].toUpperCase()} · {number} OF {total}</Text><Pressable testID="assessment-stop" accessibilityRole="button" onPress={assessment.stop}><Text style={[c.small, { color: muted }]}>Stop</Text></Pressable></View>
        <View style={[c.track, dark && { backgroundColor: '#ffffff14' }]}><View style={[c.fill, { width: `${Math.round(((number - 1) / total) * 100)}%` }]} /></View>
        {number === 1 && definition.instructions && <Text style={[c.small, { color: muted }]}>{definition.instructions}</Text>}
        {number === 1 && notice}
        <Text style={[c.question, { color: ink }]}>{question.wording}</Text>
        {(question.options ?? []).map(o => <Pressable key={o.value} testID={`assessment-answer-${o.value}`} accessibilityRole="radio" accessibilityState={{ selected: suggested === o.value }} accessibilityLabel={o.label} disabled={busy} onPress={() => onAnswer(o.value)} style={[c.option, dark ? c.optionDark : c.optionLight, suggested === o.value && c.suggested]}>
          <Text style={[c.optionText, { color: suggested === o.value ? '#fff' : ink }]}>{o.label}</Text>
          {suggested === o.value && <Text style={[c.small, { color: '#e6f6f2' }]}>I heard this — tap to confirm</Text>}
        </Pressable>)}
      </View>
    </View>;
  }
  if (state.phase === 'saving') return <View style={card}><Text style={[c.body, { color: ink }]}>Saving your answers…</Text></View>;
  const { definition, result, reportCreated, sharedWithDoctor } = state;
  return <View style={c.stack}>
    {crisis}
    <View testID="assessment-done" style={card}>
      <Text style={[c.eyebrow, { color: dark ? '#83c9bd' : t.accent }]}>THANK YOU</Text>
      <Text style={[c.question, { color: ink }]}>You finished {definition.title.split(' · ')[0]}.</Text>
      {result && <Text testID="assessment-total" style={[c.body, { color: ink }]}>Your total was {result.total} out of {result.max_total}. Your doctor can help you understand what it means.</Text>}
      {sharedWithDoctor && <Text testID="assessment-shared" style={[c.body, { color: ink }]}>Because of your answer to question 9, all your answers were sent to your doctor so they can follow up with you.</Text>}
      <Text style={[c.small, { color: muted }]}>{reportCreated ? 'It’s in a new report in Reports & sharing. Your doctor sees it only if you share reports with them.' : 'Your answers are saved. Create a report in Reports & sharing to include them.'}</Text>
      <Pressable accessibilityRole="button" onPress={assessment.stop} style={c.quiet}><Text style={[c.small, { color: muted }]}>Close</Text></Pressable>
    </View>
  </View>;
}
const c = StyleSheet.create({
  stack: { gap: 10 },
  card: { padding: 16, borderRadius: 20, gap: 10, borderWidth: 1 },
  cardLight: { backgroundColor: t.surface, borderColor: t.border },
  cardDark: { backgroundColor: '#132a3be8', borderColor: '#65afa54a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  question: { fontFamily: t.type.display, fontSize: 17, fontWeight: '600', lineHeight: 24 },
  body: { fontFamily: t.type.body, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18 },
  option: { minHeight: 48, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', borderWidth: 1 },
  optionLight: { backgroundColor: t.low, borderColor: t.border },
  optionDark: { backgroundColor: '#ffffff0d', borderColor: '#ffffff1f' },
  suggested: { backgroundColor: t.accent, borderColor: t.accent },
  optionText: { fontFamily: t.type.body, fontSize: 14, fontWeight: '600' },
  quiet: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 10, borderRadius: 12, backgroundColor: '#eeeaf7', color: '#3d2f73' },
  noticeDark: { backgroundColor: '#ffffff14', color: '#d9d2f5' },
  track: { height: 4, borderRadius: 2, backgroundColor: t.low, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: t.accent },
});
