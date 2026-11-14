import Link from 'next/link';
import type { DoctorPatient } from '@/lib/types';

/**
 * Connected patients, with only those who may need attention highlighted.
 * Flags are rule-based triage over what each patient currently shares (see the backend's
 * guidance rules); they are a prompt to look, not a diagnosis or a relapse prediction.
 * Everyone else stays visually quiet, and the streak is a single muted line.
 */
export function PatientList({ patients, selectedId, mock }: { patients: DoctorPatient[]; selectedId?: string; mock: boolean }) {
  const flagged = patients.filter(patient => patient.attention?.flagged);
  const others = patients.filter(patient => !patient.attention?.flagged);
  const row = (patient: DoctorPatient) => {
    const attention = patient.attention?.flagged ? patient.attention.reasons : [];
    const streak = patient.streak_days ?? 0;
    return <Link className={`patient ${selectedId === patient.patient_id ? 'selected' : ''} ${attention.length ? 'patient-attention' : ''}`} key={patient.patient_id} href={`/patients/${patient.patient_id}`}>
      <span className="avatar" aria-hidden="true">{patient.display_name[0]}</span>
      <span>
        <strong>{patient.display_name}</strong>
        {attention.length > 0
          ? <span className="attention-reasons">{attention.join(' · ')}</span>
          : <small>{mock ? 'Fictional sharing fixture' : 'Patient-authorized access'}</small>}
        {streak > 0 && <small className="streak-note">{streak}-day activity streak</small>}
      </span>
    </Link>;
  };
  if (patients.length === 0) return <p className="empty">No accessible patients to display.</p>;
  return <>
    {flagged.length > 0 && <div className="attention-group" role="group" aria-labelledby="attention-title">
      <h3 id="attention-title" className="attention-title">Needs attention <span>{flagged.length}</span></h3>
      {flagged.map(row)}
    </div>}
    {others.length > 0 && <>
      {flagged.length > 0 && <h3 className="quiet-title">Other patients</h3>}
      {others.map(row)}
    </>}
    {flagged.length === 0 && <p className="sharing-note">No shared check-in currently suggests a patient needs attention.</p>}
  </>;
}
