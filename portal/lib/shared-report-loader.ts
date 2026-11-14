import type { ClinicianApi } from './api';
import type { DoctorPatient } from './types';
import { insightRow, wellbeingRow, type SharedReportRow } from './shared-reports';

export interface ReportLoadResult {
  rows: SharedReportRow[];
  notices: { patientId: string; patientName: string; kind: string }[];
  moreReports: { patientId: string; patientName: string; cursor: string }[];
}
/** Bounded parallel requests. No per-report reads and no evidence/text crosses to the table. */
export async function loadSharedReportRows(api: Pick<ClinicianApi, 'reports' | 'insightReports'>, patients: DoctorPatient[]): Promise<ReportLoadResult> {
  const groups: ReportLoadResult[] = [];
  for (let offset = 0; offset < patients.length; offset += 4) {
    const batch = await Promise.all(patients.slice(offset, offset + 4).map(async patient => {
      const result: ReportLoadResult = { rows: [], notices: [], moreReports: [] };
      const [reports, insights] = await Promise.allSettled([
        patient.scopes.includes('reports') ? api.reports(patient.patient_id) : Promise.resolve(null),
        api.insightReports(patient.patient_id),
      ]);
      if (reports.status === 'fulfilled' && reports.value) {
        result.rows.push(...reports.value.items.map(item => wellbeingRow(patient, item)));
        if (reports.value.next_cursor) result.moreReports.push({patientId:patient.patient_id,patientName:patient.display_name,cursor:reports.value.next_cursor});
      } else if (reports.status === 'rejected') {
        result.notices.push({patientId:patient.patient_id,patientName:patient.display_name,kind:'Wellbeing reports'});
      }
      if (insights.status === 'fulfilled') {
        result.rows.push(...insights.value.items.filter(item => item.status === 'shared' && item.patient_id === patient.patient_id && item.recipient_care_link_id === patient.care_link_id).map(item => insightRow(patient,item)));
      } else {
        result.notices.push({patientId:patient.patient_id,patientName:patient.display_name,kind:'Conversation insights'});
      }
      return result;
    }));
    groups.push(...batch);
  }
  return { rows: groups.flatMap(g=>g.rows), notices: groups.flatMap(g=>g.notices), moreReports: groups.flatMap(g=>g.moreReports) };
}
