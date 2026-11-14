import type { components } from '../../contracts/generated/api';
export type Alert = components['schemas']['Alert'];
export type DoctorPatient = components['schemas']['DoctorPatient'];
export type Report = components['schemas']['Report'];
export type ReportReceipt = components['schemas']['ReportReceipt'];
export type Page<T> = { items: T[]; next_cursor: string | null };
