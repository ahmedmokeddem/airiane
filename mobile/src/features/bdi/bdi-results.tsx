import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import { Button, Surface } from '../product/product-ui';
import {
  BDI_CITATIONS,
  BDI_DISCLAIMER,
  BDI_MAX_SCORE,
  BDI_PRIVACY_NOTE,
  BDI_SEVERITY_BANDS,
  BDI_SHORT_TITLE,
  BDI_SOURCE_NOTE,
} from './bdi-config';
import { BDISafetyNotice } from './bdi-safety-notice';
import type { BDIAssessment } from './bdi-session';

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** Results for the adapted BDI-II-themed check, with explicit unvalidated/indicative labeling. */
export function BDIResults({
  assessment,
  onRetake,
  onExit,
}: {
  assessment: BDIAssessment;
  onRetake: () => void;
  onExit: () => void;
}) {
  const band = assessment.preliminaryLevel;
  const severityBand = BDI_SEVERITY_BANDS.find(item => item.severity === assessment.severity);
  const interpretation = severityBand?.interpretation ?? '';
  const nextSteps = severityBand?.nextSteps ?? [];

  return (
    <ScrollView
      testID="bdi-results"
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.eyebrow}>ADAPTED BDI-II RESULT</Text>
        <Text accessibilityRole="header" style={s.title}>
          Thank you for taking the time.
        </Text>
        <Text style={s.subtitle}>{BDI_SHORT_TITLE} · completed {formatDate(assessment.completedAt)}</Text>
        <Text style={s.adaptedNote}>{BDI_SOURCE_NOTE}</Text>
      </View>

      <View style={s.scoreCard}>
        <Text testID="bdi-total-score" style={s.score}>
          Adapted BDI-II Score: {assessment.totalScore} / {BDI_MAX_SCORE}
        </Text>
        <View style={s.severityBadge}>
          <Text testID="bdi-severity" style={s.severity}>{assessment.severity}</Text>
        </View>
        <Text testID="bdi-preliminary-level" style={s.preliminary}>
          Preliminary presentation: {band === 'low' ? 'Low concern' : band === 'moderate' ? 'Moderate concern' : 'High concern'}
        </Text>
      </View>

      {assessment.q9SafetyFlag ? <BDISafetyNotice /> : null}

      <Surface>
        <Text accessibilityRole="header" style={s.sectionTitle}>Preliminary interpretation</Text>
        <Text testID="bdi-interpretation" style={s.body}>{interpretation}</Text>
      </Surface>

      <Surface>
        <Text accessibilityRole="header" style={s.sectionTitle}>Suggested next steps</Text>
        {nextSteps.map(step => (
          <View key={step} style={s.stepRow}>
            <View style={s.dot} />
            <Text style={s.body}>{step}</Text>
          </View>
        ))}
      </Surface>

      <View testID="bdi-disclaimer" style={s.disclaimer}>
        <Text style={s.disclaimerTitle}>Important</Text>
        <Text style={s.disclaimerText}>{BDI_DISCLAIMER}</Text>
      </View>

      <Text style={s.sourceNote}>{BDI_SOURCE_NOTE}</Text>
      <Text style={s.citations}>References: {BDI_CITATIONS.join(' · ')}</Text>
      <Text testID="bdi-privacy-note" style={s.privacy}>{BDI_PRIVACY_NOTE}</Text>

      <View style={s.actions}>
        <Button label="Start over" secondary onPress={onRetake} />
        <Button label="Back to Assessment Center" onPress={onExit} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { gap: 8 },
  eyebrow: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: t.accent },
  title: { fontFamily: t.type.display, fontSize: 27, lineHeight: 34, fontWeight: '600', color: t.ink },
  subtitle: { fontFamily: t.type.body, fontSize: 14, lineHeight: 21, color: t.muted },
  adaptedNote: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: '#6f2c1d', backgroundColor: '#fff7f4', padding: 10, borderRadius: 12 },
  scoreCard: { alignItems: 'center', gap: 7, padding: 22, borderRadius: 24, backgroundColor: t.sage, borderWidth: 1, borderColor: t.border },
  score: { fontFamily: t.type.display, fontSize: 26, lineHeight: 34, fontWeight: '700', color: t.ink, textAlign: 'center' },
  severityBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: t.accent },
  severity: { fontFamily: t.type.body, fontSize: 14, fontWeight: '700', color: '#ffffff' },
  preliminary: { fontFamily: t.type.body, fontSize: 12, color: t.muted, textAlign: 'center' },
  sectionTitle: { fontFamily: t.type.display, fontSize: 17, fontWeight: '600', color: t.ink },
  body: { flexShrink: 1, fontFamily: t.type.body, fontSize: 14, lineHeight: 21, color: t.ink },
  stepRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7, backgroundColor: t.accent },
  disclaimer: { gap: 6, padding: 16, borderRadius: 18, backgroundColor: t.softLavender, borderWidth: 1, borderColor: '#d8d0ee' },
  disclaimerTitle: { fontFamily: t.type.display, fontSize: 14, fontWeight: '700', color: '#3d2f73' },
  disclaimerText: { fontFamily: t.type.body, fontSize: 12, lineHeight: 19, color: '#3d2f73' },
  sourceNote: { fontFamily: t.type.body, fontSize: 11, lineHeight: 17, color: t.muted },
  citations: { fontFamily: t.type.body, fontSize: 10, lineHeight: 16, color: t.muted },
  privacy: { fontFamily: t.type.body, fontSize: 11, lineHeight: 17, color: t.muted, textAlign: 'center' },
  actions: { gap: 10 },
});
