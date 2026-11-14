import type { ActivityDetail } from "./activity-cues";
import type { NatureSoundscapeId } from "./soundscapes";
export function nativeTrackName(
  activity: ActivityDetail | null | undefined,
  soundscape: NatureSoundscapeId,
) {
  if (activity?.kind === "nature")
    return `${soundscape}.${soundscape === "gamma_40hz_pink_noise" ? "wav" : "mp3"}`;
  if (activity?.kind === "behavioral_activation")
    return "bilateral-grounding-chimes.wav";
  return "gentle-rain-stream.wav";
}
export interface NativePlayerPort {
  replace(source: number | null): void;
  play(): void;
  pause(): void;
  loop: boolean;
  muted: boolean;
  volume: number;
}
/** Cancels stale async preparation before it can start audio after leaving/changing tracks. */
export class NativePlayback {
  private epoch = 0;
  constructor(
    private player: NativePlayerPort,
    private prepare: () => Promise<void>,
  ) {}
  async start(source: number) {
    const epoch = ++this.epoch;
    this.player.pause();
    await this.prepare();
    if (epoch !== this.epoch) return;
    this.player.replace(source);
    this.player.loop = true;
    this.player.volume = 0.5;
    this.player.play();
  }
  mute(muted: boolean) {
    this.player.muted = muted;
  }
  stop() {
    ++this.epoch;
    this.player.pause();
    this.player.replace(null);
  }
}
