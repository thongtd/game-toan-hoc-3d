/**
 * Number formatting for Vietnamese primary-school maths.
 *
 * Every answer is stored as a *string* so the displayed form is the source of
 * truth: `2,5` uses a decimal comma and `3/4` stays an exact fraction. Nothing
 * in the game compares floating point values to decide correctness.
 */

/** Formats a plain integer, e.g. `1234` -> `"1234"`. */
export function formatInteger(value: number): string {
  if (!Number.isInteger(value)) {
    throw new Error(`formatInteger expects an integer, received ${value}`);
  }
  return String(value);
}

/**
 * Formats a value counted in tenths using the Vietnamese decimal comma.
 *
 * Decimal arithmetic is done on integer tenths and only formatted at the end,
 * so `0.1 + 0.2` style float drift can never reach the player.
 *
 * `25` -> `"2,5"`, `30` -> `"3,0"`, `-5` -> `"-0,5"`.
 */
export function formatTenths(tenths: number): string {
  if (!Number.isInteger(tenths)) {
    throw new Error(`formatTenths expects an integer count of tenths, received ${tenths}`);
  }
  const sign = tenths < 0 ? '-' : '';
  const absolute = Math.abs(tenths);
  const whole = Math.floor(absolute / 10);
  const fraction = absolute % 10;
  return `${sign}${String(whole)},${String(fraction)}`;
}

/** Formats a fraction as `numerator/denominator` without reducing it. */
export function formatFraction(numerator: number, denominator: number): string {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error(`formatFraction expects integers, received ${numerator}/${denominator}`);
  }
  if (denominator === 0) {
    throw new Error('formatFraction received a zero denominator');
  }
  return `${String(numerator)}/${String(denominator)}`;
}

/** Formats a score with a thin separator for thousands, e.g. `1.250`. */
export function formatScore(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
