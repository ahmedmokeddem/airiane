import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button, Surface, s } from '../product/product-ui';
import { theme as t } from '../../theme';
import { REMINDER_TIMES, type ReminderFrequency, type ReminderSettings } from './nudge-plan';
import { getReminderSettings, remindersSupported, sendTestReminder, setReminders } from './reminders';

const FREQUENCIES: { value: ReminderFrequency | 'off'; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Once a day' },
  { value: 'every_other_day', label: 'Every other day' },
];

/** Profile panel: occasional phone reminders, chosen by the patient. */
export function ReminderSettingsPanel({ activeToday }: { activeToday: boolean }) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { getReminderSettings().then(v => { setSettings(v); setLoaded(true); }).catch(() => setLoaded(true)); }, []);
  const apply = async (next: ReminderSettings | null) => {
    setBusy(true); setMessage('');
    try {
      const ok = await setReminders(next, activeToday);
      if (ok) setSettings(next);
      setMessage(ok ? (next ? 'Gentle reminders are on. You can change or stop them any time.' : 'Reminders are off.') : 'Notifications are turned off for AIriane in your phone settings.');
    } catch { setMessage('Reminders could not be changed. Please try again.'); }
    finally { setBusy(false); }
  };
  const time = settings ?? { frequency: 'daily' as const, hour: 18, minute: 0 };
  return <Surface>
    <View style={c.heading}><Feather name="bell" size={20} color={t.accent} /><Text style={s.sectionTitle}>Gentle reminders</Text></View>
    {!remindersSupported ? <Text style={s.subtitle}>Phone reminders work in the Android and iOS app. Here in the browser, AIriane checks in gently when you open it.</Text> : <>
      <Text style={s.subtitle}>An occasional, quiet nudge to check in or take a calm minute. Reminders skip days you have already done something, and never mention your health on the lock screen.</Text>
      <View style={c.row}>{FREQUENCIES.map(f => {
        const selected = (settings?.frequency ?? 'off') === f.value;
        return <Pressable key={f.value} testID={`reminder-frequency-${f.value}`} accessibilityRole="radio" accessibilityState={{ selected, disabled: busy || !loaded }} disabled={busy || !loaded} onPress={() => void apply(f.value === 'off' ? null : { ...time, frequency: f.value })} style={[c.chip, selected && c.chosen]}><Text style={[c.chipText, selected && c.chosenText]}>{f.label}</Text></Pressable>;
      })}</View>
      {settings && <View style={c.row}>{REMINDER_TIMES.map(r => {
        const selected = settings.hour === r.hour && settings.minute === r.minute;
        return <Pressable key={r.label} testID={`reminder-time-${r.hour}`} accessibilityRole="radio" accessibilityState={{ selected, disabled: busy }} disabled={busy} onPress={() => void apply({ ...settings, hour: r.hour, minute: r.minute })} style={[c.chip, selected && c.chosen]}><Text style={[c.chipText, selected && c.chosenText]}>{r.label}</Text></Pressable>;
      })}</View>}
      <Button secondary label="Send a test reminder in 10 seconds" icon="send" disabled={busy} onPress={() => void (async () => { setMessage((await sendTestReminder()) ? 'Sent. Leave the app or lock the screen to see it arrive.' : 'Notifications are turned off for AIriane in your phone settings.'); })()} />
    </>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.small}>{message}</Text>}
  </Surface>;
}
const c = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface },
  chosen: { backgroundColor: t.accent, borderColor: t.accent },
  chipText: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.ink },
  chosenText: { color: '#fff' },
});
