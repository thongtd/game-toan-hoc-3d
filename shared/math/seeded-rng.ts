/**
 * Deterministic pseudo-random number generator.
 *
 * Every gameplay decision that must be reproducible (question generation,
 * decoration placement, gate spacing) goes through one of these. Tests inject a
 * fixed seed; `Math.random()` is never used for game logic.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Picks one element; throws when the list is empty. */
  pick<T>(items: readonly T[]): T;
  /** Returns a shuffled copy - the input array is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with the given probability (0..1). */
  chance(probability: number): boolean;
}

/**
 * mulberry32 - small, fast, and good enough for gameplay variety. It is not a
 * cryptographic generator and is never used for anything security related.
 */
export function createRng(seed: number): Rng {
  // Keep the state inside the 32-bit unsigned range.
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`Invalid integer range: [${min}, ${max}]`);
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      const item = items[int(0, items.length - 1)];
      if (item === undefined) throw new Error('Rng.pick produced an out-of-range index');
      return item;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        const a = copy[i];
        const b = copy[j];
        if (a === undefined || b === undefined) continue;
        copy[i] = b;
        copy[j] = a;
      }
      return copy;
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
  };
}

/** Creates a seed for a fresh run. Only used outside of testable game logic. */
export function createTimeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
