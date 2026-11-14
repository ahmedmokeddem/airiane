import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '../product/product-ui';
import { theme as t } from '../../theme';
import { popupCopy } from './nudge-plan';

/**
 * The gentle in-app check-in. Shown occasionally when the patient opens or returns to the app and
 * has not done anything calming today, and when they tap a phone reminder.
 */
export function NudgePopup({ visible, name, checkInDone, offerReminders, onCheckIn, onCalm, onReminders, onClose }: {
  visible: boolean; name?: string; checkInDone: boolean; offerReminders: boolean;
  onCheckIn: () => void; onCalm: () => void; onReminders: () => void; onClose: () => void;
}) {
  const copy = popupCopy(name, new Date(), checkInDone);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={c.backdrop}>
      <View testID="nudge-popup" accessibilityViewIsModal style={c.sheet}>
        <View style={c.icon}><Feather name="sun" size={24} color={t.accent} /></View>
        <Text style={c.title}>{copy.title}</Text>
        <Text style={c.body}>{copy.body}</Text>
        {!checkInDone && <Button label="Check in with AIriane" icon="message-circle" onPress={onCheckIn} />}
        <Button secondary={!checkInDone} label="One calm minute" icon="wind" onPress={onCalm} />
        {offerReminders && <Pressable testID="nudge-reminders" accessibilityRole="button" onPress={onReminders} style={c.link}><Feather name="bell" size={14} color={t.accent} /><Text style={c.linkText}>Remind me gently each day</Text></Pressable>}
        <Pressable testID="nudge-not-now" accessibilityRole="button" onPress={onClose} style={c.quiet}><Text style={c.quietText}>Not now</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const c = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00132566', justifyContent: 'flex-end', padding: 16 },
  sheet: { backgroundColor: t.surface, borderRadius: 28, padding: 24, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center', marginBottom: 12 },
  icon: { height: 48, width: 48, borderRadius: 24, backgroundColor: t.sage, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: t.type.display, fontSize: 22, fontWeight: '600', color: t.ink },
  body: { fontFamily: t.type.body, fontSize: 15, lineHeight: 23, color: t.muted },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 },
  linkText: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.accent },
  quiet: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  quietText: { fontFamily: t.type.body, fontSize: 13, color: t.muted },
});
