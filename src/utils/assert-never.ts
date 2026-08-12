/** Exhaustiveness helper for discriminated unions. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

/**
 * Narrows `T | undefined` to `T`.
 *
 * `noUncheckedIndexedAccess` is enabled project-wide, so indexed reads are
 * typed as possibly-undefined. This helper turns a programming mistake into a
 * loud error instead of a silent `undefined` flowing through the game loop.
 */
export function required<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing required value: ${message}`);
  }
  return value;
}
