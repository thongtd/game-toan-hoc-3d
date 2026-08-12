import { GAME_CONFIG } from '../game-config.ts';

/**
 * Timing for the post-answer moment.
 *
 * A wrong answer eases the world down briefly instead of stopping the run:
 * nobody is knocked out of the game for one mistake.
 */
export class FeedbackSystem {
  private feedbackRemainingMs = 0;
  private slowdownRemainingMs = 0;
  private onComplete: (() => void) | null = null;

  get isShowing(): boolean {
    return this.feedbackRemainingMs > 0;
  }

  /** Multiplier applied to the world speed this frame. */
  get speedMultiplier(): number {
    return this.slowdownRemainingMs > 0 ? GAME_CONFIG.wrongAnswerSlowdownFactor : 1;
  }

  begin(correct: boolean, onComplete: () => void): void {
    this.feedbackRemainingMs = GAME_CONFIG.feedbackMs;
    this.slowdownRemainingMs = correct ? 0 : GAME_CONFIG.wrongAnswerSlowdownMs;
    this.onComplete = onComplete;
  }

  update(delta: number): void {
    const deltaMs = delta * 1000;

    if (this.slowdownRemainingMs > 0) {
      this.slowdownRemainingMs = Math.max(0, this.slowdownRemainingMs - deltaMs);
    }

    if (this.feedbackRemainingMs <= 0) return;

    this.feedbackRemainingMs -= deltaMs;
    if (this.feedbackRemainingMs > 0) return;

    this.feedbackRemainingMs = 0;
    const callback = this.onComplete;
    this.onComplete = null;
    callback?.();
  }

  reset(): void {
    this.feedbackRemainingMs = 0;
    this.slowdownRemainingMs = 0;
    this.onComplete = null;
  }
}
