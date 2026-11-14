/**
 * Web: run the voice-call microphone through the speech gate before it reaches the companion.
 *
 * The voice SDK opens the microphone itself with the browser's echo cancellation and noise
 * suppression switched on; those remove steady noise (fans, hum) but not other voices. While a
 * call is active we wrap navigator.mediaDevices.getUserMedia so audio-only requests get a
 * processed track: high-pass filter (rumble) -> speech gate (background voices and noise).
 *
 * It always fails open: if anything is unavailable or breaks, the raw microphone is used, so the
 * patient is never silenced by the filter. Camera requests are never touched.
 */
import { WORKLET_SOURCE } from './speech-gate';
import { getNoiseFilterMode, subscribeNoiseFilterMode } from './noise-filter-mode';

export const noiseFilterSupported = true;

type Ctx = AudioContext;
let context: Ctx | null = null;
let ready: Promise<boolean> | null = null;
let active = false;
// Live gates and their high-pass filters, so a mode change applies mid-call.
const nodes = new Map<AudioWorkletNode, BiquadFilterNode>();
let originalGetUserMedia: MediaDevices['getUserMedia'] | null = null;

const highpassHz = () => (getNoiseFilterMode() === 'off' ? 10 : 90);
subscribeNoiseFilterMode(() =>
  nodes.forEach((highpass, gate) => {
    gate.port.postMessage({ mode: getNoiseFilterMode() });
    highpass.frequency.value = highpassHz();
  }),
);

const timeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

function contextClass(): (new () => Ctx) | null {
  const g = globalThis as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Call synchronously inside the tap that starts a voice call, so the browser allows audio. */
export function primeNoiseFilter() {
  try {
    const Context = contextClass();
    if (!Context) return;
    if (!context || context.state === 'closed') {
      context = new Context();
      ready = null;
    }
    void context.resume().catch(() => {});
    if (!ready && context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      ready = context.audioWorklet.addModule(url).then(() => true, () => false).finally(() => URL.revokeObjectURL(url));
    }
  } catch {
    context = null; ready = null;
  }
}

async function processed(raw: MediaStream): Promise<MediaStream> {
  const ctx = context;
  if (!ctx || !ready || !(await timeout(ready, 1500, false))) return raw;
  if (ctx.state !== 'running') await timeout(ctx.resume().then(() => true, () => false), 500, false);
  // A suspended context would output silence: use the raw microphone instead.
  if (ctx.state !== 'running') return raw;
  const source = ctx.createMediaStreamSource(raw);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = highpassHz();
  highpass.Q.value = 0.7;
  const gate = new AudioWorkletNode(ctx, 'speech-gate', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { mode: getNoiseFilterMode() },
  });
  const destination = ctx.createMediaStreamDestination();
  source.connect(highpass).connect(gate).connect(destination);
  nodes.set(gate, highpass);
  gate.onprocessorerror = () => {
    // Fail open: bypass the gate if the audio thread reports an error.
    try { highpass.disconnect(); highpass.connect(destination); } catch { /* Nothing more to do. */ }
    nodes.delete(gate);
  };
  const track = destination.stream.getAudioTracks()[0];
  const stop = track.stop.bind(track);
  track.stop = () => {
    stop();
    raw.getTracks().forEach(t => t.stop());
    nodes.delete(gate);
    try { source.disconnect(); highpass.disconnect(); gate.disconnect(); } catch { /* Already disconnected. */ }
  };
  return new MediaStream([track]);
}

function install() {
  const devices = (globalThis as { navigator?: Navigator }).navigator?.mediaDevices;
  if (!devices || originalGetUserMedia) return;
  originalGetUserMedia = devices.getUserMedia.bind(devices);
  devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    const raw = await originalGetUserMedia!(constraints);
    // Always in the path during a call (Off is a pass-through) so the mode can change mid-call.
    if (!active || !constraints?.audio || constraints.video) return raw;
    try { return await processed(raw); } catch { return raw; }
  };
}

/** Start filtering microphone requests for this voice call. */
export async function prepareNoiseFilter() {
  primeNoiseFilter();
  install();
  active = true;
}

/** Stop filtering new microphone requests and free the audio graph after a call. */
export async function releaseNoiseFilter() {
  active = false;
  nodes.clear();
  const ctx = context;
  context = null; ready = null;
  if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => {});
}
