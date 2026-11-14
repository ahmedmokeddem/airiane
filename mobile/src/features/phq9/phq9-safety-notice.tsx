import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';
import {
  CRISIS_EMERGENCY_LINK,
  CRISIS_EMERGENCY_NUMBER,
  CRISIS_HELPLINE_LABEL,
  CRISIS_HELPLINE_LINK,
} from '../assessment/crisis-support';
import { PHQ9_SAFETY_COPY } from './phq9-config';

/**
 * Question 9 support notice. It is shown independently of the total score and is never
 * merged into the severity interpretation. It does not label the response as an emergency;
 * it offers support and a route to urgent help if the person is in immediate danger.
 */
export function PHQ9SafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <View
      testID="phq9-safety-notice"
      style={[s.card, compact && s.compact]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={s.message}
      >
        <Text style={s.eyebrow}>{PHQ9_SAFETY_COPY.eyebrow}</Text>
        <Text style={s.title}>{PHQ9_SAFETY_COPY.title}</Text>
        <Text style={s.body}>{PHQ9_SAFETY_COPY.lead}</Text>
      </View>
      <Text style={s.body}>{PHQ9_SAFETY_COPY.encourage}</Text>
      <Text style={s.body}>{PHQ9_SAFETY_COPY.emergency}</Text>
      <Pressable
        testID="phq9-call-emergency"
        accessibilityRole="button"
        accessibilityLabel={`Call ${CRISIS_EMERGENCY_NUMBER}, emergency services`}
        onPress={() => void Linking.openURL(CRISIS_EMERGENCY_LINK)}
        style={[s.action, s.emergency]}
      >
        <Text style={s.emergencyText}>Call {CRISIS_EMERGENCY_NUMBER} (emergency)</Text>
      </Pressable>
      <Pressable
        testID="phq9-call-helpline"
        accessibilityRole="button"
        accessibilityLabel={CRISIS_HELPLINE_LABEL}
        onPress={() => void Linking.openURL(CRISIS_HELPLINE_LINK)}
        style={s.action}
      >
        <Text style={s.actionText}>{CRISIS_HELPLINE_LABEL}</Text>
      </Pressable>
      <Text style={s.small}>{PHQ9_SAFETY_COPY.limitation}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 9,
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#d9a79b',
    backgroundColor: '#fff7f4',
  },
  compact: { padding: 15 },
  message: { gap: 9 },
  eyebrow: {
    fontFamily: t.type.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#8a3d2c',
  },
  title: {
    fontFamily: t.type.display,
    fontSize: 18,
    fontWeight: '700',
    color: '#6f2c1d',
  },
  body: {
    fontFamily: t.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#5c2b20',
  },
  action: {
    minHeight: 46,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d9a79b',
    backgroundColor: '#ffffff',
  },
  emergency: { backgroundColor: '#9f2d1f', borderColor: '#9f2d1f' },
  emergencyText: {
    fontFamily: t.type.body,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  actionText: {
    fontFamily: t.type.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#6f2c1d',
    textAlign: 'center',
  },
  small: {
    fontFamily: t.type.body,
    fontSize: 11,
    lineHeight: 17,
    color: '#7a4a3f',
  },
});
