import { AudioSession } from "@livekit/react-native";
import { PermissionsAndroid, Platform } from "react-native";
export async function requestVoicePermissions() {
  if (Platform.OS !== "android") return; // iOS microphone prompt is owned by SDK audio capture.
  const mic = (await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ))
    ? PermissionsAndroid.RESULTS.GRANTED
    : await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
  if (mic !== PermissionsAndroid.RESULTS.GRANTED)
    throw new Error(
      "Microphone access is needed to talk. You can still use text chat.",
    );
  // Nearby devices grants routing access; denial does not block a handset call.
  if (
    Number(Platform.Version) >= 31 &&
    !(await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ))
  )
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
}
export const audioOutputs = () => AudioSession.getAudioOutputs();
export const selectOutput = (id: string) => AudioSession.selectAudioOutput(id);
// SDK normally stops its session on detach; also cover startup failure and cancellation.
export const releaseAudio = () => AudioSession.stopAudioSession();
