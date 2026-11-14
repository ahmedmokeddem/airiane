import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../integration/api';
import { theme as t } from '../../theme';
import { fields, format, pending, type Observation } from './checkin-state';

/**
 * Confirmation cards for check-in answers the companion heard in chat or on a call.
 * An answer only counts once the patient taps "That's right" here; "Not quite" discards it so the
 * companion can ask again. `refreshKey` changes whenever a new answer may have been proposed.
 */
export function CheckInProposals({ refreshKey, dark = false, onDecided }: { refreshKey: number; dark?: boolean; onDecided: (observation: Observation) => void }) {
  const [waiting, setWaiting] = useState<Observation[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let live = true; api.observations().then(all => { if (live) setWaiting(pending(all)); }).catch(() => {}); return () => { live = false; }; }, [refreshKey]);
  const decide = async (observation: Observation, decision: 'confirm' | 'reject') => {
    if (busy) return; setBusy(true); setError('');
    try { const decided = await api.decideObservation(observation, decision); setWaiting(w => w.filter(o => o.observation_id !== observation.observation_id)); onDecided(decided); }
    catch { setError('That could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  if (waiting.length === 0) return null;
  const ink = dark ? '#f1f6f8' : t.ink;
  return <View style={c.root}>
    {waiting.map(o => <View key={o.observation_id} testID={`check-in-proposal-${o.kind}`} style={[c.card, dark ? c.cardDark : c.cardLight]}>
      <Text style={[c.eyebrow, { color: dark ? '#83c9bd' : t.accent }]}>DID I HEAR THAT RIGHT?</Text>
      <Text style={[c.value, { color: ink }]}>{fields.find(f => f.kind === o.kind)!.label}: {format(o.kind, o.value)}</Text>
      <View style={c.row}>
        <Pressable testID={`check-in-confirm-${o.kind}`} accessibilityRole="button" accessibilityLabel={`Confirm ${fields.find(f => f.kind === o.kind)!.label} ${format(o.kind, o.value)}`} disabled={busy} onPress={() => void decide(o, 'confirm')} style={[c.button, c.primary, busy && c.disabled]}><Text style={c.primaryText}>That’s right</Text></Pressable>
        <Pressable testID={`check-in-reject-${o.kind}`} accessibilityRole="button" disabled={busy} onPress={() => void decide(o, 'reject')} style={[c.button, dark ? c.quietDark : c.quiet, busy && c.disabled]}><Text style={[c.quietText, { color: ink }]}>Not quite</Text></Pressable>
      </View>
    </View>)}
    {error !== '' && <Text accessibilityRole="alert" style={[c.error, dark && { color: '#f4c8bf' }]}>{error}</Text>}
  </View>;
}
const c = StyleSheet.create({
  root: { gap: 10 },
  card: { padding: 16, borderRadius: 20, gap: 10, borderWidth: 1 },
  cardLight: { backgroundColor: t.sage, borderColor: t.border },
  cardDark: { backgroundColor: '#133133e8', borderColor: '#65afa54a' },
  eyebrow: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  value: { fontFamily: t.type.display, fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primary: { backgroundColor: t.accent },
  primaryText: { fontFamily: t.type.body, color: '#fff', fontSize: 13, fontWeight: '700' },
  quiet: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  quietDark: { backgroundColor: '#ffffff14' },
  quietText: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { fontFamily: t.type.body, color: t.error, fontSize: 12 },
});
