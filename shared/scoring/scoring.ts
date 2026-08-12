import { clamp } from '../utils/clamp.ts';

/** Points awarded for a correct answer before any bonus. */
export const BASE_CORRECT_SCORE = 100;

/** Upper bound of the "answered quickly" bonus. */
export const MAX_SPEED_BONUS = 50;

/**
 * Speed bonus for a single question.
 *
 * `decisionMs` is the time between the question appearing and the player
 * settling on their lane; `windowMs` is how long they had before reaching the
 * gate. Deciding immediately earns the full bonus, and a player who is still
 * switching lanes as the gate arrives earns none.
 *
 * The bonus is measured against the decision, not the gate crossing: the gate
 * always arrives after a fixed travel time, so timing the crossing itself
 * would give every player the same score.
 */
export function computeSpeedBonus(decisionMs: number, windowMs: number): number {
  if (windowMs <= 0) return 0;
  const ratio = clamp(decisionMs / windowMs, 0, 1);
  return Math.round(MAX_SPEED_BONUS * (1 - ratio));
}

/**
 * Streak multiplier applied to the points of the current question.
 * `streak` already includes the answer being scored.
 */
export function streakMultiplier(streak: number): number {
  if (streak >= 6) return 1.3;
  if (streak >= 4) return 1.2;
  if (streak >= 2) return 1.1;
  return 1;
}

export interface QuestionScoreInput {
  correct: boolean;
  /** Milliseconds from question shown to the player settling on a lane. */
  decisionMs: number;
  /** Milliseconds available before the gate is reached. */
  windowMs: number;
  /** Streak *after* counting the current answer. */
  streak: number;
}

/**
 * Points gained from one question. A wrong answer is worth zero - never a
 * negative value, so a run's total score can only ever go up.
 */
export function computeQuestionScore(input: QuestionScoreInput): number {
  if (!input.correct) return 0;
  const base = BASE_CORRECT_SCORE + computeSpeedBonus(input.decisionMs, input.windowMs);
  return Math.round(base * streakMultiplier(input.streak));
}

/**
 * Stars for a finished run. Everyone gets at least one star: the run was
 * completed, which is the thing being celebrated.
 */
export function computeStars(correctAnswers: number, totalQuestions: number): 1 | 2 | 3 {
  if (totalQuestions <= 0) return 1;
  const threeStarThreshold = Math.ceil((totalQuestions * 10) / 12);
  const twoStarThreshold = Math.ceil((totalQuestions * 7) / 12);
  if (correctAnswers >= threeStarThreshold) return 3;
  if (correctAnswers >= twoStarThreshold) return 2;
  return 1;
}

/** Mutable per-run score bookkeeping. */
export class ScoreTracker {
  private currentScore = 0;
  private currentStreak = 0;
  private highestStreak = 0;
  private correct = 0;

  get score(): number {
    return this.currentScore;
  }

  get streak(): number {
    return this.currentStreak;
  }

  get bestStreak(): number {
    return this.highestStreak;
  }

  get correctAnswers(): number {
    return this.correct;
  }

  /** Registers one resolved question and returns the points gained. */
  register(input: Omit<QuestionScoreInput, 'streak'>): number {
    if (!input.correct) {
      this.currentStreak = 0;
      return 0;
    }

    this.currentStreak += 1;
    this.highestStreak = Math.max(this.highestStreak, this.currentStreak);
    this.correct += 1;

    const gained = computeQuestionScore({ ...input, streak: this.currentStreak });
    this.currentScore += gained;
    return gained;
  }

  reset(): void {
    this.currentScore = 0;
    this.currentStreak = 0;
    this.highestStreak = 0;
    this.correct = 0;
  }
}
