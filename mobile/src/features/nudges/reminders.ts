/**
 * Web: phone reminders are not available in the browser (iOS Safari only allows web notifications
 * for installed home-screen apps over HTTPS). The in-app pop-up still checks in when the app opens.
 */
import type { ReminderSettings } from './nudge-plan';

export const remindersSupported = false;
export async function getReminderSettings(): Promise<ReminderSettings | null> { return null; }
export async function setReminders(_settings: ReminderSettings | null, _activeToday: boolean): Promise<boolean> { return false; }
export async function refreshReminders(_activeToday: boolean) {}
export async function sendTestReminder(): Promise<boolean> { return false; }
export function listenForReminders(_onNudge: () => void): () => void { return () => {}; }
