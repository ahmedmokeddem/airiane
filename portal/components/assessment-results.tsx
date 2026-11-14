import type { Report } from '@/lib/types';

type Assessment = Report['assessments'][number];
type Detail = NonNullable<Assessment['answer_details']>[number];
type Result = NonNullable<Assessment['result']>;
const when = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value));

/** Severity scale with every band from the questionnaire, and a marker at the patient's total. */
export function ScaleBar({ result }: { result: Result }) {
  const span = result.max_total + 1;
  const position = ((result.total + 0.5) / span) * 100;
  return <div className="scale" role="img" aria-label={`Total ${result.total} of ${result.max_total}: ${result.severity}`}>
    <div className="scale-track">
      {result.bands.map(band => <span key={band.min} className={`scale-band level-${band.level}`} style={{ width: `${((band.max - band.min + 1) / span) * 100}%` }} title={`${band.min}–${band.max}: ${band.label}`} />)}
      <i className="scale-marker" style={{ left: `${position}%` }} />
    </div>
    <div className="scale-labels">{result.bands.map(band => <span key={band.min} style={{ width: `${((band.max - band.min + 1) / span) * 100}%` }}>{band.min}–{band.max}</span>)}</div>
  </div>;
}

/** Scored questionnaires in a shared report: screening information for the clinician. */
export function AssessmentResults({ report, heading = 'Questionnaire results' }: { report: Pick<Report, 'assessments' | 'timezone'>; heading?: string }) {
  const scored = report.assessments.filter(a => a.complete && a.result).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  if (!scored.length) return null;
  return <section className="assessment-results" aria-labelledby="assessment-results-title">
    <h2 id="assessment-results-title">{heading}</h2>
    <p className="alerts-note">Scored from answers the patient selected. Screening information to support your assessment, not a diagnosis.</p>
    {scored.map(a => {
      const r = a.result!;
      return <article key={a.assessment_response_id} className={`assessment-card level-${r.level}`}>
        <header><h3>{a.title}</h3><span className="record-tag">{r.validated ? 'Validated questionnaire' : 'Indicative only'}</span></header>
        <p className="assessment-meta">{when(a.observed_at, report.timezone)}</p>
        {r.safety.item_positive && <div className="assessment-safety" role="alert"><strong>Item 9 answered above 0</strong> (thoughts of death or self-harm). Every answer is listed below. The app showed crisis contacts at the time; it is not monitored.</div>}
        <p className="assessment-total"><strong>{r.total}</strong> / {r.max_total} · <span>{r.severity}</span></p>
        <ScaleBar result={r} />
        {r.suggested_action && <p><b>Suggested action:</b> {r.suggested_action}</p>}
        <p><b>Interpretation:</b> {r.interpretation}</p>
        {r.functional_impairment && <p><b>Functional difficulty (Q10, asked because Q9 &gt; 0, not scored):</b> {r.functional_impairment}</p>}
        {r.domains.length > 0 && <table className="domain-table"><caption>Symptom groups</caption><thead><tr><th>Group</th><th>Questions</th><th>Score</th></tr></thead><tbody>{r.domains.map(d => <tr key={d.name}><td><b>{d.name}</b><small>{d.description}</small></td><td>{d.questions.join(', ')}</td><td><span className="domain-bar"><i style={{ width: `${(d.score / d.max) * 100}%` }} /></span>{d.score}/{d.max}</td></tr>)}</tbody></table>}
        <p className="assessment-note">{r.note}</p>
        <details open={r.safety.item_positive}><summary>All answers</summary>{a.answer_details?.length ? <ol className="answer-list">{a.answer_details.map((d: Detail) => <li key={d.question_id}><span>{d.wording}</span><b>{d.label}</b><small>{d.scored ? `${d.value} point${d.value === 1 ? '' : 's'}` : 'not scored'}</small></li>)}</ol> : <ul>{a.answers.map(x => <li key={x.question_id}>{x.question_id.toUpperCase()}: {x.value}</li>)}</ul>}</details>
      </article>;
    })}
  </section>;
}
