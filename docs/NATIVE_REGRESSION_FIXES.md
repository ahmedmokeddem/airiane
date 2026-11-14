# Android camera and activity sound regression investigation

14 November 2026. Existing provider IDs, API contracts and backend persistence are unchanged.

## Findings and changes

The prior activity player used browser AudioContext and browser /audio URLs. On Android, its fallback marked playback as running without producing sound. Native resolution now uses `audio-therapy.native.ts`, Expo Audio 58.0.12 (SDK-matched), and literal Metro references to the existing approved recordings. Each nature selection selects its corresponding bundled file. Playback stops on leaving an activity/backgrounding, cancels stale asynchronous starts, supports mute, and surfaces playback errors with retry. The web synthesizer is retained.

Expo Audio's installed Android mode setter also changes AudioManager routing. Mixing is therefore prepared before LiveKit starts, never while an in-call activity begins. LiveKit retains ownership of communication routing/focus. Independent microphone selection is not added. Native dynamic bilateral panning is unsupported by this player and its toggle is hidden; stereo recordings still play. Other native activity sounds are accurately labelled recorded ambience/chimes rather than claiming browser synthesis.

The existing APK contains camera permission. Camera mount errors previously toggled the preview off without reporting the failure. They now surface a retry message. The permission result remains pending through Android foreground settlement before mounting the preview, covering the permission-dialog lifecycle race. Camera remains opt-in, local-only and independent of voice connection. No frame capture/transmission is added. The exact reported device camera error has not yet been captured, so its original cause remains unconfirmed.

## Verification

- Mobile tests: 65 passed, including native source selection, stale-start cancellation, mute and stop.
- Final Typecheck and ESLint passed.
- Android ARM64 release build passed in 6m46s; same internal signing identity, production Aiven URL and credential scan verified. All six source recordings match packaged APK bytes. Artifact and checksum are recorded in implementation status.
- ADB repeatedly returned no devices, including a host-access retry after the user reconnected. Camera startup, audible selected recordings, Bluetooth coexistence and cleanup in this build are NOT TESTED ON DEVICE.
- A new native APK is required because Expo Audio adds a native module; a JavaScript reload alone cannot update the installed release APK.
- Web playback cannot verify Android audio or camera behavior.

Changed mobile files: app.json, package.json/package-lock.json; activity/audio-therapy.ts, audio-therapy.native.ts, soundscapes.ts, native-playback.ts, native-audio-session.ts; call/audio-session.native.ts, call-screen.tsx, use-local-camera.ts; product/product-screens.tsx; tests/native-playback.test.ts and tests/run.ts. All feature paths are under mobile/src/features.
