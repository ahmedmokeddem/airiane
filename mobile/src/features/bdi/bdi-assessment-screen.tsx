import { useEffect, useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme as t } from '../../theme';
import { uuid } from '../../integration/runtime';
import { Button } from '../product/product-ui';
import {
  BDI_DISCLAIMER,
  BDI_GUIDANCE,
  BDI_INCOMPLETE_SUMMARY,
  BDI_INTRO,
  BDI_QUESTIONS,
  BDI_SOURCE_NOTE,
  BDI_TITLE,
  BDI_TIMEFRAME,
} from './bdi-config';
import { BDIProgressIndicator } from './bdi-progress-indicator';
import { BDIQuestionCard } from './bdi-question-card';
import { BDIResults } from './bdi-results';
import { BDISafetyNotice } from './bdi-safety-notice';
import {
  bdiProgress,
  bdiReducer,
  createBDIFormState,
  unansweredBDIQuestions,
  type BDIAssessment,
} from './bdi-session';

/**
 * Standalone adapted BDI-II check. It is a local, deterministic 21-item self-assessment and
 * does not call the API, the chatbot or a model.
 */
export function BDIAssessmentScreen({
  onExit,
  userId = null,
  onCompleted,
}: {
  onExit: () => void;
  userId?: string | null;
  onCompleted?: (assessment: BDIAssessment) => void;
}) {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(bdiReducer, undefined, createBDIFormState);
  const reported = useRef<string | null>(null);
  const progress = bdiProgress(state);
  const unanswered = unansweredBDIQuestions(state.answers);

  useEffect(() => {
    if (!state.assessment || reported.current === state.assessment.assessmentId) return;
    reported.current = state.assessment.assessmentId;
    onCompleted?.(state.assessment);
  }, [state.assessment, onCompleted]);

  if (state.assessment) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <BDIResults
          assessment={state.assessment}
          onRetake={() => dispatch({ type: 'reset' })}
          onExit={onExit}
        />
      </View>
    );
  }

  const submit = () => {
    dispatch({
      type: 'submit',
      assessmentId: uuid(),
      completedAt: new Date().toISOString(),
      userId,
    });
  };

  const showIncomplete = state.attempted && unanswered.length > 0;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          {
            paddingTop: Math.max(14, insets.top + 8),
            paddingBottom: Math.max(32, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.topBar}>
          <Text style={s.eyebrow}>ADAPTED · 21 ITEMS</Text>
          <Pressable
            testID="bdi-leave"
            accessibilityRole="button"
            accessibilityLabel="Leave the adapted BDI-II check without finishing"
            hitSlop={8}
            onPress={onExit}
          >
            <Text style={s.leave}>Leave</Text>
          </Pressable>
        </View>

        <Text accessibilityRole="header" style={s.title}>{BDI_TITLE}</Text>
        <Text style={s.intro}>{BDI_INTRO}</Text>

        <View style={s.adaptedCard}>
          <Text style={s.adaptedTitle}>Adapted instrument notice</Text>
          <Text style={s.adaptedText}>{BDI_SOURCE_NOTE}</Text>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Before you begin</Text>
          {BDI_GUIDANCE.map(item => (
            <View key={item} style={s.infoRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.infoText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.timeframe}>
          <Text style={s.timeframeLabel}>TIME FRAME</Text>
          <Text style={s.timeframeText}>{BDI_TIMEFRAME}</Text>
        </View>

        <BDIProgressIndicator
          answered={progress.answered}
          total={progress.total}
          label={progress.label}
          percent={progress.percent}
        />

        {state.error ? (
          <Text accessibilityRole="alert" style={s.error}>{state.error}</Text>
        ) : null}

        <View style={s.questions}>
          {BDI_QUESTIONS.map(question => (
            <View key={question.id} style={s.questionWrap}>
              <BDIQuestionCard
                question={question}
                selectedValue={state.answers[question.id]}
                showError={state.attempted && state.answers[question.id] === undefined}
                onSelect={value => dispatch({ type: 'select', questionId: question.id, value })}
              />
              {question.id === 'q9' && (state.answers.q9 ?? 0) > 0 ? (
                <BDISafetyNotice compact />
              ) : null}
            </View>
          ))}
        </View>

        {showIncomplete ? (
          <View
            testID="bdi-validation-summary"
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={s.validation}
          >
            <Text style={s.validationTitle}>A little more is needed</Text>
            <Text style={s.validationBody}>{BDI_INCOMPLETE_SUMMARY}</Text>
            <Text style={s.validationBody}>
              Still unanswered: Item {unanswered.map(question => question.number).join(', ')}.
            </Text>
          </View>
        ) : null}

        <Button label="See my result" onPress={submit} />
        <Text style={s.submitHint}>
          Your result is calculated only after all 21 items are answered.
        </Text>

        <Pressable
          testID="bdi-leave-bottom"
          accessibilityRole="button"
          accessibilityLabel="Leave the adapted BDI-II check without finishing"
          onPress={onExit}
          style={s.leaveBottom}
        >
          <Text style={s.leave}>Leave without finishing</Text>
        </Pressable>

        <Text style={s.disclaimer}>{BDI_DISCLAIMER}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  content: { paddingHorizontal: 20, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { flexShrink: 1, fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: t.accent },
  leave: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.muted },
  title: { fontFamily: t.type.display, fontSize: 28, lineHeight: 36, fontWeight: '600', letterSpacing: -0.7, color: t.ink },
  intro: { fontFamily: t.type.body, fontSize: 15, lineHeight: 23, color: t.muted },
  adaptedCard: { gap: 5, padding: 14, borderRadius: 16, backgroundColor: '#fff7f4', borderWidth: 1, borderColor: '#d9a79b' },
  adaptedTitle: { fontFamily: t.type.display, fontSize: 14, fontWeight: '700', color: '#6f2c1d' },
  adaptedText: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: '#5c2b20' },
  infoCard: { gap: 8, padding: 16, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  infoTitle: { fontFamily: t.type.display, fontSize: 15, fontWeight: '600', color: t.ink },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: t.accent, fontWeight: '700' },
  infoText: { flex: 1, fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: t.ink },
  timeframe: { gap: 4, padding: 14, borderRadius: 16, backgroundColor: t.softLavender, borderWidth: 1, borderColor: '#d8d0ee' },
  timeframeLabel: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: '#3d2f73' },
  timeframeText: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: '#3d2f73' },
  questions: { gap: 12 },
  questionWrap: { gap: 10 },
  error: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: t.error },
  validation: { gap: 4, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: '#d9a79b', backgroundColor: '#fff7f4' },
  validationTitle: { fontFamily: t.type.display, fontSize: 15, fontWeight: '700', color: '#6f2c1d' },
  validationBody: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: '#5c2b20' },
  submitHint: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: t.muted, textAlign: 'center' },
  leaveBottom: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontFamily: t.type.body, fontSize: 11, lineHeight: 17, color: t.muted, textAlign: 'center' },
});
