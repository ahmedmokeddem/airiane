import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import type { PHQ9Option, PHQ9ResponseValue } from './phq9-config';

interface PHQ9ResponseOptionProps {
  option: PHQ9Option;
  selected: boolean;
  questionNumber: number;
  onSelect: (value: PHQ9ResponseValue) => void;
}

/**
 * One radio-style answer card. The numeric score is always visible, the selected state is
 * conveyed by more than colour, and the control is a single radio so only one score can be
 * chosen per question.
 */
export function PHQ9ResponseOption({
  option,
  selected,
  questionNumber,
  onSelect,
}: PHQ9ResponseOptionProps) {
  return (
    <Pressable
      testID={`phq9-q${questionNumber}-option-${option.value}`}
      accessibilityRole="radio"
      accessibilityLabel={`${option.value}, ${option.label}`}
      accessibilityHint={`Selects this answer for question ${questionNumber}`}
      accessibilityState={{ checked: selected }}
      focusable
      onPress={() => onSelect(option.value)}
      style={({ pressed }) => [
        s.option,
        selected && s.selected,
        pressed && s.pressed,
      ]}
    >
      <View style={[s.score, selected && s.scoreSelected]}>
        <Text style={[s.scoreText, selected && s.scoreTextSelected]}>
          {option.value}
        </Text>
      </View>
      <Text style={[s.label, selected && s.labelSelected]}>{option.label}</Text>
      <View style={[s.indicator, selected && s.indicatorSelected]}>
        {selected ? (
          <Feather name="check" size={12} color="#ffffff" />
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  option: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.low,
  },
  selected: {
    borderWidth: 2,
    borderColor: t.accent,
    backgroundColor: t.sage,
  },
  pressed: { opacity: 0.78 },
  score: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  scoreSelected: { backgroundColor: t.accent, borderColor: t.accent },
  scoreText: {
    fontFamily: t.type.body,
    fontSize: 13,
    fontWeight: '700',
    color: t.ink,
  },
  scoreTextSelected: { color: '#ffffff' },
  label: {
    flex: 1,
    fontFamily: t.type.body,
    fontSize: 13,
    lineHeight: 19,
    color: t.ink,
  },
  labelSelected: { fontWeight: '700' },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.muted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
  },
  indicatorSelected: { backgroundColor: t.accent, borderColor: t.accent },
});
