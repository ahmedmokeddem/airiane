import type { InsightDimension, InsightReportResponse } from '@/lib/insight-types';

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const assessmentLine = (label: string, item: InsightReportResponse['report']['assessments']['phq9']) =>
  item
    ? `${label}: ${item.total}/${item.max_total} · ${item.severity}${item.safety_item_positive ? ' · item 9 above 0' : ''}`
    : `${label}: not available to this report.`;

function Dimension({ item }: { item: InsightDimension }) {
  return (
    <li>
      <strong>{item.label}</strong> <span className="record-tag">{item.status.replaceAll('_', ' ')}</span>
      <p>{item.note}</p>
      {item.evidence.length > 0 && (
        <details>
          <summary>Evidence ({item.evidence.length} source message{item.evidence.length === 1 ? '' : 's'})</summary>
          <ul className="answer-list">
            {item.evidence.map(source => (
              <li key={`${source.message_id}-${source.event_at}`}>
                <span>“{source.quote}”</span>
                <small>{when(source.event_at)} · message {source.message_id.slice(0, 8)}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** Therapist-facing, non-technical rendering of a shared conversation insight report. */
export function InsightReportPanel({
  reports,
  patientName,
  unavailable,
}: {
  reports: InsightReportResponse[];
  patientName: string;
  unavailable?: string;
}) {
  if (!reports.length && !unavailable) return null;
  return (
    <section className="assessment-results" aria-labelledby="insight-reports-title">
      <h2 id="insight-reports-title">Shared conversation insight reports</h2>
      <p className="alerts-note">
        Patient-authored conversation summary. This is not a diagnosis, risk classification or
        treatment recommendation. Evidence quotes remain linked to the submitted message.
      </p>
      {unavailable && <p className="assessment-note">{unavailable}</p>}
      {reports.map(report => {
        const data = report.report;
        const patterns = data.dimensions.filter(item => item.status === 'observed_pattern');
        return (
          <article key={report.report_id} id={`insight-${report.report_id}`} className="assessment-card">
            <header>
              <h3>Conversation insight · {patientName}</h3>
              <span className="record-tag">{report.status === 'shared' ? 'Shared with you' : 'Private draft'}</span>
            </header>
            <p className="assessment-meta">
              {when(data.coverage.period_start)} – {when(data.coverage.period_end)} · {data.coverage.message_count} messages
            </p>
            {data.safety.present ? (
              <div className="assessment-safety" role="alert">
                <strong>Safety-related language</strong>
                <p>{data.safety.message}</p>
                {data.safety.evidence.map(source => (
                  <p key={`${source.message_id}-${source.event_at}`}>
                    “{source.quote}” <small>{when(source.event_at)}</small>
                  </p>
                ))}
              </div>
            ) : (
              <p><b>Safety information</b> — {data.safety.message} This is not evidence of absence.</p>
            )}
            <p><b>Assessment overview</b> — {assessmentLine('PHQ-9', data.assessments.phq9)}. {assessmentLine('BDI-II (adapted)', data.assessments.bdi_ii)}. {data.assessments.note}</p>
            <h4>Reported experiences</h4>
            <ul className="answer-list">
              {data.dimensions.map(item => <Dimension key={item.key} item={item} />)}
            </ul>
            <h4>Functional impact</h4>
            <ul className="answer-list"><Dimension item={data.functional_impact} /></ul>
            <h4>Positive experiences and support</h4>
            <ul className="answer-list"><Dimension item={data.positive_experiences} /></ul>
            <h4>Notable patterns</h4>
            {patterns.length ? (
              <ul>{patterns.map(item => <li key={item.key}>{item.label}: {item.note}</li>)}</ul>
            ) : <p>No repeated pattern had enough explicit evidence to describe.</p>}
            <h4>Suggested follow-up questions</h4>
            <ul>{data.follow_up_suggestions.map(item => <li key={item}>{item}</li>)}</ul>
            <h4>Information gaps</h4>
            <ul>{data.information_gaps.map(item => <li key={item}>{item}</li>)}</ul>
            <h4>Limitations</h4>
            <ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="assessment-note">
              Sharing status: {data.consent.sharing_status.replaceAll('_', ' ')}
              {data.consent.shared_at ? ` · ${when(data.consent.shared_at)}` : ''}
            </p>
          </article>
        );
      })}
    </section>
  );
}
