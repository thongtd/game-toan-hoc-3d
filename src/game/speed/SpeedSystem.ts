import {
  SPEED_CONFIG,
  clampWorldSpeed,
  speedTierForScore,
  targetSpeedForScore,
} from '../../../shared/scoring/speed-config.ts';

export interface SpeedTierChange {
  fromTier: number;
  toTier: number;
  /** True the first time a run reaches the top tier. */
  reachedMax: boolean;
}

/**
 * Turns the score into a world speed.
 *
 * Crossing a threshold never snaps the world forward: the change is eased over
 * 0.65 s, frame-rate independently, so the track picks up smoothly under the
 * runner's feet. Speed only ever goes up inside a run, because the score does.
 */
export class SpeedSystem {
  private current: number = SPEED_CONFIG.baseSpeed;
  private target: number = SPEED_CONFIG.baseSpeed;
  private transitionStart: number = SPEED_CONFIG.baseSpeed;
  private transitionElapsed: number = SPEED_CONFIG.transitionSeconds;
  private lastTier = 0;
  private announcedMax = false;

  reset(): void {
    this.current = SPEED_CONFIG.baseSpeed;
    this.target = SPEED_CONFIG.baseSpeed;
    this.transitionStart = SPEED_CONFIG.baseSpeed;
    this.transitionElapsed = SPEED_CONFIG.transitionSeconds;
    this.lastTier = 0;
    this.announcedMax = false;
  }

  /**
   * Feeds the run's total score in. Returns the tier change when one happened,
   * so the HUD can celebrate it, or null when nothing changed.
   */
  applyScore(score: number): SpeedTierChange | null {
    const nextTier = speedTierForScore(score);
    const nextTarget = targetSpeedForScore(score);

    if (nextTarget <= this.target) return null;

    const fromTier = this.lastTier;
    this.transitionStart = this.current;
    this.transitionElapsed = 0;
    this.target = Math.min(nextTarget, SPEED_CONFIG.maxSpeed);
    this.lastTier = nextTier;

    const reachedMax = nextTier >= SPEED_CONFIG.maxTierIndex && !this.announcedMax;
    if (reachedMax) this.announcedMax = true;

    return { fromTier, toTier: nextTier, reachedMax };
  }

  /** Advances the ramp and returns the speed to move the world by this frame. */
  update(deltaSeconds: number): number {
    this.transitionElapsed = Math.min(
      this.transitionElapsed + Math.max(0, deltaSeconds),
      SPEED_CONFIG.transitionSeconds,
    );

    const t = Math.min(this.transitionElapsed / SPEED_CONFIG.transitionSeconds, 1);
    // Cubic ease-out: quick at first, settling into the new speed.
    const eased = 1 - Math.pow(1 - t, 3);
    const next = this.transitionStart + (this.target - this.transitionStart) * eased;

    this.current = clampWorldSpeed(next);
    return this.current;
  }

  getCurrent(): number {
    return clampWorldSpeed(this.current);
  }

  getTarget(): number {
    return clampWorldSpeed(this.target);
  }

  get tier(): number {
    return this.lastTier;
  }

  get isAtMaxTier(): boolean {
    return this.lastTier >= SPEED_CONFIG.maxTierIndex;
  }
}
