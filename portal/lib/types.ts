import type { components } from '../../contracts/generated/api';
export type Alert = components['schemas']['Alert'];
export type DoctorPatient = components['schemas']['DoctorPatient'];
export type Report = components['schemas']['Report'];
export type AssessmentResponse = components['schemas']['AssessmentResponse'];
export type ReportReceipt = components['schemas']['ReportReceipt'];
export type MedicationReminder = components['schemas']['MedicationReminder'];
export type Page<T> = { items: T[]; next_cursor: string | null };
