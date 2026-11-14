import { StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import type { BDIQuestion, BDIResponseValue } from './bdi-config';
import { BDIResponseOption } from './bdi-response-option';

interface BDIQuestionCardProps {
  question: BDIQuestion;
  selectedValue: BDIResponseValue | undefined;
  showError: boolean;
  onSelect: (value: BDIResponseValue) => void;
}

/** Full-width item card for the adapted 21-item BDI-II-themed form. */
export function BDIQuestionCard({
  question,
  selectedValue,
  showError,
  onSelect,
}: BDIQuestionCardProps) {
  return (
    <View
      testID={`bdi-question-${question.id}`}
      style={[s.card, showError && s.cardError]}
    >
      <View style={s.heading}>
        <View style={s.number}>
          <Text style={s.numberText}>Q{question.number}</Text>
        </View>
        <Text style={s.category}>{question.title.toUpperCase()}</Text>
      </View>
      <Text accessibilityRole="header" style={s.prompt}>
        {question.prompt}
      </Text>
      <Text style={s.instruction}>Select one answer:</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Item ${question.number}: ${question.prompt}`}
        style={s.options}
      >
        {question.options.map(option => (
          <BDIResponseOption
            key={option.value}
            option={option}
            questionNumber={question.number}
            selected={selectedValue === option.value}
            onSelect={onSelect}
          />
        ))}
      </View>
      {showError ? (
        <Text style={s.error}>Please choose one response for this item.</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  cardError: { borderWidth: 2, borderColor: t.error },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  number: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: t.sage,
  },
  numberText: { fontFamily: t.type.display, fontSize: 12, fontWeight: '700', color: t.accent },
  category: {
    flexShrink: 1,
    fontFamily: t.type.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: t.muted,
  },
  prompt: {
    fontFamily: t.type.display,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 25,
    color: t.ink,
  },
  instruction: { fontFamily: t.type.body, fontSize: 12, color: t.muted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: t.error, fontWeight: '600' },
});
