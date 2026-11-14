import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button, Surface, s } from '../product/product-ui';
import { api } from '../../integration/api';
import { theme as t } from '../../theme';
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
  useEffect(() => { api.observations().then(setObservations).catch(() => setError('Your check-ins could not be loaded. Please try again.')); }, []);
  const today = confirmedOn(observations ?? [], new Date()); const waiting = pending(observations ?? []);
  const done = fields.every(f => today[f.kind]);
  const save = () => run(async () => {
    try { for (const f of fields) await api.decideObservation(await api.proposeObservation(f.kind, values[f.kind]), 'confirm'); setEditing(false); }
    // A value saved but not yet confirmed stays visible below as a proposal.
    finally { await load(); }
  });
  const change = (kind: Kind, direction: 1 | -1, max: number, step: number) => setValues(v => ({ ...v, [kind]: stepValue(v[kind], direction, max, step) }));
  return <Surface>
    <View style={c.heading}>
      <View style={c.icon}><Feather name="sun" size={21} color={t.accent} /></View>
      <View style={c.grow}><Text style={s.eyebrow}>DAILY CHECK-IN</Text><Text style={s.sectionTitle}>Mood · Energy · Sleep</Text></View>
    </View>
    <Text style={s.subtitle}>Three quick taps. These are your own estimates — nothing is measured automatically.</Text>
    {waiting.length > 0 && <View style={c.block}>
      <Text style={c.label}>Waiting for your confirmation</Text>
      {waiting.map(o => <View key={o.observation_id} style={c.pending}>
        <Text style={c.value}>{fields.find(f => f.kind === o.kind)!.label}: {format(o.kind, o.value)}</Text>
        <Button label="That's right" icon="check" disabled={busy} onPress={() => void run(async () => { await api.decideObservation(o, 'confirm'); await load(); })} />
        <Button secondary label="Not quite" disabled={busy} onPress={() => void run(async () => { await api.decideObservation(o, 'reject'); await load(); })} />
      </View>)}
    </View>}
    {done && !editing ? <View style={c.block}>
      <Text style={c.label}>Saved for today</Text>
      <Text testID="check-in-summary" style={c.value}>{fields.map(f => `${f.label} ${format(f.kind, today[f.kind]!.value)}`).join('  ·  ')}</Text>
      <Button secondary label="Add another check-in" disabled={busy} onPress={() => setEditing(true)} />
    </View> : <View style={c.block}>
      {fields.map(f => <View key={f.kind} style={c.field}>
        <View style={c.grow}><Text style={c.label}>{f.label}</Text><Text style={s.small}>{f.hint}</Text></View>
        <View accessible accessibilityRole="adjustable" accessibilityLabel={f.label} accessibilityValue={{ min: 0, max: f.max, now: values[f.kind], text: format(f.kind, values[f.kind]) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => change(f.kind, e.nativeEvent.actionName === 'increment' ? 1 : -1, f.max, f.step)} style={c.stepper}>
          <Pressable testID={`check-in-${f.kind}-less`} accessibilityLabel={`Lower ${f.label}`} disabled={busy || values[f.kind] <= 0} onPress={() => change(f.kind, -1, f.max, f.step)} style={c.step}><Feather name="minus" size={18} color={t.ink} /></Pressable>
          <Text testID={`check-in-${f.kind}-value`} style={c.number}>{format(f.kind, values[f.kind])}</Text>
          <Pressable testID={`check-in-${f.kind}-more`} accessibilityLabel={`Raise ${f.label}`} disabled={busy || values[f.kind] >= f.max} onPress={() => change(f.kind, 1, f.max, f.step)} style={c.step}><Feather name="plus" size={18} color={t.ink} /></Pressable>
        </View>
      </View>)}
      <Button label={busy ? 'Saving…' : 'Confirm and save check-in'} icon="check" disabled={busy || observations === null} onPress={() => void save()} />
    </View>}
    {error !== '' && <Text accessibilityRole="alert" style={c.error}>{error}</Text>}
  </Surface>;
}
const c = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1 },
  icon: { height: 44, width: 44, borderRadius: 15, backgroundColor: t.sage, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: t.type.display, fontSize: 15, fontWeight: '600', color: t.ink, lineHeight: 22 },
  value: { fontFamily: t.type.body, fontSize: 14, color: t.ink, lineHeight: 22 },
  pending: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: t.low },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.low, alignItems: 'center', justifyContent: 'center' },
  number: { minWidth: 58, textAlign: 'center', fontFamily: t.type.display, fontSize: 16, fontWeight: '600', color: t.ink, fontVariant: ['tabular-nums'] },
  error: { fontFamily: t.type.body, color: t.error, fontSize: 13, lineHeight: 20 },
});
