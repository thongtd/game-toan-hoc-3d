/**
 * In-memory fixed-window rate limiting.
 *
 * Sized for a single-instance deployment, which is the same constraint the
 * storage drivers already carry. Keys are derived per bucket - an IP for public
 * endpoints, a player id for authenticated ones - and never logged.
 */

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed inside one window. */
  max: number;
}

export const RATE_LIMITS = {
  createPlayer: { windowMs: 60 * 60 * 1000, max: 10 },
  updatePlayer: { windowMs: 60 * 1000, max: 12 },
  startRun: { windowMs: 60 * 1000, max: 20 },
  finishRun: { windowMs: 60 * 1000, max: 30 },
  leaderboard: { windowMs: 60 * 1000, max: 120 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

interface Counter {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Counter>();
  private readonly enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /** Returns true when the request is allowed. */
  check(name: RateLimitName, key: string, now: number = Date.now()): boolean {
    if (!this.enabled) return true;

    const rule = RATE_LIMITS[name];
    const bucketKey = `${name}:${key}`;
    const existing = this.buckets.get(bucketKey);

    if (existing === undefined || now >= existing.resetAt) {
      this.buckets.set(bucketKey, { count: 1, resetAt: now + rule.windowMs });
      return true;
    }

    existing.count += 1;
    return existing.count <= rule.max;
  }

  /** Drops expired buckets so the map cannot grow without bound. */
  sweep(now: number = Date.now()): void {
    for (const [key, counter] of this.buckets) {
      if (now >= counter.resetAt) this.buckets.delete(key);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}
