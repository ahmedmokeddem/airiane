import type { DTO } from '../../integration/types';

export type Observation = DTO<'Observation'>;
export type Kind = Observation['kind'];
export const fields: { kind: Kind; label: string; hint: string; max: number; step: number; unit: string; initial: number }[] = [
  { kind: 'mood', label: 'Mood', hint: '0 = very low · 10 = very good', max: 10, step: 1, unit: '/10', initial: 5 },
  { kind: 'energy', label: 'Energy', hint: '0 = no energy · 10 = full of energy', max: 10, step: 1, unit: '/10', initial: 5 },
  { kind: 'sleep_hours', label: 'Sleep last night', hint: 'Your best estimate, in hours', max: 24, step: 0.5, unit: ' h', initial: 7 },
];

/** Whole steps only, inside the scale. Half-hour sleep and whole-number scales satisfy the API's 0.01 precision rule. */
export function stepValue(value: number, direction: 1 | -1, max: number, step: number): number {
  return Math.min(max, Math.max(0, Math.round((value + direction * step) / step) * step));
}

/** Most recent confirmed value per kind that was observed on the given local day. */
export function confirmedOn(observations: Observation[], day: Date): Partial<Record<Kind, Observation>> {
  const result: Partial<Record<Kind, Observation>> = {};
  for (const o of observations) {
    if (o.state !== 'confirmed' || new Date(o.observed_at).toDateString() !== day.toDateString()) continue;
    const current = result[o.kind];
    if (!current || current.observed_at < o.observed_at) result[o.kind] = o;
  }
  return result;
}

export const pending = (observations: Observation[]) => observations.filter(o => o.state === 'proposed');
export const format = (kind: Kind, value: number) => `${value}${fields.find(f => f.kind === kind)!.unit}`;

const WORDS: Record<string, number> = { zero: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/**
 * Read a typed or transcribed answer ("about seven", "6/10", "7 and a half hours") as a value on
 * the question's scale. Returns null when no number is clear, so the companion asks again instead
 * of guessing. The result is always re-shown to the patient for confirmation before it counts.
 */
export function parseAnswer(kind: Kind, text: string): number | null {
  const field = fields.find(f => f.kind === kind)!;
  const lower = text.toLowerCase();
  const digits = lower.match(/\d+(?:[.,]\d+)?/);
  const word = Object.keys(WORDS).find(w => lower.split(/[^a-z]+/).includes(w));
  let value = digits ? Number(digits[0].replace(',', '.')) : word !== undefined ? WORDS[word] : NaN;
  if (Number.isNaN(value)) return null;
  if (kind === 'sleep_hours' && !/[.,]\d/.test(digits?.[0] ?? '') && /\bhalf\b/.test(lower)) value += 0.5;
  if (value < 0 || value > field.max) return null;
  return Math.round(value / field.step) * field.step;
}

/** Check-in questions still unanswered today, in asking order. */
export const missingToday = (observations: Observation[], day: Date): Kind[] => {
  const done = confirmedOn(observations, day);
  return fields.map(f => f.kind).filter(kind => !done[kind]);
};

export const QUESTIONS: Record<Kind, string> = {
  mood: 'How is your mood today, from zero to ten? There is no right answer.',
  energy: 'And how is your energy right now, from zero to ten?',
  sleep_hours: 'Roughly how many hours did you sleep last night?',
};
