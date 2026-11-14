// Web preview uses the browser's audio device controls. Native implementation is separate.
export async function requestVoicePermissions() {}
export async function audioOutputs(): Promise<string[]> {
  return [];
}
export async function selectOutput(_id: string) {}
export async function releaseAudio() {}
