/**
 * Phone reminders (Android/iOS) using local notifications scheduled on the device. No server,
 * account or connected doctor is needed. The scheduled notifications are the record of the
 * patient's choice, so nothing else has to be stored.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { NUDGE_KIND, REMINDER_COPY, reminderDates, settingsFromSchedule, type ReminderSettings } from './nudge-plan';

export const remindersSupported = true;
const CHANNEL = 'gentle-checkins';
const AHEAD = 14; // reminders scheduled in advance; refreshed whenever the app is opened

// While the app is open the in-app pop-up is used instead of a system banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: true }),
});

async function ours() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter(n => n.content.data?.kind === NUDGE_KIND);
}

function triggerDate(request: Notifications.NotificationRequest): Date | null {
  // Platforms report a scheduled date as `date`, `value` or `timestamp`.
  const trigger = request.trigger as { value?: number; date?: number | string; timestamp?: number } | null;
  const value = trigger?.date ?? trigger?.value ?? trigger?.timestamp;
  if (value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getReminderSettings(): Promise<ReminderSettings | null> {
  const dates = (await ours()).map(triggerDate).filter((d): d is Date => d !== null);
  return settingsFromSchedule(dates);
}

async function permitted(ask: boolean) {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Gentle check-ins',
      description: 'Occasional reminders to take a calm minute',
      importance: AndroidImportance.DEFAULT,
    });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !ask) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function schedule(settings: ReminderSettings, skipToday: boolean) {
  const dates = reminderDates(new Date(), settings, AHEAD, skipToday);
  for (const [i, date] of dates.entries()) {
    const copy = REMINDER_COPY[(date.getDate() + i) % REMINDER_COPY.length];
    await Notifications.scheduleNotificationAsync({
      content: { ...copy, data: { kind: NUDGE_KIND }, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
  }
}

async function cancelOurs() {
  for (const n of await ours()) await Notifications.cancelScheduledNotificationAsync(n.identifier);
}

/** Turn reminders on (asks for permission) or off (`null`). Returns false if permission was refused. */
export async function setReminders(settings: ReminderSettings | null, activeToday: boolean): Promise<boolean> {
  await cancelOurs();
  if (!settings) return true;
  if (!(await permitted(true))) return false;
  await schedule(settings, activeToday);
  return true;
}

/** Keep the schedule topped up; skip today once the patient has done something calming. */
export async function refreshReminders(activeToday: boolean) {
  const settings = await getReminderSettings();
  if (!settings || !(await permitted(false))) return;
  await cancelOurs();
  await schedule(settings, activeToday);
}

/** A reminder 10 seconds from now, to see how it looks (leave the app to see the banner). */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await permitted(true))) return false;
  await Notifications.scheduleNotificationAsync({
    content: { ...REMINDER_COPY[0], data: { kind: NUDGE_KIND, test: true }, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
  return true;
}

/** Calls `onNudge` when a reminder is tapped (also on launch from one) or arrives while open. */
export function listenForReminders(onNudge: () => void): () => void {
  const isOurs = (n: Notifications.Notification) => n.request.content.data?.kind === NUDGE_KIND;
  const launched = Notifications.getLastNotificationResponse();
  if (launched && isOurs(launched.notification)) {
    onNudge();
    Notifications.clearLastNotificationResponse();
  }
  const tapped = Notifications.addNotificationResponseReceivedListener(r => { if (isOurs(r.notification)) onNudge(); });
  const received = Notifications.addNotificationReceivedListener(n => { if (isOurs(n)) onNudge(); });
  return () => { tapped.remove(); received.remove(); };
}
