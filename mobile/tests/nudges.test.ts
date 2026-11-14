import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POPUP_GAP_MS, REMINDER_COPY, popupCopy, reminderDates, settingsFromSchedule, shouldShowPopup } from '../src/features/nudges/nudge-plan';

test('the pop-up is occasional and stays away once something calming is done today', () => {
  const now = Date.parse('2026-11-14T15:00:00');
  assert.equal(shouldShowPopup({ now, lastShownAt: null, activeToday: false }), true);
  assert.equal(shouldShowPopup({ now, lastShownAt: null, activeToday: true }), false);
  assert.equal(shouldShowPopup({ now, lastShownAt: now - POPUP_GAP_MS + 60_000, activeToday: false }), false);
  assert.equal(shouldShowPopup({ now, lastShownAt: now - POPUP_GAP_MS, activeToday: false }), true);
});

test('reminders follow the chosen time and frequency, skipping a day already done', () => {
  const now = new Date('2026-11-14T15:00:00');
  const daily = reminderDates(now, { frequency: 'daily', hour: 18, minute: 0 }, 3, false);
  assert.deepEqual(daily.map(d => [d.getDate(), d.getHours(), d.getMinutes()]), [[14, 18, 0], [15, 18, 0], [16, 18, 0]]);
  // Already active today: start tomorrow. A time that has passed today also starts tomorrow.
  assert.equal(reminderDates(now, { frequency: 'daily', hour: 18, minute: 0 }, 1, true)[0].getDate(), 15);
  assert.equal(reminderDates(now, { frequency: 'daily', hour: 9, minute: 0 }, 1, false)[0].getDate(), 15);
  const everyOther = reminderDates(now, { frequency: 'every_other_day', hour: 20, minute: 30 }, 3, false);
  assert.deepEqual(everyOther.map(d => d.getDate()), [14, 16, 18]);
  // The schedule can be read back as the same settings.
  assert.deepEqual(settingsFromSchedule(everyOther), { frequency: 'every_other_day', hour: 20, minute: 30 });
  assert.deepEqual(settingsFromSchedule(daily), { frequency: 'daily', hour: 18, minute: 0 });
  assert.equal(settingsFromSchedule([]), null);
});

test('lock-screen text never mentions health, and the tone is an invitation', () => {
  const words = /mood|depress|anxi|treatment|tms|therapy|symptom|recovery|medic|health|doctor|missed|streak|failed|should/i;
  for (const copy of REMINDER_COPY) assert.ok(!words.test(copy.title + ' ' + copy.body), copy.title);
  const evening = popupCopy('Alex', new Date('2026-11-14T19:00:00'), false);
  assert.equal(evening.title, 'Good evening, Alex');
  assert.ok(evening.body.startsWith('How are you arriving today?'));
});

test('phone reminders are optional, local-only, and never need a connected doctor', () => {
  const native = readFileSync(new URL('../src/features/nudges/reminders.native.ts', import.meta.url), 'utf8');
  assert.ok(native.includes('requestPermissionsAsync'));
  assert.ok(!/getExpoPushTokenAsync|getDevicePushTokenAsync|request\(/.test(native), 'no push tokens or server calls');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(!/hasConnectedDoctor[^\n]*maybeNudge|maybeNudge[^\n]*hasConnectedDoctor/.test(app));
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.ok(config.expo.plugins.some((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications' && p[1].enableRemoteNotifications === false));
});
