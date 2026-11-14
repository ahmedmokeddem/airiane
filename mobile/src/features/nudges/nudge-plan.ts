/**
 * Gentle check-ins that work without a doctor: when to show the in-app pop-up, when to schedule
 * phone reminders, and what they say. Pure functions, so the rules are testable.
 *
 * Tone: an invitation, never pressure or guilt. Phone reminders can appear on a lock screen, so
 * their text never mentions health, mood, treatment or symptoms.
 */
export type ReminderFrequency = 'daily' | 'every_other_day';
export type ReminderSettings = { frequency: ReminderFrequency; hour: number; minute: number };
export const REMINDER_TIMES = [
  { hour: 9, minute: 0, label: 'Morning · 9:00' },
  { hour: 13, minute: 0, label: 'Midday · 13:00' },
  { hour: 18, minute: 0, label: 'Evening · 18:00' },
  { hour: 20, minute: 30, label: 'Wind-down · 20:30' },
];
export const NUDGE_KIND = 'airiane-gentle-checkin';

/** Lock-screen-safe reminder text; rotates so it does not feel automated. */
export const REMINDER_COPY = [
  { title: 'A small moment for you', body: 'One easy minute with AIriane, whenever you’re ready.' },
  { title: 'Hi from AIriane', body: 'How are you arriving today? A quick check-in is here if you’d like it.' },
  { title: 'A pause, if you want one', body: 'A short, calm break is ready for you. No pressure.' },
  { title: 'Thinking of you', body: 'A gentle minute is waiting in AIriane, any time today.' },
  { title: 'Just checking in', body: 'Small steps count. Open AIriane for one quiet minute.' },
];

/** In-app pop-up text (private screen, so it can mention the recovery routine). */
export function popupCopy(name: string | undefined, now: Date, checkInDone: boolean) {
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return {
    title: `${greeting}${name ? `, ${name}` : ''}`,
    body: checkInDone
      ? 'Thanks for checking in today. If you have a minute, a small calming step can help keep your recovery steady.'
      : 'How are you arriving today? A quick check-in, or one calm minute, can help keep your recovery steady.',
  };
}

/** Minimum time between in-app pop-ups, so they stay occasional. */
export const POPUP_GAP_MS = 4 * 60 * 60 * 1000;

/** Show the pop-up only if nothing calming was done today and none was shown recently. */
export function shouldShowPopup({ now, lastShownAt, activeToday }: { now: number; lastShownAt: number | null; activeToday: boolean }) {
  if (activeToday) return false;
  return lastShownAt === null || now - lastShownAt >= POPUP_GAP_MS;
}

/**
 * The next reminder times (local time), `count` of them. Today is skipped when the patient has
 * already done something today or today's time has passed.
 */
export function reminderDates(now: Date, settings: ReminderSettings, count: number, skipToday: boolean): Date[] {
  const step = settings.frequency === 'daily' ? 1 : 2;
  const first = new Date(now);
  first.setHours(settings.hour, settings.minute, 0, 0);
  if (skipToday || first.getTime() <= now.getTime() + 60_000) first.setDate(first.getDate() + 1);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first);
    date.setDate(first.getDate() + i * step);
    return date;
  });
}

/** Reads settings back from the scheduled reminders (the OS schedule is the source of truth). */
export function settingsFromSchedule(dates: Date[]): ReminderSettings | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gapDays = sorted.length > 1 ? Math.round((sorted[1].getTime() - sorted[0].getTime()) / 86_400_000) : 1;
  return { frequency: gapDays >= 2 ? 'every_other_day' : 'daily', hour: sorted[0].getHours(), minute: sorted[0].getMinutes() };
}
