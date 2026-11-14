import type { ActivityDetail } from "./activity-cues";
export type NatureSoundscapeId =
  | "nordic_forest_birds"
  | "gentle_rain"
  | "nordic_stream"
  | "gamma_40hz_pink_noise";

export type SoundscapeTheme = {
  coreColor: string;
  auraColor: string;
  orbGradient: string;
  bgGradient: string;
  horizonColor: string;
};

export const NATURE_SOUNDSCAPES: Record<
  NatureSoundscapeId,
  { label: string; file: string; description: string; theme: SoundscapeTheme }
> = {
  nordic_forest_birds: {
    label: "Nordic Forest & Birds",
    file: "/audio/nordic_forest_birds.mp3",
    description:
      "Finnish pine woodland with gentle morning birdsong + 40 Hz AM",
    theme: {
      coreColor: "#34d399",
      auraColor: "rgba(52, 211, 153, 0.5)",
      orbGradient:
        "radial-gradient(circle at 35% 30%, #ffffff 0%, #a7f3d0 28%, #34d399 65%, #064e3b 100%)",
      bgGradient:
        "linear-gradient(180deg, #041510 0%, #0b2e24 48%, #04120e 100%)",
      horizonColor:
        "radial-gradient(ellipse at 50% 36%, rgba(52, 211, 153, 0.18) 0%, transparent 65%)",
    },
  },
  gentle_rain: {
    label: "Cabin Rain",
    file: "/audio/gentle_rain.mp3",
    description: "Continuous rainfall on pine needles + 40 Hz AM",
    theme: {
      coreColor: "#818cf8",
      auraColor: "rgba(129, 140, 248, 0.5)",
      orbGradient:
        "radial-gradient(circle at 35% 30%, #ffffff 0%, #c7d2fe 28%, #818cf8 65%, #1e1b4b 100%)",
      bgGradient:
        "linear-gradient(180deg, #070919 0%, #161b3a 48%, #070816 100%)",
      horizonColor:
        "radial-gradient(ellipse at 50% 36%, rgba(129, 140, 248, 0.18) 0%, transparent 65%)",
    },
  },
  nordic_stream: {
    label: "Woodland Stream",
    file: "/audio/nordic_stream.mp3",
    description: "Flowing stream over smooth stones + 40 Hz AM",
    theme: {
      coreColor: "#38bdf8",
      auraColor: "rgba(56, 189, 248, 0.5)",
      orbGradient:
        "radial-gradient(circle at 35% 30%, #ffffff 0%, #bae6fd 28%, #38bdf8 65%, #0c4a6e 100%)",
      bgGradient:
        "linear-gradient(180deg, #04131f 0%, #0c2b45 48%, #040f1a 100%)",
      horizonColor:
        "radial-gradient(ellipse at 50% 36%, rgba(56, 189, 248, 0.18) 0%, transparent 65%)",
    },
  },
  gamma_40hz_pink_noise: {
    label: "40 Hz Pink Noise",
    file: "/audio/gamma_40hz_pink_noise.wav",
    description: "1/f pink noise modulated at 40 Hz with 0.5 Hz bilateral sway",
    theme: {
      coreColor: "#e879f9",
      auraColor: "rgba(232, 121, 249, 0.5)",
      orbGradient:
        "radial-gradient(circle at 35% 30%, #ffffff 0%, #f5d0fe 28%, #e879f9 65%, #4a044e 100%)",
      bgGradient:
        "linear-gradient(180deg, #140618 0%, #2c0f38 48%, #100514 100%)",
      horizonColor:
        "radial-gradient(ellipse at 50% 36%, rgba(232, 121, 249, 0.18) 0%, transparent 65%)",
    },
  },
};

export type SoundscapeProfile = {
  id: string;
  label: string;
  frequenciesHz: number[];
  binauralBeatHz: number | null;
  modulationHz: number | null;
  ambientNoise: boolean;
  stepChimeHz: number | null;
};

/**
 * Pure descriptor of the therapeutic soundscape for a given catalog activity.
 * Safe to call in unit tests and UI components without touching audio hardware.
 */
export function describeSoundscape(
  activity: ActivityDetail | null | undefined,
): SoundscapeProfile {
  switch (activity?.kind) {
    case "nature":
      return {
        id: activity.config.asset_id ?? "soundscape-40hz-v1",
        label: "40 Hz gamma entrainment · 200/240 Hz binaural + soft rain",
        frequenciesHz: [120, 200, 240],
        binauralBeatHz: 40,
        modulationHz: 40,
        ambientNoise: true,
        stepChimeHz: null,
      };
    case "social_reconnection":
      return {
        id: activity.config.asset_id ?? "good-news-ambient-v1",
        label: "Warm F-maj7 ambient pad · Uplifting news accompaniment",
        frequenciesHz: [174.61, 220.0, 261.63, 329.63],
        binauralBeatHz: null,
        modulationHz: 0.12,
        ambientNoise: false,
        stepChimeHz: null,
      };
    case "behavioral_activation":
      return {
        id: activity.config.asset_id ?? "grounding-chime-v1",
        label: "528 Hz singing-bowl step chimes · Grounding drone",
        frequenciesHz: [144.0, 216.0],
        binauralBeatHz: null,
        modulationHz: null,
        ambientNoise: false,
        stepChimeHz: 528,
      };
    case "reflection":
      return {
        id: activity.config.asset_id ?? "reflection-pad-v1",
        label: "Quiet reflective harmonic drone",
        frequenciesHz: [216.0, 324.0],
        binauralBeatHz: null,
        modulationHz: 0.08,
        ambientNoise: false,
        stepChimeHz: null,
      };
    case "breathing":
    case undefined:
      return {
        id: activity?.config.asset_id ?? "harmonic-breath-v1",
        label: "Respiratory harmonic swell · 4s inhale / 4s exhale",
        frequenciesHz: [130.81, 196.0, 246.94, 293.66],
        binauralBeatHz: null,
        modulationHz: 0.125,
        ambientNoise: false,
        stepChimeHz: null,
      };
  }
}
