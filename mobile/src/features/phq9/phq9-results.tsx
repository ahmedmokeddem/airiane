import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import { Button } from '../product/product-ui';
import {
  PHQ9_DISCLAIMER,
  PHQ9_INTERPRETATIONS,
  PHQ9_MAX_SCORE,
  PHQ9_NEXT_STEPS,
  PHQ9_PRIVACY_NOTE,
} from './phq9-config';
import { PHQ9SafetyNotice } from './phq9-safety-notice';
import type { PHQ9Assessment } from './phq9-session';

/**
 * Results are presented as preliminary screening information. The Q9 support notice is a
 * separate card and is rendered whenever Q9 was above zero, regardless of the total score.
 */
export function PHQ9Results({
  assessment,
  onRetake,
  onExit,
}: {
  assessment: PHQ9Assessment;
  onRetake: () => void;
  onExit: () => void;
}) {
  const interpretation = PHQ9_INTERPRETATIONS[assessment.severity];
  const nextSteps = PHQ9_NEXT_STEPS[assessment.severity];

  return (
    <ScrollView
      testID="phq9-results"
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.header}>
        <Text style={s.eyebrow}>YOUR SCREENING RESULT</Text>
        <Text accessibilityRole="header" style={s.title}>
          Thank you for taking the time.
        </Text>
        <Text style={s.subtitle}>
          This is screening information, not a diagnosis. Read it at your own pace.
        </Text>
      </View>

      <View style={s.scoreCard}>
        <Text testID="phq9-total-score" style={s.score}>
          PHQ-9 Total Score: {assessment.totalScore} / {PHQ9_MAX_SCORE}
        </Text>
        <View style={s.severityBadge}>
          <Text testID="phq9-severity" style={s.severity}>
            {assessment.severity}
          </Text>
        </View>
        <Text style={s.scoreScale}>0 = lowest score · 27 = highest score</Text>
      </View>

      {assessment.q9SafetyFlag ? <PHQ9SafetyNotice /> : null}

      <View style={s.card}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          Preliminary interpretation
        </Text>
        <Text testID="phq9-interpretation" style={s.body}>
          {interpretation}
        </Text>
      </View>

      <View style={s.card}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          Suggested next steps
        </Text>
        {nextSteps.map(step => (
          <View key={step} style={s.stepRow}>
            <View style={s.dot} />
            <Text style={s.body}>{step}</Text>
          </View>
        ))}
      </View>

      <View testID="phq9-disclaimer" style={s.disclaimer}>
        <Text style={s.disclaimerTitle}>Please keep this in mind</Text>
        <Text style={s.disclaimerBody}>{PHQ9_DISCLAIMER}</Text>
      </View>

      <Text testID="phq9-privacy-note" style={s.privacy}>
        {PHQ9_PRIVACY_NOTE}
      </Text>

      <View style={s.actions}>
        <Button label="Start over" secondary onPress={onRetake} />
        <Button label="Leave assessment" onPress={onExit} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: 8 },
  eyebrow: {
    fontFamily: t.type.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: t.accent,
  },
  title: {
    fontFamily: t.type.display,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '600',
    color: t.ink,
  },
  subtitle: {
    fontFamily: t.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: t.muted,
  },
  scoreCard: {
    alignItems: 'center',
    gap: 6,
    padding: 22,
    borderRadius: 24,
    backgroundColor: t.sage,
    borderWidth: 1,
    borderColor: t.border,
  },
  score: {
    fontFamily: t.type.display,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    color: t.ink,
    textAlign: 'center',
  },
  severityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: t.accent,
  },
  severity: {
    fontFamily: t.type.body,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreScale: {
    fontFamily: t.type.body,
    fontSize: 11,
    color: t.muted,
    textAlign: 'center',
  },
  card: {
    gap: 9,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  sectionTitle: {
    fontFamily: t.type.display,
    fontSize: 17,
    fontWeight: '600',
    color: t.ink,
  },
  body: {
    flex: 1,
    fontFamily: t.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: t.ink,
  },
  stepRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
    backgroundColor: t.accent,
  },
  disclaimer: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: t.softLavender,
    borderWidth: 1,
    borderColor: '#d8d0ee',
  },
  disclaimerTitle: {
    fontFamily: t.type.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#3d2f73',
  },
  disclaimerBody: {
    fontFamily: t.type.body,
    fontSize: 12,
    lineHeight: 19,
    color: '#3d2f73',
  },
  privacy: {
    fontFamily: t.type.body,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    textAlign: 'center',
  },
  actions: { gap: 10 },
});
