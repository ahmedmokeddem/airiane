import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button, Surface, s } from '../product/product-ui';
import { api } from '../../integration/api';
import { theme as t } from '../../theme';
import { confirmedOn, fields, format, type Observation } from './checkin-state';

/**
 * Daily check-in status on Home. The three questions (mood, energy, sleep) are asked by the
 * companion in conversation, not filled in here; this card only shows what the patient confirmed
 * today and offers to start. Answers are self-reported — nothing is measured automatically.
 */
export function DailyCheckIn({ onStart, onUpdate, onAssessment, busy = false }: { onStart: () => void; onUpdate?: () => void; onAssessment?: () => void; busy?: boolean }) {
  const [observations, setObservations] = useState<Observation[] | null>(null);
  useEffect(() => { let live = true; api.observations().then(all => { if (live) setObservations(all); }).catch(() => { if (live) setObservations([]); }); return () => { live = false; }; }, []);
  const today = confirmedOn(observations ?? [], new Date());
  const answered = fields.filter(f => today[f.kind]);
  const done = answered.length === fields.length;
  return <Surface style={done ? { backgroundColor: t.sage } : undefined}>
    <View style={c.heading}>
      <View style={c.icon}><Feather name={done ? 'check' : 'sun'} size={21} color={t.accent} /></View>
      <View style={c.grow}><Text style={s.eyebrow}>DAILY CHECK-IN</Text><Text style={s.sectionTitle}>{done ? 'Today’s check-in is saved' : 'Three gentle questions'}</Text></View>
    </View>
    {answered.length > 0 && <Text testID="check-in-summary" style={c.value}>{answered.map(f => `${f.label} ${format(f.kind, today[f.kind]!.value)}`).join('  ·  ')}</Text>}
    {!done && <>
      <Text style={s.subtitle}>AIriane will ask about your mood, energy and sleep, one at a time. Answer by voice or text, in your own words. These are your own estimates — nothing is measured automatically.</Text>
      <Button label={answered.length ? 'Continue check-in with AIriane' : 'Start check-in with AIriane'} icon="message-circle" disabled={busy || observations === null} onPress={onStart} />
    </>}
    {done && onUpdate && <Button secondary label="Update with AIriane" icon="edit-3" disabled={busy} onPress={onUpdate} />}
    {onAssessment && <Button secondary label="Fuller check (optional questionnaire)" icon="clipboard" disabled={busy} onPress={onAssessment} />}
  </Surface>;
}
const c = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1 },
  icon: { height: 44, width: 44, borderRadius: 15, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: t.type.body, fontSize: 14, color: t.ink, lineHeight: 22 },
});
