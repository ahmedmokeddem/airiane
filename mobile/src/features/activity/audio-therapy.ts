import { useEffect, useRef, useState } from 'react';
import type { ActivityDetail } from './activity-cues';
import audioManifest from '../../../assets/audio/manifest.json';

export type NatureSoundscapeId =
  | 'nordic_forest_birds'
  | 'gentle_rain'
  | 'nordic_stream'
  | 'gamma_40hz_pink_noise';

export type SoundscapeTheme = {
  coreColor: string;
  auraColor: string;
  orbGradient: string;
  bgGradient: string;
  horizonColor: string;
};

export const NATURE_SOUNDSCAPES: Record<
  NatureSoundscapeId,
  {
    label: string;
    /** Web only: served from `mobile/public/audio/` at the site root. */
    file: string;
    /** Native only: file name inside `mobile/assets/audio/` (same bytes as `file`). */
    asset: string;
    description: string;
    theme: SoundscapeTheme;
  }
> = {
  nordic_forest_birds: {
    label: 'Nordic Forest & Birds',
    file: '/audio/nordic_forest_birds.mp3',
    asset: 'nordic_forest_birds.mp3',
    description: 'Finnish pine woodland with gentle morning birdsong + 40 Hz AM',
    theme: {
      coreColor: '#34d399',
      auraColor: 'rgba(52, 211, 153, 0.5)',
      orbGradient:
        'radial-gradient(circle at 35% 30%, #ffffff 0%, #a7f3d0 28%, #34d399 65%, #064e3b 100%)',
      bgGradient: 'linear-gradient(180deg, #041510 0%, #0b2e24 48%, #04120e 100%)',
      horizonColor:
        'radial-gradient(ellipse at 50% 36%, rgba(52, 211, 153, 0.18) 0%, transparent 65%)',
    },
  },
  gentle_rain: {
    label: 'Cabin Rain',
    file: '/audio/gentle_rain.mp3',
    asset: 'gentle_rain.mp3',
    description: 'Continuous rainfall on pine needles + 40 Hz AM',
    theme: {
      coreColor: '#818cf8',
      auraColor: 'rgba(129, 140, 248, 0.5)',
      orbGradient:
        'radial-gradient(circle at 35% 30%, #ffffff 0%, #c7d2fe 28%, #818cf8 65%, #1e1b4b 100%)',
      bgGradient: 'linear-gradient(180deg, #070919 0%, #161b3a 48%, #070816 100%)',
      horizonColor:
        'radial-gradient(ellipse at 50% 36%, rgba(129, 140, 248, 0.18) 0%, transparent 65%)',
    },
  },
  nordic_stream: {
    label: 'Woodland Stream',
    file: '/audio/nordic_stream.mp3',
    asset: 'nordic_stream.mp3',
    description: 'Flowing stream over smooth stones + 40 Hz AM',
    theme: {
      coreColor: '#38bdf8',
      auraColor: 'rgba(56, 189, 248, 0.5)',
      orbGradient:
        'radial-gradient(circle at 35% 30%, #ffffff 0%, #bae6fd 28%, #38bdf8 65%, #0c4a6e 100%)',
      bgGradient: 'linear-gradient(180deg, #04131f 0%, #0c2b45 48%, #040f1a 100%)',
      horizonColor:
        'radial-gradient(ellipse at 50% 36%, rgba(56, 189, 248, 0.18) 0%, transparent 65%)',
    },
  },
  gamma_40hz_pink_noise: {
    label: '40 Hz Pink Noise',
    file: '/audio/gamma_40hz_pink_noise.wav',
    asset: 'gamma_40hz_pink_noise.wav',
    description: '1/f pink noise modulated at 40 Hz with 0.5 Hz bilateral sway',
    theme: {
      coreColor: '#e879f9',
      auraColor: 'rgba(232, 121, 249, 0.5)',
      orbGradient:
        'radial-gradient(circle at 35% 30%, #ffffff 0%, #f5d0fe 28%, #e879f9 65%, #4a044e 100%)',
      bgGradient: 'linear-gradient(180deg, #140618 0%, #2c0f38 48%, #100514 100%)',
      horizonColor:
        'radial-gradient(ellipse at 50% 36%, rgba(232, 121, 249, 0.18) 0%, transparent 65%)',
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

export type PlatformKind = 'web' | 'native';

/** Minimal slice of expo-audio's AudioPlayer that this engine uses. */
export type NativeAudioPlayerHandle = {
  loop: boolean;
  muted: boolean;
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
};

export type NativeAudioBackend = {
  createPlayer(source: number | string | { uri: string }): NativeAudioPlayerHandle;
  /** Called at most once per process, before the first player is created. */
  configureAudioMode?(): void;
};

export type AudioTherapyOptions = {
  /** Defaults to runtime detection. Tests pass this explicitly. */
  platform?: PlatformKind;
  /** Defaults to a lazily-required expo-audio backend. */
  nativeBackend?: NativeAudioBackend | null;
  /** File name -> Metro asset id. Defaults to ./native-audio-assets. */
  nativeAssets?: Record<string, number> | null;
  /** When false, never calls setAudioModeAsync (call screen: LiveKit owns the session). */
  configureAudioMode?: boolean;
};

/** Volume for the bundled native loop (expo-audio range 0.0-1.0). */
const NATIVE_SOUNDSCAPE_VOLUME = 0.85;

/**
 * expo-audio gives every player a 500 ms `playbackStatusUpdate` loop by default
 * (node_modules/expo-audio/build/ExpoAudio.js createAudioPlayer): iOS adds an
 * AVPlayer periodic time observer on the main queue and Android runs a
 * Dispatchers.Main coroutine, each building a 17-field status object and emitting
 * it into JS twice a second. This engine never subscribes to it, so stretch the
 * interval to one minute instead of paying for it for a whole activity.
 * Never 0: Android would `delay(0)` in a tight loop and iOS rejects a zero CMTime.
 */
const NATIVE_STATUS_INTERVAL_MS = 60_000;

/**
 * Bundled ambient bed for asset_ids that assets/audio/manifest.json does not
 * list (`harmonic-breath-v1`, `reflection-pad-v1`, a null/unknown backend id).
 * Without this, breathing and reflection activities would stay silent on native.
 */
const NATIVE_FALLBACK_FILE = 'gentle-rain-stream.wav';

/**
 * react-native-web always runs in a browser (document + AudioContext exist);
 * the native Hermes runtime has neither, and so does the plain-Node test runner.
 * Deliberately avoids importing `Platform` from 'react-native': that module is
 * imported by mobile/tests/wellbeing.test.ts in plain Node.
 * See findings/MOBILE_AUDIO.md.
 */
function detectPlatform(): PlatformKind {
  return typeof document !== 'undefined' && resolveAudioContextCtor() ? 'web' : 'native';
}

let cachedBackend: NativeAudioBackend | null | undefined;

function defaultNativeBackend(): NativeAudioBackend | null {
  if (cachedBackend !== undefined) return cachedBackend;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-audio') as {
      createAudioPlayer: (
        source: unknown,
        options?: { updateInterval?: number },
      ) => NativeAudioPlayerHandle;
      setAudioModeAsync: (mode: Record<string, unknown>) => Promise<void>;
    };
    cachedBackend = {
      createPlayer: source =>
        mod.createAudioPlayer(source, {
          updateInterval: NATIVE_STATUS_INTERVAL_MS,
        }),
      configureAudioMode: () => {
        // playsInSilentMode: audible even with the iOS ringer switch on silent.
        // mixWithOthers: never yank the session from another audio producer.
        void mod.setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        }).catch(() => {});
      },
    };
  } catch {
    cachedBackend = null; // not a Metro/native runtime (unit tests, node scripts)
  }
  return cachedBackend;
}

let cachedAssets: Record<string, number> | null | undefined;

function defaultNativeAssets(): Record<string, number> | null {
  if (cachedAssets !== undefined) return cachedAssets;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedAssets = (require('./native-audio-assets') as {
      NATIVE_AUDIO_ASSETS: Record<string, number>;
    }).NATIVE_AUDIO_ASSETS;
  } catch {
    cachedAssets = null;
  }
  return cachedAssets;
}

/**
 * File name inside `mobile/assets/audio/` for the soundscape that should loop.
 * Nature activities follow the on-screen soundscape switcher so the chips work;
 * every other kind resolves its `asset_id` through assets/audio/manifest.json.
 */
export function resolveNativeSoundscapeFile(
  activity: ActivityDetail | null | undefined,
  profileId: string,
  soundscape: NatureSoundscapeId,
): string {
  if (activity?.kind === 'nature') return NATURE_SOUNDSCAPES[soundscape].asset;
  const track = audioManifest.tracks.find(t => t.id === profileId);
  return track?.file ?? NATIVE_FALLBACK_FILE;
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
  private readonly platform: PlatformKind;
  private readonly backendOverride: NativeAudioBackend | null | undefined;
  private readonly assetsOverride: Record<string, number> | null | undefined;
  private readonly configureAudioMode: boolean;
  private nativePlayer: NativeAudioPlayerHandle | null = null;
  private activeNativeFile: string | null = null;
  private audioModeConfigured = false;

  constructor(options?: AudioTherapyOptions) {
    this.platform = options?.platform ?? detectPlatform();
    this.backendOverride = options?.nativeBackend;
    this.assetsOverride = options?.nativeAssets;
    this.configureAudioMode = options?.configureAudioMode ?? true;
  }

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

    if (this.platform !== 'web') {
      const nextFile = resolveNativeSoundscapeFile(activity, profile.id, nextSoundscape);
      // start() re-runs whenever the hook's start effect re-runs (activity
      // identity, soundscape, mute or bilateral) - never per elapsed tick, which
      // only drives syncElapsed(). Only restart when the looping file changes.
      // `bilateral` has no native equivalent (it is baked into the bundled mix),
      // so toggling it must not restart the loop.
      if (
        this._running &&
        this.activeProfileId === profile.id &&
        this.activeNativeFile === nextFile &&
        this.nativePlayer
      ) {
        this.activeSoundscape = nextSoundscape;
        this.activeBilateral = nextBilateral;
        return profile;
      }
      this.stop();
      this._running = true;
      this.activeProfileId = profile.id;
      this.activeSoundscape = nextSoundscape;
      this.activeBilateral = nextBilateral;
      this.lastChimeStep = -1;
      this.startNativeSoundscape(nextFile);
      return profile;
    }

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
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          const unlock = () => {
            if (this.ctx && this.ctx.state === 'suspended') {
              void this.ctx.resume().catch(() => {});
            }
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
          };
          window.addEventListener('pointerdown', unlock, { once: true });
          window.addEventListener('keydown', unlock, { once: true });
          this.disposers.push(() => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
          });
        }
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

  private startNativeSoundscape(file: string): void {
    const backend = this.backendOverride ?? defaultNativeBackend();
    const assets = this.assetsOverride ?? defaultNativeAssets();
    if (!backend || !assets) return; // expo-audio unavailable: stay silent, never throw
    const source = assets[file];
    if (source === undefined) return; // asset not bundled
    try {
      if (this.configureAudioMode && !this.audioModeConfigured) {
        this.audioModeConfigured = true;
        backend.configureAudioMode?.();
      }
      const player = backend.createPlayer(source);
      player.loop = true;                               // set before play()
      player.volume = this._muted ? 0 : NATIVE_SOUNDSCAPE_VOLUME;
      player.muted = this._muted;
      // Muted means paused, not "playing into a zero gain": a silent player
      // would still decode and emit status for the whole activity.
      if (!this._muted) player.play();
      this.nativePlayer = player;
      this.activeNativeFile = file;
      this.disposers.push(() => {
        player.pause();
        player.remove();                                // frees the native player
        this.nativePlayer = null;
        this.activeNativeFile = null;
      });
    } catch {
      // Never crash the activity UI because audio could not start.
    }
  }

  setMuted(muted: boolean): void {
    const changed = muted !== this._muted;
    this._muted = muted;
    // Every expo-audio property write is a blocking hop onto the native main
    // thread (android AudioModule.kt wraps each Property in runOnMain), so only
    // write when the value actually changed. New players already get the current
    // mute state applied in startNativeSoundscape().
    if (this.nativePlayer && changed) {
      try {
        this.nativePlayer.muted = muted;
        this.nativePlayer.volume = muted ? 0 : NATIVE_SOUNDSCAPE_VOLUME;
        if (muted) this.nativePlayer.pause();
        else this.nativePlayer.play();
      } catch {
        // Player already released.
      }
    }
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
    // Native: the bundled loop needs no per-second driving, and the
    // grounding-chime file already contains the 528 Hz chimes, so there is
    // nothing to schedule. `this.ctx` is null on native, so this returns.
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
    this.nativePlayer = null;
    this.activeNativeFile = null;
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

    // 1b. Subtle 120 Hz harmonic carrier modulated at 40 Hz (audible on laptop/phone speakers)
    const carrier = ctx.createOscillator();
    const carrierGain = ctx.createGain();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(120, ctx.currentTime);
    carrierGain.gain.setValueAtTime(0.08, ctx.currentTime);
    carrier.connect(carrierGain);
    carrierGain.connect(outputNode);
    carrier.start();
    this.disposers.push(() => carrier.stop());

    // 2. Web only: swap in the real nature loop served from `mobile/public/audio/`.
    //    Native plays the byte-identical file from `mobile/assets/audio/` through
    //    expo-audio instead (see startNativeSoundscape / findings/MOBILE_AUDIO.md).
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
          srcGain.gain.linearRampToValueAtTime(0.95, ctx.currentTime + 1.0);
          noiseGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.0);
          carrierGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.0);
          src.connect(srcGain);
          srcGain.connect(outputNode);
          src.start();
          this.disposers.push(() => src.stop());
        })
        .catch(() => {
          // Fallback: plain HTML5 <audio> loop if decodeAudioData fails
          if (cancelled || typeof Audio === 'undefined') return;
          try {
            const el = new Audio(url);
            el.loop = true;
            el.volume = this._muted ? 0 : 0.7;
            void el.play().catch(() => {});
            this.disposers.push(() => {
              el.pause();
              el.src = '';
            });
          } catch {
            // Keep procedural rain/gamma bed if offline or asset not served.
          }
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

export function useAudioTherapy(
  active: boolean,
  activity: ActivityDetail | null | undefined,
  elapsed: number,
  options?: { configureAudioMode?: boolean },
) {
  // Read into a boolean: `options` is an inline literal at the call sites and
  // would change identity on every render if used in a dependency array.
  const configureAudioMode = options?.configureAudioMode ?? true;
  const synthRef = useRef<AudioTherapySynthesizer | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundscape, setSoundscape] = useState<NatureSoundscapeId>('nordic_forest_birds');
  const [bilateralEnabled, setBilateralEnabled] = useState(true);
  const profile = describeSoundscape(activity);

  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new AudioTherapySynthesizer({ configureAudioMode });
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
  }, [active, activity, soundMuted, soundscape, bilateralEnabled, configureAudioMode]);

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
    theme: NATURE_SOUNDSCAPES[soundscape].theme,
    bilateralEnabled,
    toggleBilateral: () => setBilateralEnabled(b => !b),
  };
}
