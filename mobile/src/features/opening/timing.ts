/** Milliseconds after the painted native-splash handoff, never an API/auth deadline. */
export const openingTiming = {
  light: 180, firstStart: 250, firstDuration: 600,
  secondStart: 850, secondDuration: 750, endpoint: 1600,
  settle: 1650, wordmark: 1800, fade: 2200, duration: 2500,
  slowStartup: 2000, readyDeadline: 4500,
} as const;
export function shouldAnimateOpening(reducedMotion: boolean, startupMs: number) {
  return !reducedMotion && startupMs < openingTiming.slowStartup;
}
/** One JS runtime/cold launch. Navigation and foregrounding never reset this lease. */
export const openingSession = { completed: false };
