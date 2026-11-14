import Link from 'next/link';
import { clinician } from '@/lib/workspace';
import { SharedReportsTable } from '@/components/workspace/shared-reports-table';
import { loadSharedReportRows, type ReportLoadResult } from '@/lib/shared-report-loader';
import { wellbeingRow } from '@/lib/shared-reports';
import fixture from '@/fixtures/clinician.json';
import type { DoctorPatient, Report } from '@/lib/types';

export const metadata = { title: 'Shared reports' };
export default async function Reports({searchParams}: {searchParams:Promise<{cursor?:string}>}) {
  const {cursor} = await searchParams;
  const session = await clinician();
  const directory = session.mock ? fixture.patients : await session.api!.patients(cursor);
  const patients = directory.items as DoctorPatient[];
  let data:ReportLoadResult;
  if (session.mock) {
    const report = fixture.report as Report;
    data = {
      rows:patients.filter(p=>p.scopes.includes('reports')).map(patient=>wellbeingRow(patient,{
        report_id:report.report_id,state:report.state,version:report.version,
        period_start:report.period_start,period_end:report.period_end,created_at:report.generated_at,
      })), notices:[],moreReports:[],
    };
  } else {
    data = await loadSharedReportRows(session.api!,patients);
  }
  return <>
    <header className="workspace-heading">
      <div><p className="section-kicker">Patient-authorized documents</p><h1>Shared reports, at a glance.</h1><p>Find a patient, compare reporting periods, and open the record they chose to share.</p></div>
      <Link className="button button-outline button-small" href="/patients">Patient directory</Link>
    </header>
    {cursor&&<p className="workspace-footnote"><Link href="/reports">Return to the first patient group</Link></p>}
    <SharedReportsTable key={cursor??'first'} rows={data.rows} patients={patients.map(p=>({id:p.patient_id,name:p.display_name}))} nextCursor={directory.next_cursor}/>
    {!!data.notices.length&&<aside className="report-load-notices" aria-label="Records that could not be loaded"><h2>Some records are unavailable</h2><p>Access may have changed or a service may be unavailable. Reload to check current access.</p><ul>{data.notices.map(n=><li key={`${n.patientId}:${n.kind}`}>{n.patientName}: {n.kind.toLowerCase()} could not be loaded.</li>)}</ul><Link href={cursor?`/reports?cursor=${encodeURIComponent(cursor)}`:'/reports'}>Reload reports</Link></aside>}
    {!!data.moreReports.length&&<aside className="report-load-notices"><h2>More documents are available</h2><p>This table contains the current report page for each loaded patient. Continue in the patient record to see older documents.</p><ul>{data.moreReports.map(p=><li key={p.patientId}><Link href={`/patients/${p.patientId}?cursor=${encodeURIComponent(p.cursor)}`}>More reports for {p.patientName}</Link></li>)}</ul></aside>}
    <p className="workspace-footnote">Authorization is checked again when a document opens. Wellbeing-report creation dates are not sharing dates; conversation insights show a sharing date when recorded. Reports describe saved information, not a measure of recovery.</p>
  </>;
}
