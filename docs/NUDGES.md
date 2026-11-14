# Gentle check-ins and reminders

Works for every patient, with or without a connected doctor. Nothing is sent to a server.

## Two layers

1. **In-app pop-up** (`mobile/src/features/nudges/nudge-popup.tsx`) — web and phone, no permission.
   Shown shortly after sign-in or when returning to the app, only if the patient has not completed
   a calming activity today, at most once every 4 hours. Offers "Check in with AIriane" and
   "One calm minute" (activities tailored to the latest check-in and questionnaire). The first time,
   it also offers phone reminders.
2. **Phone reminders** (`reminders.native.ts`, `expo-notifications`) — Android/iOS only, opt-in
   in Profile → Gentle reminders: Off / Once a day / Every other day, at 9:00, 13:00, 18:00 or
   20:30. Scheduled locally 14 days ahead and refreshed whenever the app opens; a day where the
   patient already did something is skipped. Tapping one opens the pop-up.

Lock-screen text never mentions health, mood, treatment or symptoms, and never uses pressure or
"streak" language. The rules are in `nudge-plan.ts` and tested in `mobile/tests/nudges.test.ts`.

The browser cannot show phone reminders (iOS only allows web notifications for installed
home-screen apps over HTTPS), so the web build uses the pop-up only.

## Testing on the Android emulator

`expo-notifications` is a native module, so the development build must be rebuilt once.

1. Start the emulator (Android Studio → Device Manager → ▶ on `Medium_Phone_API_37.0`).
2. In PowerShell:
   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   ```
3. In `mobile/.env`, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` (the emulator's address for
   your PC; the web build ignores this and uses the page's host).
4. Stop any Metro already on port 8081, then from `mobile/`: `npx expo run:android`
   (the first build takes several minutes).
5. Sign in with the demo button. Allow notifications when Android asks.
6. Profile → Gentle reminders → **Send a test reminder in 10 seconds**, then press the emulator's
   Home button. The reminder appears in the notification shade; tap it and AIriane opens with the
   pop-up.
7. Choose **Once a day** and a time; leave Profile and come back — the selection is read back from
   the phone's schedule.
