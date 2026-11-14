import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mode } from '../../integration/api';
import { theme as t } from '../../theme';
import { Button, Surface } from '../product/product-ui';
import {
  careLinks,
  createInsightReport,
  revokeInsightReport,
  shareInsightReport,
} from './api';
import type {
  CareLink,
  InsightDimension,
  InsightReportResponse,
} from './types';

const messageFor = (role: string) => (role === 'user' ? 'Patient' : 'Assistant');
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

function DimensionCard({ item }: { item: InsightDimension }) {
  return (
    <Surface>
      <Text style={s.sectionTitle}>{item.label}</Text>
      <Text style={s.status}>{item.status.replaceAll('_', ' ')}</Text>
      <Text style={s.body}>{item.note}</Text>
      {item.evidence.map((source, index) => (
        <View key={`${source.message_id}-${index}`} style={s.evidence}>
          <Text style={s.evidenceMeta}>
            {messageFor('user')} · {dateLabel(source.event_at)} · {source.message_id.slice(0, 8)}
          </Text>
          <Text style={s.quote}>“{source.quote}”</Text>
        </View>
      ))}
    </Surface>
  );
}

export function InsightReportScreen({
  messages,
  sessionId,
  onExit,
}: {
  messages: { role: string; text: string }[];
  sessionId: string | null;
  onExit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<InsightReportResponse | null>(null);
  const [links, setLinks] = useState<CareLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'live') return;
    void careLinks()
      .then(items => {
        const active = items.filter(item => item.state === 'active');
        setLinks(active);
        setSelectedLink(active[0]?.care_link_id ?? null);
      })
      .catch(() => setError('Connected therapists could not be loaded. Your draft stays private.'));
  }, []);

  const generate = async () => {
    if (!messages.length) {
      setError('Have a conversation first. There is no conversation text to summarize yet.');
      return;
    }
    if (mode === 'live' && !sessionId) {
      setError('Open a conversation session before preparing a report.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReport(await createInsightReport(sessionId ?? 'mock-session', messages));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The private report could not be generated.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!report || !selectedLink || !consent) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await shareInsightReport(report.report_id, selectedLink));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The report could not be shared.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await revokeInsightReport(report.report_id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sharing could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topBar}>
          <Text style={s.eyebrow}>CONVERSATION INSIGHT</Text>
          <Pressable testID="insights-leave" accessibilityRole="button" onPress={onExit} hitSlop={8}>
            <Text style={s.leave}>Home</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={s.title}>Private conversation insight report</Text>
        <Text style={s.intro}>
          This report is generated from your current conversation. It is a private draft until
          you review it and explicitly share it with a connected therapist. It is not a
          diagnosis or a risk classification.
        </Text>

        {!report ? (
          <Surface>
            <Text style={s.sectionTitle}>Prepare a draft</Text>
            <Text style={s.body}>
              {messages.length
                ? `${messages.length} conversation messages are available from this session.`
                : 'No current conversation messages are available.'}
            </Text>
            <Button label={busy ? 'Preparing…' : 'Prepare private draft'} disabled={busy} onPress={() => void generate()} />
          </Surface>
        ) : (
          <>
            <Surface>
              <Text style={s.sectionTitle}>Draft status</Text>
              <Text testID="insight-report-status" style={s.status}>{report.status.replace('_', ' ')}</Text>
              <Text style={s.body}>
                {report.report.coverage.message_count} messages · {report.report.coverage.patient_message_count} patient messages
              </Text>
              <Text style={s.body}>Generated {dateLabel(report.created_at)}</Text>
            </Surface>

            <Surface>
              <Text style={s.sectionTitle}>Assessments</Text>
              <Text style={s.body}>{report.report.assessments.note}</Text>
              <Text style={s.body}>
                PHQ-9: {report.report.assessments.phq9 ? `${report.report.assessments.phq9.total}/${report.report.assessments.phq9.max_total} ${report.report.assessments.phq9.severity}` : 'not available'}
              </Text>
              <Text style={s.body}>
                BDI-II: {report.report.assessments.bdi_ii ? `${report.report.assessments.bdi_ii.total}/${report.report.assessments.bdi_ii.max_total} ${report.report.assessments.bdi_ii.severity}` : 'not available'}
              </Text>
            </Surface>

            {report.report.safety.present ? (
              <View testID="insight-safety" style={s.safety}>
                <Text style={s.safetyTitle}>Safety-related language</Text>
                <Text style={s.safetyBody}>{report.report.safety.message}</Text>
                {report.report.safety.evidence.map(source => (
                  <Text key={source.message_id} style={s.quote}>“{source.quote}”</Text>
                ))}
              </View>
            ) : null}

            {report.report.dimensions.map(item => <DimensionCard key={item.key} item={item} />)}
            <DimensionCard item={report.report.functional_impact} />
            <DimensionCard item={report.report.positive_experiences} />

            <Surface>
              <Text style={s.sectionTitle}>Information gaps and follow-up</Text>
              {report.report.information_gaps.map(item => <Text key={item} style={s.body}>• {item}</Text>)}
              {report.report.follow_up_suggestions.map(item => <Text key={item} style={s.body}>• {item}</Text>)}
            </Surface>

            <Surface>
              <Text style={s.sectionTitle}>Limitations</Text>
              {report.report.limitations.map(item => <Text key={item} style={s.body}>• {item}</Text>)}
            </Surface>

            <Surface>
              <Text style={s.sectionTitle}>Share with a therapist</Text>
              {report.status === 'shared' ? (
                <>
                  <Text style={s.body}>Shared with the selected connected therapist.</Text>
                  <Button secondary label="Revoke sharing" disabled={busy} onPress={() => void revoke()} />
                </>
              ) : links.length === 0 ? (
                <Text style={s.body}>
                  No authorized connected therapist is available. This draft stays private.
                </Text>
              ) : (
                <>
                  <Text style={s.body}>Choose the intended recipient:</Text>
                  {links.map(link => (
                    <Pressable
                      key={link.care_link_id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selectedLink === link.care_link_id }}
                      onPress={() => setSelectedLink(link.care_link_id)}
                      style={[s.option, selectedLink === link.care_link_id && s.optionSelected]}
                    >
                      <Text style={s.optionText}>
                        Connected therapist · {link.clinician_id.slice(0, 8)}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    testID="insight-consent"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consent }}
                    onPress={() => setConsent(value => !value)}
                    style={s.consentRow}
                  >
                    <View style={[s.checkbox, consent && s.checkboxSelected]} />
                    <Text style={s.body}>
                      I have reviewed this draft and consent to sharing it with the selected therapist.
                    </Text>
                  </Pressable>
                  <Button label="Share report" disabled={busy || !selectedLink || !consent} onPress={() => void share()} />
                </>
              )}
            </Surface>
          </>
        )}

        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <Button secondary label="Leave insights" onPress={onExit} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: t.type.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: t.accent },
  leave: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.muted },
  title: { fontFamily: t.type.display, fontSize: 28, lineHeight: 36, fontWeight: '600', color: t.ink },
  intro: { fontFamily: t.type.body, fontSize: 14, lineHeight: 21, color: t.muted },
  sectionTitle: { fontFamily: t.type.display, fontSize: 16, fontWeight: '600', color: t.ink },
  body: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: t.ink },
  status: { fontFamily: t.type.body, fontSize: 12, fontWeight: '700', color: t.accent, textTransform: 'uppercase' },
  evidence: { gap: 2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: t.border },
  evidenceMeta: { fontFamily: t.type.body, fontSize: 10, color: t.muted },
  quote: { fontFamily: t.type.body, fontSize: 12, lineHeight: 18, color: t.ink, fontStyle: 'italic' },
  safety: { gap: 6, padding: 15, borderRadius: 18, borderWidth: 2, borderColor: '#d9a79b', backgroundColor: '#fff7f4' },
  safetyTitle: { fontFamily: t.type.display, fontSize: 15, fontWeight: '700', color: '#6f2c1d' },
  safetyBody: { fontFamily: t.type.body, fontSize: 13, lineHeight: 20, color: '#5c2b20' },
  option: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.low },
  optionSelected: { borderWidth: 2, borderColor: t.accent, backgroundColor: t.sage },
  optionText: { fontFamily: t.type.body, fontSize: 13, fontWeight: '600', color: t.ink },
  consentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: t.muted, backgroundColor: t.surface },
  checkboxSelected: { backgroundColor: t.accent, borderColor: t.accent },
  error: { fontFamily: t.type.body, fontSize: 13, color: t.error },
});
