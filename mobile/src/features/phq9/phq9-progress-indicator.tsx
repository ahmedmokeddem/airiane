import { StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';

interface PHQ9ProgressIndicatorProps {
  answered: number;
  total: number;
  label: string;
  percent: number;
}

/** Live completion indicator: “5 / 9 completed”, plus an accessible progress bar. */
export function PHQ9ProgressIndicator({
  answered,
  total,
  label,
  percent,
}: PHQ9ProgressIndicatorProps) {
  return (
    <View testID="phq9-progress" style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.hint}>
          {answered === total ? 'Ready for your result' : 'Choose one answer per question'}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Questionnaire progress"
        accessibilityValue={{ min: 0, max: total, now: answered, text: label }}
        style={s.track}
      >
        <View style={[s.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  label: {
    fontFamily: t.type.display,
    fontSize: 14,
    fontWeight: '700',
    color: t.ink,
  },
  hint: {
    fontFamily: t.type.body,
    fontSize: 11,
    color: t.muted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: t.low,
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.accent,
  },
});
