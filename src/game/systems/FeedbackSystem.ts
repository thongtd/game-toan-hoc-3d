import { GAME_CONFIG } from '../game-config.ts';

/**
 * Timing for the post-answer moment.
 *
 * A wrong answer never changes the speed of the world: the run keeps its pace
 * and the mistake is answered with colour, sound and particles instead. Only
 * the score moves the world, and the score never goes down.
 */
export class FeedbackSystem {
  private feedbackRemainingMs = 0;
  private onComplete: (() => void) | null = null;

  get isShowing(): boolean {
    return this.feedbackRemainingMs > 0;
  }

  begin(_correct: boolean, onComplete: () => void): void {
    this.feedbackRemainingMs = GAME_CONFIG.feedbackMs;
    this.onComplete = onComplete;
  }

  update(delta: number): void {
    if (this.feedbackRemainingMs <= 0) return;

    this.feedbackRemainingMs -= delta * 1000;
    if (this.feedbackRemainingMs > 0) return;

    this.feedbackRemainingMs = 0;
    const callback = this.onComplete;
    this.onComplete = null;
    callback?.();
  }

  reset(): void {
    this.feedbackRemainingMs = 0;
    this.onComplete = null;
  }
}
