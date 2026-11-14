import { StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';

interface BDIProgressIndicatorProps {
  answered: number;
  total: number;
  label: string;
  percent: number;
}

export function BDIProgressIndicator({
  answered,
  total,
  label,
  percent,
}: BDIProgressIndicatorProps) {
  return (
    <View testID="bdi-progress" style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.hint}>
          {answered === total ? 'Ready for your result' : 'Choose one answer per item'}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Adapted BDI-II progress"
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  label: { fontFamily: t.type.display, fontSize: 14, fontWeight: '700', color: t.ink },
  hint: { fontFamily: t.type.body, fontSize: 11, color: t.muted },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: t.low },
  fill: { height: 6, borderRadius: 3, backgroundColor: t.accent },
});
