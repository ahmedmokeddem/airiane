import { PdfDownload } from '@/components/pdf-download';
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import fixture from '@/fixtures/clinician.json';
import { ClinicianApi } from '@/lib/api';
import type { Alert, DoctorPatient, Report } from '@/lib/types';
import { ReportView } from '@/components/report-view';
import { AlertList } from '@/components/alert-list';
import { AutoRefresh } from '@/components/auto-refresh';
import { PatientList } from '@/components/patient-list';
export const dynamic = 'force-dynamic';
type Search = { patient?: string; report?: string; error?: string; medication?: string };
export default async function Dashboard({searchParams}:{searchParams:Promise<Search>}) {
  const query = await searchParams;
  const mode = process.env.PORTAL_DATA_MODE ?? 'mock';
  let invitations: import('../../contracts/generated/api').components['schemas']['CareLink'][]=[]; let clinicianCode:string|undefined;let demoIdentity=false;
  let patients: DoctorPatient[] = []; let report: Report | undefined; let message: string | undefined;
  let alerts: Alert[] | undefined; let alertMessage: string | undefined;
  if (mode === 'mock') { patients = fixture.patients.items as DoctorPatient[]; report = fixture.report as Report; alerts = fixture.alerts.items as Alert[]; }
  else if (mode === 'api') {
    const token = (await cookies()).get('re_access_token')?.value;demoIdentity=token==='demo-clinician-token';
    if (!token) message = 'Sign in to view authorized patient reports.';
    else {
      try {
        const api = new ClinicianApi(process.env.RE_API_URL ?? 'http://127.0.0.1:8000', token);
        const [me, careLinks, authorizedPatients] = await Promise.all([api.me(), api.careLinks(), api.patients()]);
        clinicianCode=me.user_id;
        invitations=careLinks.items.filter(link=>link.state==='pending');
        patients = authorizedPatients.items;
        const selected = patients.find(patient => patient.patient_id === query.patient) ?? patients.find(patient => patient.attention?.flagged) ?? patients[0];
        if (selected?.scopes.includes('alerts')) {
          try { alerts = (await api.alerts(selected.patient_id)).items; }
          catch { alertMessage = 'Check-in requests could not be loaded. Refresh to try again.'; }
        }
        if (selected?.scopes.includes('reports')) {
          const reports = (await api.reports(selected.patient_id)).items;
          const receipt = reports.find(item => item.report_id === query.report) ?? reports.find(item => item.state === 'ready' || item.state === 'stale');
          if (receipt) report = await api.report(selected.patient_id, receipt.report_id);
          else message = 'No viewable report is available. The patient may not have shared a report yet.';
        } else message = 'No patient report authorization is active.';
      } catch (error) { message = error instanceof Error ? error.message : 'Reports could not be loaded.'; }
    }
  } else message = 'Portal configuration is invalid. Choose mock or api data mode.';
  const selected = patients.find(patient => patient.patient_id === query.patient) ?? patients.find(patient => patient.attention?.flagged) ?? patients[0];
  const attention = selected?.attention?.flagged ? selected.attention.reasons : [];
  return <div className="workspace"><aside className="sidebar"><Link href="/" className="brand" aria-label="AIriane clinician home"><Image src="/brand/airiane-wordmark.png" alt="AIriane" width={184} height={48} priority/></Link><p className="workspace-name">Clinician workspace</p><nav aria-label="Workspace"><Link href="/" aria-current="page" className="nav-active">Patient reports</Link></nav><p className="sidebar-note">A shared view.<br/>The patient stays in control.</p></aside><main><header className="topbar"><span>Care, with context</span><span className="workspace-badge">Clinician portal</span></header>{mode==='api'&&demoIdentity&&<div className="demo-notice" role="status"><strong>Development identity</strong><span>This fictional clinician uses real backend reports and authorization checks.</span></div>}{mode === 'mock' && <div className="demo-notice" role="status"><strong>Fictional demonstration</strong><span>Reports and authorization are fixtures. No patient data or clinician sign-in is connected.</span></div>}{mode==='api'&&<AutoRefresh/>}{mode==='api'&&<section className="session-controls"><Link href="/login">Sign in</Link><form action="/auth/logout" method="post"><button type="submit">Sign out</button></form>{clinicianCode&&<p>Your doctor connection code: <code>{clinicianCode}</code></p>}</section>}{invitations.map(link=><section className="demo-notice" key={link.care_link_id}><span>Patient connection invitation. Report sharing requires their separate permission after acceptance.</span><form action="/care/accept" method="post"><input type="hidden" name="care_link_id" value={link.care_link_id}/><button type="submit">Accept connection</button></form></section>)}{query.error&&<p role="alert">{query.error==='alert-unavailable'?'The request could not be updated. Refresh and try again.':query.error==='medication-unavailable'?'Medication reminder could not be saved.':'The connection could not be accepted. Refresh and check your authorization.'}</p>}{query.medication==='saved'&&<div className="demo-notice" role="status"><strong>Daily medication reminder updated</strong><span>The connected patient will see this reminder on their Home screen.</span></div>}<div className="page-title"><div><h1>Your patient workspace</h1><p>Review what patients have chosen to share.</p></div></div><div className="content-grid"><section className="patient-panel" aria-labelledby="patients-title"><h2 id="patients-title">Connected patients</h2><PatientList patients={patients} selectedId={selected?.patient_id} mock={mode==='mock'}/><p className="sharing-note">Report access requires an active care link and patient permission on every request.</p></section><div>{selected&&attention.length>0&&<section className="risk-banner" role="status"><strong>{selected.display_name} may need attention</strong><p>{attention.join(' · ')}</p><p className="risk-note">Rule-based prompt from what this patient currently shares. It is not a diagnosis or a relapse prediction.</p></section>}{selected&&mode==='api'&&<section className="med-card" aria-labelledby="med-title"><h2 id="med-title">Daily medication reminder</h2><p className="alerts-note">Send a gentle daily medication prompt to {selected.display_name}’s Home screen.</p><form className="med-form" action="/care/medication" method="post"><input type="hidden" name="patient_id" value={selected.patient_id}/><input name="schedule_time" type="time" defaultValue="09:00" aria-label="Reminder time"/><input name="message" type="text" defaultValue="Take your prescribed daily medication" maxLength={240} aria-label="Reminder message"/><button type="submit">Save daily reminder</button></form></section>}{selected&&(alerts||alertMessage)&&<AlertList patientId={selected.patient_id} alerts={alerts??[]} unavailable={alertMessage} readOnly={mode!=='api'}/>}{message && <section className="empty-state" role="status"><h2>Reports unavailable</h2><p>{message}</p><Link href="/">Check again</Link></section>}{report && <><ReportView report={report}/>{mode==='api'&&<PdfDownload patientId={report.patient_id} reportId={report.report_id} enabled={!!report.document&&report.state==='ready'}/>}</>}</div></div></main></div>;
}
