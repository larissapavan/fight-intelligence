/**
 * How the model's probabilities are put on screen.
 *
 * The model is overconfident: on recent fights the picks it rated 90% or more were right about 71% of the time. So a
 * probability past 90% is shown as "90%+" (and its mirror as "<10%") instead of a number that looks exact.
 */
const CAP = 0.9
const EPSILON = 1e-9 // 1 - 0.9 is 0.09999999999999998 in floating point

/** "63%", or "90%+" / "<10%" at the extremes. */
export function formatProbability(value: number): string {
  if (value >= CAP - EPSILON) return '90%+'
  if (value <= 1 - CAP + EPSILON) return '<10%'
  return `${Math.round(value * 100)}%`
}

/** How big the favorite's edge is, in words. `favorite` is the favorite's probability (0.5 to 1). */
export function edgeLabel(favorite: number): string {
  if (favorite < 0.55) return 'Toss-up'
  if (favorite < 0.65) return 'Slight edge'
  if (favorite < 0.8) return 'Clear edge'
  return 'Strong edge'
}
