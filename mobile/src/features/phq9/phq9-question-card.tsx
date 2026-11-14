import { StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import {
  PHQ9_RESPONSE_OPTIONS,
  type PHQ9Question,
  type PHQ9ResponseValue,
} from './phq9-config';
import { PHQ9ResponseOption } from './phq9-response-option';

interface PHQ9QuestionCardProps {
  question: PHQ9Question;
  selectedValue: PHQ9ResponseValue | undefined;
  showError: boolean;
  onSelect: (value: PHQ9ResponseValue) => void;
}

/**
 * A full-width question card. The four options sit in one wrapped row on wide screens and
 * naturally stack on narrow screens; the group is announced as a radio group.
 */
export function PHQ9QuestionCard({
  question,
  selectedValue,
  showError,
  onSelect,
}: PHQ9QuestionCardProps) {
  return (
    <View
      testID={`phq9-question-${question.id}`}
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
        accessibilityLabel={`Question ${question.number}: ${question.prompt}`}
        style={s.options}
      >
        {PHQ9_RESPONSE_OPTIONS.map(option => (
          <PHQ9ResponseOption
            key={option.value}
            option={option}
            questionNumber={question.number}
            selected={selectedValue === option.value}
            onSelect={onSelect}
          />
        ))}
      </View>
      {showError ? (
        <Text style={s.error}>Please choose one response for this question.</Text>
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
  cardError: {
    borderWidth: 2,
    borderColor: t.error,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  number: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: t.sage,
  },
  numberText: {
    fontFamily: t.type.display,
    fontSize: 12,
    fontWeight: '700',
    color: t.accent,
  },
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
  instruction: {
    fontFamily: t.type.body,
    fontSize: 12,
    color: t.muted,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  error: {
    fontFamily: t.type.body,
    fontSize: 12,
    lineHeight: 18,
    color: t.error,
    fontWeight: '600',
  },
});
