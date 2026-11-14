import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import { Button, ScreenScroll, Surface } from '../product/product-ui';
import { BDI_MAX_SCORE, BDI_SHORT_TITLE, BDI_SOURCE_NOTE } from '../bdi/bdi-config';
import { PHQ9_MAX_SCORE } from '../phq9/phq9-config';
import {
  latestAssessment,
  type AssessmentHistory,
  type AssessmentHistoryType,
} from './assessment-history';

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

function InstrumentCard({
  title,
  testID,
  description,
  detail,
  historyType,
  history,
  onStart,
}: {
  title: string;
  testID: string;
  description: string;
  detail: string;
  historyType: AssessmentHistoryType;
  history: AssessmentHistory;
  onStart: () => void;
}) {
  const latest = latestAssessment(history, historyType);
  return (
    <Surface>
      <View testID={testID} style={s.cardBody}>
        <Text style={s.eyebrow}>{historyType === 'PHQ-9' ? 'PHQ-9 · 9 ITEMS' : 'ADAPTED · 21 ITEMS'}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.description}>{description}</Text>
        <Text style={s.detail}>{detail}</Text>
        <View style={s.status}>
          <Text style={s.statusLabel}>Session status</Text>
          <Text testID={`${testID}-status`} style={s.statusValue}>
            {latest
              ? `Completed ${when(latest.completedAt)} · ${latest.totalScore}/${latest.maxScore} · ${latest.severity}`
              : 'Not completed in this session'}
          </Text>
        </View>
        <Button label={`Start ${title}`} onPress={onStart} />
      </View>
    </Surface>
  );
}

/** Shared, deliberately independent entry point for both self-assessments. */
export function AssessmentCenterScreen({
  onPHQ9,
  onBDI,
  onExit,
  history,
}: {
  onPHQ9: () => void;
  onBDI: () => void;
  onExit: () => void;
  history: AssessmentHistory;
}) {
  return (
    <View style={s.root}>
      <ScreenScroll>
        <View style={s.topBar}>
          <Text style={s.eyebrow}>ASSESSMENT CENTER</Text>
          <Pressable
            testID="assessments-leave"
            accessibilityRole="button"
            accessibilityLabel="Leave the Assessment Center"
            onPress={onExit}
            hitSlop={8}
          >
            <Text style={s.leave}>Home</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={s.pageTitle}>Assessment Center</Text>
        <Text style={s.intro}>
          These are two separate self-assessments. You can complete either one, both, or
          neither. Completing both does not combine their scores or produce a more accurate
          diagnosis.
        </Text>

        <InstrumentCard
          title="PHQ-9"
          testID="assessment-phq9"
          description="A nine-item screening questionnaire about depressive symptoms over the past two weeks."
          detail={`Score range 0–${PHQ9_MAX_SCORE}. Results are screening information, not a diagnosis.`}
          historyType="PHQ-9"
          history={history}
          onStart={onPHQ9}
        />

        <InstrumentCard
          title={BDI_SHORT_TITLE}
          testID="assessment-bdi"
          description="A 21-item check based on project-provided BDI-II themes."
          detail={`Score range 0–${BDI_MAX_SCORE}. ${BDI_SOURCE_NOTE}`}
          historyType="BDI-II-adapted"
          history={history}
          onStart={onBDI}
        />

        <View style={s.note}>
          <Text style={s.noteTitle}>Privacy</Text>
          <Text style={s.noteText}>
            These standalone assessments are scored in the app and are not shared
            automatically with a therapist. Each result remains separate.
          </Text>
        </View>
      </ScreenScroll>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: t.accent },
  leave: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.muted },
  pageTitle: { fontFamily: t.type.display, fontSize: 30, lineHeight: 38, fontWeight: '600', color: t.ink },
  intro: { fontFamily: t.type.body, fontSize: 15, lineHeight: 23, color: t.muted },
  cardBody: { gap: 9 },
  title: { fontFamily: t.type.display, fontSize: 20, fontWeight: '600', color: t.ink },
  description: { fontFamily: t.type.body, fontSize: 14, lineHeight: 21, color: t.ink },
  detail: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: t.muted },
  status: { gap: 3, padding: 11, borderRadius: 13, backgroundColor: t.low },
  statusLabel: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1, color: t.muted, textTransform: 'uppercase' },
  statusValue: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: t.ink },
  note: { gap: 4, padding: 15, borderRadius: 18, backgroundColor: t.softLavender },
  noteTitle: { fontFamily: t.type.display, fontSize: 14, fontWeight: '700', color: '#3d2f73' },
  noteText: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: '#3d2f73' },
});
