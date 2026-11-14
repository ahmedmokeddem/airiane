import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { ActivityDetail } from "./activity-cues";
import {
  NATURE_SOUNDSCAPES,
  describeSoundscape,
  type NatureSoundscapeId,
} from "./soundscapes";
import { NativePlayback, nativeTrackName } from "./native-playback";
import { prepareActivityAudio } from "./native-audio-session";
export * from "./soundscapes";
// Literal Metro requires put the actual selected recording inside the APK. No /audio browser URLs.
const tracks: Record<string, number> = {
  "nordic_forest_birds.mp3": require("../../../assets/audio/nordic_forest_birds.mp3"),
  "gentle_rain.mp3": require("../../../assets/audio/gentle_rain.mp3"),
  "nordic_stream.mp3": require("../../../assets/audio/nordic_stream.mp3"),
  "gamma_40hz_pink_noise.wav": require("../../../assets/audio/gamma_40hz_pink_noise.wav"),
  "bilateral-grounding-chimes.wav": require("../../../assets/audio/bilateral-grounding-chimes.wav"),
  "gentle-rain-stream.wav": require("../../../assets/audio/gentle-rain-stream.wav"),
};
export function useAudioTherapy(
  active: boolean,
  activity: ActivityDetail | null | undefined,
  _elapsed: number,
  options?: { inCall?: boolean },
) {
  const inCall = options?.inCall ?? false;
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundscape, setSoundscapeState] = useState<NatureSoundscapeId>(
    "nordic_forest_birds",
  );
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [playbackError, setPlaybackError] = useState("");
  const [retry, setRetry] = useState(0);
  const player = useAudioPlayer(null, {
    updateInterval: 500,
    keepAudioSessionActive: inCall,
  });
  const status = useAudioPlayerStatus(player);
  const playback = useMemo(
    () =>
      new NativePlayback(
        player,
        inCall ? async () => {} : prepareActivityAudio,
      ),
    [player, inCall],
  );
  const source = tracks[nativeTrackName(activity, soundscape)];
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (active && foreground)
      void playback.start(source).catch(() => {
        if (!cancelled)
          setPlaybackError(
            "This recording could not play. Try again or choose another sound.",
          );
      });
    else playback.stop();
    return () => {
      cancelled = true;
      playback.stop();
    };
  }, [active, foreground, source, playback, retry]);
  useEffect(() => playback.mute(soundMuted), [soundMuted, playback]);
  const setSoundscape = (value: NatureSoundscapeId) => {
    setPlaybackError("");
    setSoundscapeState(value);
  };
  const profile = describeSoundscape(activity);
  return {
    profile: {
      ...profile,
      label:
        activity?.kind === "nature"
          ? NATURE_SOUNDSCAPES[soundscape].label
          : activity?.kind === "behavioral_activation"
            ? "Recorded grounding chimes"
            : "Quiet ambient recording",
    },
    soundMuted,
    toggleSound: () => {
      setPlaybackError("");
      setSoundMuted((value) => !value);
    },
    soundscape,
    setSoundscape,
    theme: NATURE_SOUNDSCAPES[soundscape].theme,
    bilateralEnabled: false,
    toggleBilateral: () => {},
    supportsBilateral: false,
    playing: status.playing,
    loading: active && foreground && !status.isLoaded && !status.error,
    playbackError:
      playbackError ||
      (status.error
        ? "This recording could not play. Try again or choose another sound."
        : ""),
    retryPlayback: () => {
      setPlaybackError("");
      setRetry((v) => v + 1);
    },
  };
}
