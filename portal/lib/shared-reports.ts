import type { DoctorPatient, ReportReceipt } from './types';
import type { InsightReportResponse } from './insight-types';

export type ReportKind = 'wellbeing' | 'insight';
export type ReportStatus = ReportReceipt['state'] | 'shared';
export interface SharedReportRow {
  id: string;
  patientId: string;
  patientName: string;
  kind: ReportKind;
  status: ReportStatus;
  version: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string | null;
  sharedAt: string | null;
  href: string;
}
export const kindLabels: Record<ReportKind, string> = { wellbeing: 'Wellbeing report', insight: 'Conversation insight' };
export const statusLabels: Record<ReportStatus, string> = {
  ready: 'Ready', stale: 'Saved snapshot', pending: 'Preparing', failed: 'Preparation failed', shared: 'Shared',
};
const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export function wellbeingRow(patient: DoctorPatient, report: ReportReceipt): SharedReportRow {
  return {
    id: report.report_id, patientId: patient.patient_id, patientName: patient.display_name,
    kind: 'wellbeing', status: report.state, version: report.version,
    periodStart: date(report.period_start), periodEnd: date(report.period_end), createdAt: date(report.created_at),
    // Ordinary report grants authorize a period, not a per-document share timestamp.
    sharedAt: null,
    href: `/reports/${encodeURIComponent(patient.patient_id)}/${encodeURIComponent(report.report_id)}`,
  };
}
export function insightRow(patient: DoctorPatient, report: InsightReportResponse): SharedReportRow {
  return {
    id: report.report_id, patientId: patient.patient_id, patientName: patient.display_name,
    kind: 'insight', status: 'shared', version: null,
    periodStart: date(report.report.coverage.period_start), periodEnd: date(report.report.coverage.period_end),
    createdAt: date(report.created_at), sharedAt: date(report.shared_at),
    href: `/patients/${encodeURIComponent(patient.patient_id)}#insight-${encodeURIComponent(report.report_id)}`,
  };
}
export interface ReportFilters { search: string; patient: string; kind: string; status: string; from: string; to: string }
export const emptyReportFilters: ReportFilters = { search: '', patient: '', kind: '', status: '', from: '', to: '' };
export type ReportSort = 'patientName' | 'kind' | 'periodStart' | 'createdAt' | 'status';
export function selectReports(rows: SharedReportRow[], filters: ReportFilters, sort: ReportSort, direction: 'asc' | 'desc') {
  const query = filters.search.trim().toLocaleLowerCase();
  if (filters.from && filters.to && filters.from > filters.to) return [];
  return rows.filter(row => {
    const start = row.periodStart?.slice(0, 10), end = row.periodEnd?.slice(0, 10);
    return (!query || `${row.patientName} ${row.id}`.toLocaleLowerCase().includes(query)) &&
      (!filters.patient || row.patientId === filters.patient) && (!filters.kind || row.kind === filters.kind) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.from || !!end && end >= filters.from) && (!filters.to || !!start && start <= filters.to);
  }).sort((a, b) => {
    const av = sort === 'status' ? statusLabels[a.status] : sort === 'kind' ? kindLabels[a.kind] : a[sort];
    const bv = sort === 'status' ? statusLabels[b.status] : sort === 'kind' ? kindLabels[b.kind] : b[sort];
    // Unknown dates stay last in either direction; never replace them with today's date.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const compare = sort === 'createdAt' || sort === 'periodStart'
      ? (av ? Date.parse(av) : 0) - (bv ? Date.parse(bv) : 0)
      : String(av ?? '').localeCompare(String(bv ?? ''), 'en', { sensitivity: 'base', numeric: true });
    return compare ? compare * (direction === 'asc' ? 1 : -1) : `${a.patientId}:${a.kind}:${a.id}`.localeCompare(`${b.patientId}:${b.kind}:${b.id}`);
  });
}
export function reportDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Date unavailable';
}
