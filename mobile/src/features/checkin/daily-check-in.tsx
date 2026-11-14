import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Action, Card, styles as ui } from '../../components/ui';
import { api } from '../../integration/api';
import { theme } from '../../theme';
import { confirmedOn, fields, format, pending, stepValue, type Kind, type Observation } from './checkin-state';

/**
 * Daily Check-In (Mood · Energy · Sleep).
 * Every value is self-reported and only counts after the patient explicitly confirms it here;
 * values suggested during a voice conversation appear as proposals to confirm or dismiss.
 */
export function DailyCheckIn() {
  const [values, setValues] = useState<Record<Kind, number>>(() => Object.fromEntries(fields.map(f => [f.kind, f.initial])) as Record<Kind, number>);
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [editing, setEditing] = useState(false);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please retry.'); } finally { setBusy(false); } };
  const load = async () => setObservations(await api.observations());
  useEffect(() => { api.observations().then(setObservations).catch(() => setError('Your check-ins could not be loaded. Refresh to retry.')); }, []);
  const today = confirmedOn(observations ?? [], new Date()); const waiting = pending(observations ?? []);
  const done = fields.every(f => today[f.kind]);
  const save = () => run(async () => {
    try { for (const f of fields) await api.decideObservation(await api.proposeObservation(f.kind, values[f.kind]), 'confirm'); setEditing(false); }
    // A value saved but not yet confirmed stays visible below as a proposal.
    finally { await load(); }
  });
  return <Card>
    <Text style={ui.eyebrow}>DAILY CHECK-IN</Text>
    <Text style={styles.title}>Mood · Energy · Sleep</Text>
    <Text style={ui.body}>Three quick taps. These are your own estimates — nothing is measured automatically.</Text>
    {waiting.length > 0 && <View style={styles.block}>
      <Text style={styles.label}>Waiting for your confirmation</Text>
      {waiting.map(o => <View key={o.observation_id} style={styles.pending}>
        <Text style={styles.value}>{fields.find(f => f.kind === o.kind)!.label}: {format(o.kind, o.value)}</Text>
        <View style={styles.row}>
          <Action label="That's right" disabled={busy} onPress={() => void run(async () => { await api.decideObservation(o, 'confirm'); await load(); })} />
          <Action secondary label="Not quite" disabled={busy} onPress={() => void run(async () => { await api.decideObservation(o, 'reject'); await load(); })} />
        </View>
      </View>)}
    </View>}
    {done && !editing ? <View style={styles.block}>
      <Text style={styles.label}>Saved for today</Text>
      <Text testID="check-in-summary" style={styles.value}>{fields.map(f => `${f.label} ${format(f.kind, today[f.kind]!.value)}`).join('  ·  ')}</Text>
      <Action secondary label="Add another check-in" disabled={busy} onPress={() => setEditing(true)} />
    </View> : <View style={styles.block}>
      {fields.map(f => <View key={f.kind} style={styles.field}>
        <View style={{ flex: 1 }}><Text style={styles.label}>{f.label}</Text><Text style={styles.hint}>{f.hint}</Text></View>
        <View accessible accessibilityRole="adjustable" accessibilityLabel={f.label} accessibilityValue={{ min: 0, max: f.max, now: values[f.kind], text: format(f.kind, values[f.kind]) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => setValues(v => ({ ...v, [f.kind]: stepValue(v[f.kind], e.nativeEvent.actionName === 'increment' ? 1 : -1, f.max, f.step) }))} style={styles.stepper}>
          <Pressable testID={`check-in-${f.kind}-less`} accessibilityLabel={`Lower ${f.label}`} disabled={busy || values[f.kind] <= 0} onPress={() => setValues(v => ({ ...v, [f.kind]: stepValue(v[f.kind], -1, f.max, f.step) }))} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
          <Text testID={`check-in-${f.kind}-value`} style={styles.number}>{format(f.kind, values[f.kind])}</Text>
          <Pressable testID={`check-in-${f.kind}-more`} accessibilityLabel={`Raise ${f.label}`} disabled={busy || values[f.kind] >= f.max} onPress={() => setValues(v => ({ ...v, [f.kind]: stepValue(v[f.kind], 1, f.max, f.step) }))} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
        </View>
      </View>)}
      <Action label={busy ? 'Saving…' : 'Confirm and save check-in'} disabled={busy || observations === null} onPress={() => void save()} />
    </View>}
    {error !== '' && <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text>}
  </Card>;
}
const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', color: theme.ink, letterSpacing: -0.5 },
  block: { gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 16, fontWeight: '600', color: theme.ink }, hint: { fontSize: 13, color: theme.muted },
  value: { fontSize: 16, color: theme.ink, lineHeight: 24 },
  pending: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: theme.low },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.low, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, color: theme.ink },
  number: { minWidth: 64, textAlign: 'center', fontSize: 18, fontWeight: '600', color: theme.ink, fontVariant: ['tabular-nums'] },
});
