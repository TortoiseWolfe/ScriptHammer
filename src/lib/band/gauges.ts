/**
 * The numbers behind the two dials on each ranked song of /band (#1434).
 *
 * Pure functions only. A dial shows one value against a fixed scale; a value past
 * either end pins the needle at that end, and the dial's text says so, so the drawing
 * never claims a position the number does not have.
 */

/** The score dial runs from minus 15 to plus 15, the same span as the review player. */
export const SCORE_MIN = -15;
export const SCORE_MAX = 15;

/** The needle sweeps 270 degrees: -135 (bottom left) through 0 (straight up) to +135. */
export const SWEEP_START = -135;
export const SWEEP_SPAN = 270;

/** Plays a day, shown to one decimal. */
export const roundPerDay = (n: number): number => Math.round(n * 10) / 10;

export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Where a value falls between lo and hi, held to 0..1. */
export function fraction(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

/** Needle angle in degrees for a value on a scale. */
export function needleAngle(value: number, lo: number, hi: number): number {
  return (
    Math.round((SWEEP_START + fraction(value, lo, hi) * SWEEP_SPAN) * 10) / 10
  );
}

/** True when the value sits outside the scale and the needle is pinned. */
export const offScale = (value: number, lo: number, hi: number): boolean =>
  value < lo || value > hi;
