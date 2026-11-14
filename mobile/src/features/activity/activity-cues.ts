import type { DTO } from '../../integration/types';

export type ActivityDetail = DTO<'Activity'>;
export type ActivityCue = {
  /** Catalog title, or a neutral fallback when the catalog row is not loaded. */
  title: string;
  /** Short label above the title. */
  eyebrow: string;
  /** The gentle prompt for this second of the activity. */
  cue: string;
  /** Decorative glyph for cards. */
  symbol: string;
  /** 0..1 visual pulse scale driver; 1 = expanded. */
  pulse: number;
  duration: number;
  /** Past-tense noun for the saved confirmation, e.g. "breathing pause". */
  noun: string;
};

const fallback = 'Take this at your own pace.';

/**
 * Pure mapping from a catalog activity + elapsed seconds to on-screen cues.
 * Visual prompts only: nothing here plays audio or measures the patient.
 */
export function activityCue(activity: ActivityDetail | null | undefined, elapsed: number): ActivityCue {
  const duration = activity?.duration_seconds ?? 60;
  const title = activity?.title ?? 'Your activity';
  const eyebrow = duration === 60 ? 'ONE COMFORTABLE MINUTE' : `${Math.round(duration / 60)} COMFORTABLE MINUTES`;
  const steps = activity?.config.instructions ?? [];
  const second = Math.max(0, Math.min(elapsed, duration));
  // Spread the instruction steps evenly over the duration.
  const step = steps.length ? steps[Math.min(steps.length - 1, Math.floor(second / (duration / steps.length)))] : fallback;
  switch (activity?.kind) {
    case 'nature': {
      // Slow 6-second swell as a visual companion to the listening pause.
      const phase = (second % 6) / 6;
      return { title, eyebrow, cue: step, symbol: '∿', pulse: phase < 0.5 ? phase * 2 : 2 - phase * 2, duration, noun: 'listening pause' };
    }
    case 'behavioral_activation':
      return { title, eyebrow, cue: step, symbol: '◎', pulse: 1, duration, noun: 'grounding step' };
    case 'reflection':
      return { title, eyebrow, cue: step, symbol: '✎', pulse: 1, duration, noun: 'reflection' };
    case 'social_reconnection':
      return { title, eyebrow, cue: step, symbol: '♡', pulse: 1, duration, noun: 'reconnection step' };
    case 'breathing':
    case undefined: {
      const inhale = activity?.config.inhale_seconds ?? 4;
      const exhale = activity?.config.exhale_seconds ?? 4;
      const breathingIn = second % (inhale + exhale) < inhale;
      return { title: activity ? title : 'Calm Breathing', eyebrow, cue: breathingIn ? 'Breathe in gently' : 'Breathe out slowly', symbol: '≈', pulse: breathingIn ? 1 : 0, duration, noun: 'breathing pause' };
    }
  }
}
