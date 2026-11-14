import { setAudioModeAsync } from "expo-audio";
/**
 * Call BEFORE LiveKit starts, or for a standalone activity only. Expo's Android
 * setAudioModeAsync also changes AudioManager mode/routes, even for mixWithOthers.
 * Never invoke this during an established voice call; LiveKit owns that session.
 */
export async function prepareActivityAudio() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    allowsRecording: false,
    shouldPlayInBackground: false,
  });
}
