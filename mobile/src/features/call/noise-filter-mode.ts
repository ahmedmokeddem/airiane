import { useSyncExternalStore } from 'react';
import type { NoiseFilterMode } from './speech-gate';

export type { NoiseFilterMode } from './speech-gate';
export const NOISE_FILTER_MODES: { mode: NoiseFilterMode; label: string; detail: string }[] = [
  { mode: 'off', label: 'Off', detail: 'No extra filtering. Your device’s own noise reduction still applies.' },
  { mode: 'standard', label: 'Standard', detail: 'Turns down sound clearly quieter than your voice.' },
  { mode: 'strong', label: 'Strong', detail: 'For busy rooms. Keep the phone close when you speak.' },
];

const KEY = 're.noiseFilterMode';
const listeners = new Set<() => void>();
function read(): NoiseFilterMode {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (saved === 'off' || saved === 'standard' || saved === 'strong') return saved;
  } catch { /* Storage can be unavailable; fall back to the default. */ }
  return 'standard';
}
let current: NoiseFilterMode = read();

export const getNoiseFilterMode = () => current;
export function setNoiseFilterMode(mode: NoiseFilterMode) {
  current = mode;
  try { globalThis.localStorage?.setItem(KEY, mode); } catch { /* Not persisted; still applies now. */ }
  listeners.forEach(listener => listener());
}
export function subscribeNoiseFilterMode(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const useNoiseFilterMode = () => useSyncExternalStore(subscribeNoiseFilterMode, getNoiseFilterMode, getNoiseFilterMode);
