import { useEffect, useRef, useState } from 'react';
import type { ActivityDetail } from './activity-cues';

export type NatureSoundscapeId =
  | 'nordic_forest_birds'
  | 'gentle_rain'
  | 'nordic_stream'
  | 'gamma_40hz_pink_noise';

export const NATURE_SOUNDSCAPES: Record<
  NatureSoundscapeId,
  { label: string; file: string; description: string }
> = {
  nordic_forest_birds: {
    label: 'Nordic Forest & Birds',
    file: '/audio/nordic_forest_birds.mp3',
    description: 'Finnish pine woodland with gentle morning birdsong + 40 Hz AM',
  },
  gentle_rain: {
    label: 'Cabin Rain',
    file: '/audio/gentle_rain.mp3',
    description: 'Continuous rainfall on pine needles + 40 Hz AM',
  },
  nordic_stream: {
    label: 'Woodland Stream',
    file: '/audio/nordic_stream.mp3',
    description: 'Flowing stream over smooth stones + 40 Hz AM',
  },
  gamma_40hz_pink_noise: {
    label: '40 Hz Pink Noise',
    file: '/audio/gamma_40hz_pink_noise.wav',
    description: '1/f pink noise modulated at 40 Hz with 0.5 Hz bilateral sway',
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
export function describeSoundscape(activity: ActivityDetail | null | undefined): SoundscapeProfile {
  switch (activity?.kind) {
    case 'nature':
      return {
        id: activity.config.asset_id ?? 'soundscape-40hz-v1',
        label: '40 Hz gamma entrainment · 200/240 Hz binaural + soft rain',
        frequenciesHz: [120, 200, 240],
        binauralBeatHz: 40,
        modulationHz: 40,
        ambientNoise: true,
        stepChimeHz: null,
      };
    case 'social_reconnection':
      return {
        id: activity.config.asset_id ?? 'good-news-ambient-v1',
        label: 'Warm F-maj7 ambient pad · Uplifting news accompaniment',
        frequenciesHz: [174.61, 220.0, 261.63, 329.63],
        binauralBeatHz: null,
        modulationHz: 0.12,
        ambientNoise: false,
        stepChimeHz: null,
      };
    case 'behavioral_activation':
      return {
        id: activity.config.asset_id ?? 'grounding-chime-v1',
        label: '528 Hz singing-bowl step chimes · Grounding drone',
        frequenciesHz: [144.0, 216.0],
        binauralBeatHz: null,
        modulationHz: null,
        ambientNoise: false,
        stepChimeHz: 528,
      };
    case 'reflection':
      return {
        id: activity.config.asset_id ?? 'reflection-pad-v1',
        label: 'Quiet reflective harmonic drone',
        frequenciesHz: [216.0, 324.0],
        binauralBeatHz: null,
        modulationHz: 0.08,
        ambientNoise: false,
        stepChimeHz: null,
      };
    case 'breathing':
    case undefined:
      return {
        id: activity?.config.asset_id ?? 'harmonic-breath-v1',
        label: 'Respiratory harmonic swell · 4s inhale / 4s exhale',
        frequenciesHz: [130.81, 196.0, 246.94, 293.66],
        binauralBeatHz: null,
        modulationHz: 0.125,
        ambientNoise: false,
        stepChimeHz: null,
      };
  }
}

type WebAudioContextCtor = new () => AudioContext;

function resolveAudioContextCtor(): WebAudioContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: WebAudioContextCtor;
    webkitAudioContext?: WebAudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/**
 * Web Audio API synthesizer for AIrianne's restorative soundscapes.
 * Uses pure procedural synthesis (no external MP3/WAV dependencies) and safely
 * degrades to a no-op state tracker when Web Audio is unavailable.
 */
export class AudioTherapySynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private breathFilter: BiquadFilterNode | null = null;
  private breathGain: GainNode | null = null;
  private disposers: (() => void)[] = [];
  private activeProfileId: string | null = null;
  private activeSoundscape: NatureSoundscapeId = 'nordic_forest_birds';
  private activeBilateral = true;
  private lastChimeStep: number = -1;
  private _muted = false;
  private _running = false;

  get running(): boolean {
    return this._running;
  }

  get muted(): boolean {
    return this._muted;
  }

  get profileId(): string | null {
    return this.activeProfileId;
  }

  start(
    activity: ActivityDetail | null | undefined,
    options?: { soundscape?: NatureSoundscapeId; bilateral?: boolean },
  ): SoundscapeProfile {
    const profile = describeSoundscape(activity);
    const nextSoundscape = options?.soundscape ?? this.activeSoundscape;
    const nextBilateral = options?.bilateral ?? this.activeBilateral;

    if (
      this._running &&
      this.activeProfileId === profile.id &&
      this.activeSoundscape === nextSoundscape &&
      this.activeBilateral === nextBilateral
    ) {
      return profile;
    }
    this.stop();
    this._running = true;
    this.activeProfileId = profile.id;
    this.activeSoundscape = nextSoundscape;
    this.activeBilateral = nextBilateral;
    this.lastChimeStep = -1;

    const Ctor = resolveAudioContextCtor();
    if (!Ctor) {
      return profile;
    }

    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const master = ctx.createGain();
      master.gain.setValueAtTime(this._muted ? 0.0001 : 0.18, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      if (activity?.kind === 'nature') {
        this.build40HzResonanceGraph(ctx, master, nextSoundscape, nextBilateral);
      } else if (activity?.kind === 'social_reconnection') {
        this.buildWarmPadGraph(ctx, master, profile.frequenciesHz, 420);
      } else if (activity?.kind === 'behavioral_activation') {
        this.buildWarmPadGraph(ctx, master, profile.frequenciesHz, 340);
        this.triggerChime(528);
        this.lastChimeStep = 0;
      } else {
        this.buildBreathingGraph(ctx, master, profile.frequenciesHz);
      }
    } catch {
      // Never crash the UI if browser autoplay policy blocks AudioContext creation.
    }
    return profile;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      if (!muted && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      this.masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.18, now, 0.08);
    }
  }

  /**
   * Synchronizes the running soundscape with elapsed activity seconds:
   * - Swells filter + gain on inhale / softens on exhale for breathing
   * - Rings a gentle 528 Hz singing-bowl chime on each grounding step transition
   */
  syncElapsed(activity: ActivityDetail | null | undefined, elapsed: number): void {
    if (!this._running || !this.ctx) return;
    if (this.ctx.state === 'suspended' && !this._muted) {
      void this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    if (!activity || activity.kind === 'breathing') {
      const inhale = activity?.config.inhale_seconds ?? 4;
      const exhale = activity?.config.exhale_seconds ?? 4;
      const cycle = Math.max(2, inhale + exhale);
      const breathingIn = elapsed % cycle < inhale;
      if (this.breathFilter) {
        this.breathFilter.frequency.setTargetAtTime(breathingIn ? 620 : 230, now, 0.45);
      }
      if (this.breathGain) {
        this.breathGain.gain.setTargetAtTime(breathingIn ? 0.95 : 0.42, now, 0.45);
      }
    } else if (activity.kind === 'behavioral_activation') {
      const steps = Math.max(1, activity.config.instructions?.length ?? 3);
      const duration = Math.max(1, activity.duration_seconds ?? 60);
      const stepIndex = Math.min(steps - 1, Math.floor((Math.min(elapsed, duration) / duration) * steps));
      if (stepIndex > this.lastChimeStep) {
        this.lastChimeStep = stepIndex;
        this.triggerChime(528);
      }
    }
  }

  stop(): void {
    this._running = false;
    this.activeProfileId = null;
    this.lastChimeStep = -1;
    for (const dispose of this.disposers.splice(0)) {
      try {
        dispose();
      } catch {
        // Ignore cleanup errors on already-stopped nodes.
      }
    }
    this.breathFilter = null;
    this.breathGain = null;
    this.masterGain = null;
    if (this.ctx) {
      const c = this.ctx;
      this.ctx = null;
      void c.close().catch(() => {});
    }
  }

  private build40HzResonanceGraph(
    ctx: AudioContext,
    destination: AudioNode,
    soundscapeId: NatureSoundscapeId,
    bilateral: boolean,
  ): void {
    // Route all nature/gamma layers through a 40 Hz amplitude modulator + optional 0.5 Hz bilateral panner
    const amGain = ctx.createGain();
    amGain.gain.setValueAtTime(0.85, ctx.currentTime);

    const gammaLfo = ctx.createOscillator();
    const gammaDepth = ctx.createGain();
    gammaLfo.type = 'sine';
    gammaLfo.frequency.setValueAtTime(40, ctx.currentTime);
    gammaDepth.gain.setValueAtTime(0.15, ctx.currentTime);
    gammaLfo.connect(gammaDepth);
    gammaDepth.connect(amGain.gain);
    gammaLfo.start();
    this.disposers.push(() => gammaLfo.stop());

    let outputNode: AudioNode = amGain;
    if (bilateral && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(0, ctx.currentTime);
      const panLfo = ctx.createOscillator();
      const panDepth = ctx.createGain();
      panLfo.type = 'sine';
      panLfo.frequency.setValueAtTime(0.5, ctx.currentTime);
      panDepth.gain.setValueAtTime(0.45, ctx.currentTime);
      panLfo.connect(panDepth);
      panDepth.connect(panner.pan);
      panLfo.start();
      this.disposers.push(() => panLfo.stop());
      amGain.connect(panner);
      panner.connect(destination);
    } else {
      amGain.connect(destination);
    }
    outputNode = amGain;

    // 1. Instant procedural soft filtered pink/brown rain bed (fades down if real nature MP3 loads)
    const sampleRate = ctx.sampleRate || 44100;
    const buffer = ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, ctx.currentTime);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(outputNode);
    noise.start();
    this.disposers.push(() => noise.stop());

    // 2. Asynchronously load real generated nature loop (forest birds / rain / stream / 40Hz pink noise)
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      let cancelled = false;
      this.disposers.push(() => {
        cancelled = true;
      });
      const url = NATURE_SOUNDSCAPES[soundscapeId].file;
      void fetch(url)
        .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('HTTP ' + res.status))))
        .then(buf => ctx.decodeAudioData(buf))
        .then(decoded => {
          if (cancelled || this.ctx !== ctx) return;
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          const srcGain = ctx.createGain();
          srcGain.gain.setValueAtTime(0.001, ctx.currentTime);
          srcGain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.2);
          noiseGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.2);
          src.connect(srcGain);
          srcGain.connect(outputNode);
          src.start();
          this.disposers.push(() => src.stop());
        })
        .catch(() => {
          // Keep procedural rain/gamma bed if offline or asset not served.
        });
    }
  }

  private buildBreathingGraph(ctx: AudioContext, destination: AudioNode, freqs: number[]): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, ctx.currentTime);
    const swell = ctx.createGain();
    swell.gain.setValueAtTime(0.8, ctx.currentTime);
    filter.connect(swell);
    swell.connect(destination);
    this.breathFilter = filter;
    this.breathGain = swell;

    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.18 / freqs.length, ctx.currentTime);
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.disposers.push(() => osc.stop());
    }
  }

  private buildWarmPadGraph(ctx: AudioContext, destination: AudioNode, freqs: number[], cutoffHz: number): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, ctx.currentTime);
    filter.connect(destination);

    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.22 / freqs.length, ctx.currentTime);
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.disposers.push(() => osc.stop());
    }
  }

  private triggerChime(fundamentalHz: number): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const [ratio, amp] of [
      [1, 0.16],
      [1.5, 0.08],
    ] as const) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamentalHz * ratio, now);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 3.3);
    }
  }
}

export function useAudioTherapy(active: boolean, activity: ActivityDetail | null | undefined, elapsed: number) {
  const synthRef = useRef<AudioTherapySynthesizer | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundscape, setSoundscape] = useState<NatureSoundscapeId>('nordic_forest_birds');
  const [bilateralEnabled, setBilateralEnabled] = useState(true);
  const profile = describeSoundscape(activity);

  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioTherapySynthesizer();
    }
    const synth = synthRef.current;
    if (active) {
      synth.start(activity, { soundscape, bilateral: bilateralEnabled });
      synth.setMuted(soundMuted);
    } else {
      synth.stop();
    }
    return () => {
      if (!active) synth.stop();
    };
  }, [active, activity, soundMuted, soundscape, bilateralEnabled]);

  useEffect(() => {
    synthRef.current?.setMuted(soundMuted);
  }, [soundMuted]);

  useEffect(() => {
    if (active) {
      synthRef.current?.syncElapsed(activity, elapsed);
    }
  }, [active, activity, elapsed]);

  useEffect(() => () => synthRef.current?.stop(), []);

  return {
    profile,
    soundMuted,
    toggleSound: () => setSoundMuted(m => !m),
    soundscape,
    setSoundscape,
    bilateralEnabled,
    toggleBilateral: () => setBilateralEnabled(b => !b),
  };
}
