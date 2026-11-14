import type { Alert } from '@/lib/types';
const when = (value: string) => `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
const stateLabel: Record<Alert['state'], string> = { open: 'Open', acknowledged: 'Acknowledged', resolved: 'Resolved' };
const describe = (alert: Alert) => alert.rule_key === 'patient_requested_review' ? 'Patient asked for a clinician check-in' : alert.rule_key === 'questionnaire_safety_item' ? 'Questionnaire: self-harm question answered above 0 · all answers sent' : 'Patient-shared request';
export function AlertList({ patientId, alerts, unavailable, readOnly }: { patientId: string; alerts: Alert[]; unavailable?: string; readOnly?: boolean }) {
  return <section className="alerts" aria-labelledby="alerts-title">
    <h2 id="alerts-title">Check-in requests</h2>
    <p className="alerts-note">A request is a patient-initiated message, not an emergency monitoring signal.</p>
    {unavailable ? <p className="empty" role="status">{unavailable}</p> : alerts.length === 0 ? <p className="empty">No check-in requests have been shared.</p> : <ul className="alert-list">{alerts.map(alert => {
      const next = alert.state === 'open' ? 'acknowledged' : alert.state === 'acknowledged' ? 'resolved' : undefined;
      return <li key={alert.alert_id}><div><h4>{describe(alert)}</h4><p>{when(alert.created_at)}</p></div><div className="alert-actions"><span className={`alert-state alert-state-${alert.state}`} role="status" aria-label={`Status: ${stateLabel[alert.state]}`}>{stateLabel[alert.state]}</span>{next && !readOnly && <form action="/care/alerts" method="post"><input type="hidden" name="patient_id" value={patientId}/><input type="hidden" name="alert_id" value={alert.alert_id}/><input type="hidden" name="expected_version" value={alert.version}/><input type="hidden" name="state" value={next}/><button type="submit">{next === 'acknowledged' ? 'Acknowledge' : 'Mark resolved'}</button></form>}</div></li>;
    })}</ul>}
    {readOnly && alerts.length > 0 && <p className="alerts-note">Fictional fixture. Requests cannot be updated in demonstration mode.</p>}
  </section>;
}
