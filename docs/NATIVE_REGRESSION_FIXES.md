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

## Physical-device voice startup diagnosis

After USB became visible, the installed older Aiven APK reproduced the generic interruption message. Its hash matched the older artifact, rather than the native-fixes build. The newer native-fixes APK was installed in place and reproduced the exact error `CONNECTION_ACTIVE` when opening Voice Call. Login restored an unfinished activity's parent session; its previous provider connection remained open on the backend, so bootstrap correctly rejected a duplicate connection.

Recovery now refreshes the owned session before connecting. If it is ended or has an unknown open provider connection, the app creates a fresh authenticated conversation session, rebuilds its UI bridge and clears stale recommendation cards. The original activity object/ID is preserved. Unknown connections are not closed or taken over, because they could belong to another device. Backend session ownership and one-connection-per-session checks remain unchanged. This avoids the restored-session blockage; it does not implement provider-side crash detection or retire old connection rows.

Automated checks: 67 tests passed, including unknown-connection isolation, refreshed-session reuse and read-error propagation. The recovery APK was installed in place on Samsung SM-G998B. After real patient sign-in, opening Voice Call reached Listening with active call controls and the unfinished activity still present. The patient confirmed “Yes, I hear AIriane reply” after the Hello test. The test call was ended; Android reported an empty active camera client list. Native selected-recording playback, Bluetooth hotplug and camera preview behavior are not newly verified by this voice-startup test.

## Recommendation visibility / overlapping callbacks

On-device observation in the faster-startup build showed a real voice-generated Calm Breathing recommendation partially below the caption and unfinished-activity panel. This proves a tool/card success for that attempt, not that every reported failure was a layout issue. Following the patient’s preference, new cards are a horizontal snapping carousel at the top of the call panel, with next-card preview, accessible position buttons and scroll-to-start on a new result. The bounded panel is slightly taller when choices are present; companion and toolbar stay mounted. Presenting choices clears the saved-state flag and returns from the activity panel to conversation without completing/abandoning the activity or reconnecting the provider.

MobileUIBridge now serializes overlapping presentations so one render acknowledgement cannot overwrite another pending tool callback. Each response still waits for its own exact cards to commit; failures do not poison the presentation queue. 74 tests pass, including overlapping result ordering, retry after failure and ignoring late SDK mode/transcript events after disconnection. A closed call must not regain a Listening label from stale callbacks. Device verification of this new layout is pending. The patient reported missing headset sound during the prior attempt; the phone had left AIriane when routing was inspected, so this does not yet establish a new Bluetooth regression or its cause.

### Confirmed provider timeout root cause

Readback of the actual deployed AIriane V2 agent showed response_timeout_secs=1 for present_activity_recommendations and select_activity. This explains the observed spoken failure while a card arrived: provider timeout can precede authenticated backend work and UI commit. The V2 workspace contained only this agent and the repair checked that no other agent referenced the targeted tool IDs. The operator script app.configure_tool_timeouts updated only those two client tool configurations to 45 seconds, then verified exact tool-config readback and unchanged agent platform/privacy settings. No original agent, model, voice or prompt was changed. Future V2 creation now sets these two timeouts explicitly rather than inheriting a one-second source value. Three agent-creation tests pass, including preservation of the source export.

Review command: `uv run --directory backend python -m app.configure_tool_timeouts`. Add `--apply` only for an intended provider change. It reads the existing private .env.airiane-v2.local profile, never logs its key, and refuses tools shared with another workspace agent. This service was already repaired; rerunning is not needed.

The card carousel is now outside the vertical conversation ScrollView, so card gestures are horizontal while captions/review panels retain separate vertical scrolling. New-device verification follows below when complete.

### Final physical observation and activity-focused refinement

After the timeout repair, the fresh Android call displayed all three real choices in the standalone horizontal carousel and the agent described returned options without the earlier loading-failure caption. A horizontal device swipe moved from the coffee/tea card (third position) to the walking card (second position); companion and toolbar remained present. The call subsequently showed Call ended, with inactive SCO, rather than a misleading Listening state. This verifies display/tool-response behavior, not activity completion or independent microphone input selection. Bluetooth was selected in the app and an active SCO link was observed earlier in the live call; a fresh explicit heard-audio confirmation was not obtained in this pass.

Patient feedback requested less mixing of captions and activity choices. Captions are now hidden by default while recommendations are shown, with an explicit Show/Hide captions control. The unfinished activity becomes a compact resume link, not another large card competing with the choices. The focused APK was built, signature/API/credential checked and installed. The physical check passed: three real voice-requested choices, successful agent description, Show/Hide captions toggle, horizontal swipe from breathing to walking, matching indicator, compact resume link, persistent companion/toolbar. Test call ended with no active camera clients. No activity was completed or rated in this visual test.
