/**
 * Metro-bundled soundscape assets from `mobile/assets/audio/`, keyed by file name
 * (the same names used in `assets/audio/manifest.json`).
 *
 * This module is loaded lazily via require() from audio-therapy.ts: requiring a
 * .wav/.mp3 only works under Metro, and `mobile/tests/wellbeing.test.ts` imports
 * audio-therapy.ts into a plain Node process. See findings/MOBILE_AUDIO.md.
 *
 * On native each require() returns a numeric asset id (Expo SDK 58 metro docs).
 */
export const NATIVE_AUDIO_ASSETS: Record<string, number> = {
  // manifest.json tracks
  'nordic-forest-birds-40hz.wav': require('../../../assets/audio/nordic-forest-birds-40hz.wav'),
  'gentle-rain-stream.wav': require('../../../assets/audio/gentle-rain-stream.wav'),
  'bilateral-grounding-chimes.wav': require('../../../assets/audio/bilateral-grounding-chimes.wav'),
  // NATURE_SOUNDSCAPES switcher files (same bytes as mobile/public/audio/*)
  'nordic_forest_birds.mp3': require('../../../assets/audio/nordic_forest_birds.mp3'),
  'gentle_rain.mp3': require('../../../assets/audio/gentle_rain.mp3'),
  'nordic_stream.mp3': require('../../../assets/audio/nordic_stream.mp3'),
  'gamma_40hz_pink_noise.wav': require('../../../assets/audio/gamma_40hz_pink_noise.wav'),
};
