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
