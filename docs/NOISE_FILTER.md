# Background noise filter (speech gate)

Helps AIriane listen to the patient rather than the room during voice calls.

## Layers

1. **Browser/phone voice processing (always on).** The voice SDK opens the microphone with echo
   cancellation, noise suppression and automatic gain control. This removes steady noise such as
   fans and hum, but not other people talking.
2. **Speech gate (web build, this feature).** Turns down sound that is much quieter than the
   patient's own voice, such as a TV or people further away.

## How the speech gate decides

Code: `mobile/src/features/call/speech-gate.ts` (algorithm, runs on the browser's audio thread)
and `noise-filter.ts` (wiring). Every 128 audio samples (about 3 ms):

- **Room floor:** tracks the quietest recent level; it is nearly frozen while the patient speaks,
  so long sentences are not mistaken for noise.
- **Patient level:** tracks how loud the patient's speech is once they have spoken.
- **Opens** only for sound clearly above the floor and within a "proximity window" of the patient's
  level (Standard 15 dB, Strong 11 dB). Sound drops about 6 dB each time the distance doubles, so a
  voice across the room usually arrives 10–20 dB quieter than the person holding the phone.
- **No clipped words:** 40 ms look-ahead, 300 ms hold between words, smooth gain changes.
- **Quieter, not silent:** closed means 15% (Standard) or 5% (Strong) volume, never zero.
- **Fails open:** if the browser cannot run it, the raw microphone is used. Camera requests are
  never touched.

The patient picks Off / Standard / Strong in the call's audio options; it applies immediately and
is remembered on that device.

## Limits

- It uses loudness, not voice identity: a loud voice right next to the phone can still get
  through, and a patient who speaks very softly far from the phone may be turned down (use Off).
- **Native Android/iOS:** audio is captured in native code, so this filter cannot run there; calls
  use the phone's built-in voice processing. To add it natively, write an Expo config plugin with a
  native WebRTC audio-processing module (Kotlin/Swift), or use a dedicated background-voice
  cancellation SDK; both need a development build and testing on real devices.
- Thresholds are tuned on simulated rooms and one offline browser render, not on recordings from
  real homes. Tune them with real calls before relying on them.
