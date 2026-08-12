/** Clamps `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Linear interpolation between `a` and `b`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential damping.
 *
 * `smoothing` is the fraction of the remaining distance still left after one
 * second, so smaller values converge faster.
 */
export function damp(current: number, target: number, smoothing: number, delta: number): number {
  return lerp(target, current, Math.pow(smoothing, delta));
}
