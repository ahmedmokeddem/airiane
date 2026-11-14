import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as t } from '../../theme';

/**
 * Verified crisis configuration for the Finland pilot. Other features reuse these exports so
 * no component invents a telephone number. Verify them before any real-world use.
 */
export const CRISIS_EMERGENCY_NUMBER = '112';
export const CRISIS_HELPLINE_NUMBER = '+358925250111';
export const CRISIS_EMERGENCY_LINK = 'tel:112';
export const CRISIS_HELPLINE_LINK = 'tel:+358925250111';
export const CRISIS_HELPLINE_LABEL = 'MIELI Crisis Helpline · 09 2525 0111 (24/7)';

/**
 * Shown at once when a questionnaire's self-harm question is answered above 0. The app is not
 * monitored, so it points to people who can help now rather than waiting for the doctor.
 */
export function CrisisSupport({ urgent, onAskCareTeam, requested, busy }: { urgent: boolean; onAskCareTeam: () => void; requested: boolean; busy: boolean }) {
  return <View testID="crisis-support" accessibilityRole="alert" style={[c.card, urgent && c.urgent]}>
    <Text style={c.title}>{urgent ? 'Please reach out for help now' : 'You don’t have to carry this alone'}</Text>
    <Text style={c.body}>
      {urgent
        ? 'If you might act on these thoughts, call 112 right now, or ask someone near you to stay with you.'
        : 'Thank you for answering honestly. If these thoughts get stronger, please talk to someone straight away.'}
    </Text>
    <Pressable testID="crisis-call-112" accessibilityRole="button" onPress={() => void Linking.openURL(CRISIS_EMERGENCY_LINK)} style={[c.button, c.primary]}><Text style={c.primaryText}>Call 112 (emergency)</Text></Pressable>
    <Pressable testID="crisis-call-mieli" accessibilityRole="button" onPress={() => void Linking.openURL(CRISIS_HELPLINE_LINK)} style={c.button}><Text style={c.buttonText}>{CRISIS_HELPLINE_LABEL}</Text></Pressable>
    <Pressable testID="crisis-ask-care-team" accessibilityRole="button" disabled={busy || requested} onPress={onAskCareTeam} style={[c.button, (busy || requested) && { opacity: 0.6 }]}><Text style={c.buttonText}>{requested ? 'Check-in request sent to your care team' : 'Ask my care team to check in'}</Text></Pressable>
    <Text style={c.small}>AIriane is not monitored in real time. Outside Finland, call your local emergency number.</Text>
  </View>;
}
const c = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: '#fff4f1', borderWidth: 1, borderColor: '#f3c7bc' },
  urgent: { borderColor: '#b42318', borderWidth: 2 },
  title: { fontFamily: t.type.display, fontSize: 17, fontWeight: '700', color: '#7a271a' },
  body: { fontFamily: t.type.body, fontSize: 14, lineHeight: 21, color: '#5c1d12' },
  button: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3c7bc' },
  primary: { backgroundColor: '#b42318', borderColor: '#b42318' },
  primaryText: { fontFamily: t.type.body, color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonText: { fontFamily: t.type.body, color: '#7a271a', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  small: { fontFamily: t.type.body, fontSize: 11, color: '#7a271a' },
});
