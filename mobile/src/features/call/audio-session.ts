// Web preview uses the browser's audio device controls. Native implementation is separate.
import { prepareNoiseFilter, releaseNoiseFilter } from './noise-filter';
// Browsers (notably iOS Safari) expose the microphone only to secure pages: HTTPS or localhost.
// Fail before any provider credential is requested, with a reason the patient can act on.
export const insecureVoiceMessage = 'Voice calls need a secure (HTTPS) page in this browser. Open the app over HTTPS or on this computer, or choose “I’d rather type”.';
export function voiceUnavailableReason(): string | null {
  const g = globalThis as { isSecureContext?: boolean; navigator?: { mediaDevices?: { getUserMedia?: unknown } } };
  return g.isSecureContext === false || typeof g.navigator?.mediaDevices?.getUserMedia !== 'function' ? insecureVoiceMessage : null;
}
export async function requestVoicePermissions() {
  const reason = voiceUnavailableReason();
  if (reason) throw new Error(reason);
  // Turn down background voices and noise on this call's microphone (fails open).
  await prepareNoiseFilter();
}
export async function audioOutputs():Promise<string[]> { return []; }
export async function selectOutput(_id:string) {}
export async function releaseAudio() { await releaseNoiseFilter(); }
