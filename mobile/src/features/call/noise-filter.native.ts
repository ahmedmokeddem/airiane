/**
 * Native Android/iOS: microphone audio is captured and sent by native WebRTC code, so JavaScript
 * cannot process it. Calls use the phone's voice-communication mode, which applies the system's
 * echo cancellation and noise suppression. Gating background voices on native needs a native
 * audio processing module (see docs/NOISE_FILTER.md).
 */
export const noiseFilterSupported = false;
export function primeNoiseFilter() {}
export async function prepareNoiseFilter() {}
export async function releaseNoiseFilter() {}
