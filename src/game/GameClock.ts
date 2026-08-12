import { GAME_CONFIG } from './game-config.ts';

/**
 * Frame clock for the game loop.
 *
 * Deltas are clamped so a backgrounded tab cannot resume with a multi-second
 * step that would teleport the runner straight through a gate. A time scale is
 * exposed for the debug bridge used by end-to-end tests.
 */
export class GameClock {
  private lastTimestamp: number | null = null;
  private timeScale = 1;
  private running = false;

  start(now: number): void {
    this.lastTimestamp = now;
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.lastTimestamp = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  setTimeScale(scale: number): void {
    // Keep the scale sane: zero would freeze the run, huge values would skip gates.
    this.timeScale = Math.min(8, Math.max(0.1, scale));
  }

  get scale(): number {
    return this.timeScale;
  }

  /** Seconds elapsed since the previous tick, clamped and scaled. */
  tick(now: number): number {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
      return 0;
    }
    const rawDelta = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    if (rawDelta <= 0) return 0;
    return Math.min(rawDelta, GAME_CONFIG.maxDeltaSeconds) * this.timeScale;
  }
}
