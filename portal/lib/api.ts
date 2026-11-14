import type { DoctorPatient, Page, Report, ReportReceipt } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number) { super(status === 403 ? 'Patient authorization is unavailable or has been revoked.' : status === 401 ? 'Clinician sign-in is required.' : status === 409 ? 'The report is not ready yet.' : 'Reports could not be loaded. Try again.'); }
}
export class ClinicianApi {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  private async get<T>(path: string): Promise<T> {
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new ApiError(response.status);
    return await response.json() as T;
  }
  me() { return this.get<import('./auth').Me>('/v1/me'); }
  careLinks() { return this.get<Page<import('../../contracts/generated/api').components['schemas']['CareLink']>>('/v1/care-links'); }
  patients() { return this.get<Page<DoctorPatient>>('/v1/doctor/patients'); }
  reports(patientId: string) { return this.get<Page<ReportReceipt>>(`/v1/doctor/patients/${encodeURIComponent(patientId)}/reports`); }
  report(patientId: string, reportId: string) { return this.get<Report>(`/v1/doctor/patients/${encodeURIComponent(patientId)}/reports/${encodeURIComponent(reportId)}`); }
}
