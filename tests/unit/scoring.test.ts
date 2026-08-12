import { describe, expect, it } from 'vitest';
import {
  BASE_CORRECT_SCORE,
  MAX_SPEED_BONUS,
  ScoreTracker,
  computeQuestionScore,
  computeSpeedBonus,
  computeStars,
  streakMultiplier,
} from '../../shared/scoring/scoring.ts';

const WINDOW = 6000;

describe('computeSpeedBonus', () => {
  it('awards the full bonus for an instant decision', () => {
    expect(computeSpeedBonus(0, WINDOW)).toBe(MAX_SPEED_BONUS);
  });

  it('awards nothing when the decision takes the whole window', () => {
    expect(computeSpeedBonus(WINDOW, WINDOW)).toBe(0);
  });

  it('decreases linearly', () => {
    expect(computeSpeedBonus(WINDOW / 2, WINDOW)).toBe(25);
    expect(computeSpeedBonus(WINDOW / 4, WINDOW)).toBe(38);
  });

  it('stays within 0..50 for any input', () => {
    const inputs = [-5000, -1, 0, 1, 500, WINDOW, WINDOW * 3, Number.MAX_SAFE_INTEGER];
    for (const decision of inputs) {
      const bonus = computeSpeedBonus(decision, WINDOW);
      expect(bonus).toBeGreaterThanOrEqual(0);
      expect(bonus).toBeLessThanOrEqual(MAX_SPEED_BONUS);
    }
  });

  it('returns zero for a non-positive window', () => {
    expect(computeSpeedBonus(100, 0)).toBe(0);
    expect(computeSpeedBonus(100, -1)).toBe(0);
  });
});

describe('streakMultiplier', () => {
  it('matches the specified thresholds', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBeCloseTo(1.1);
    expect(streakMultiplier(3)).toBeCloseTo(1.1);
    expect(streakMultiplier(4)).toBeCloseTo(1.2);
    expect(streakMultiplier(5)).toBeCloseTo(1.2);
    expect(streakMultiplier(6)).toBeCloseTo(1.3);
    expect(streakMultiplier(12)).toBeCloseTo(1.3);
  });
});

describe('computeQuestionScore', () => {
  it('gives the base score for a slow but correct first answer', () => {
    expect(
      computeQuestionScore({ correct: true, decisionMs: WINDOW, windowMs: WINDOW, streak: 1 }),
    ).toBe(BASE_CORRECT_SCORE);
  });

  it('adds the speed bonus before the streak multiplier', () => {
    // (100 + 50) * 1.3 = 195
    expect(
      computeQuestionScore({ correct: true, decisionMs: 0, windowMs: WINDOW, streak: 6 }),
    ).toBe(195);
  });

  it('always returns an integer', () => {
    for (let decision = 0; decision <= WINDOW; decision += 137) {
      for (const streak of [1, 2, 4, 6]) {
        const score = computeQuestionScore({
          correct: true,
          decisionMs: decision,
          windowMs: WINDOW,
          streak,
        });
        expect(Number.isInteger(score)).toBe(true);
      }
    }
  });

  it('gives zero - never a negative - for a wrong answer', () => {
    expect(
      computeQuestionScore({ correct: false, decisionMs: 0, windowMs: WINDOW, streak: 9 }),
    ).toBe(0);
  });
});

describe('computeStars', () => {
  it('matches the 6/7/9/10/12 boundaries for a 12-question run', () => {
    expect(computeStars(0, 12)).toBe(1);
    expect(computeStars(6, 12)).toBe(1);
    expect(computeStars(7, 12)).toBe(2);
    expect(computeStars(9, 12)).toBe(2);
    expect(computeStars(10, 12)).toBe(3);
    expect(computeStars(12, 12)).toBe(3);
  });

  it('always awards at least one star', () => {
    for (let correct = 0; correct <= 12; correct += 1) {
      expect(computeStars(correct, 12)).toBeGreaterThanOrEqual(1);
    }
    expect(computeStars(0, 0)).toBe(1);
  });
});

describe('ScoreTracker', () => {
  const fast = { correct: true, decisionMs: 0, windowMs: WINDOW };
  const wrong = { correct: false, decisionMs: 0, windowMs: WINDOW };

  it('accumulates score and streak across correct answers', () => {
    const tracker = new ScoreTracker();
    tracker.register(fast); // streak 1 -> 150
    tracker.register(fast); // streak 2 -> 165
    expect(tracker.streak).toBe(2);
    expect(tracker.correctAnswers).toBe(2);
    expect(tracker.score).toBe(315);
  });

  it('resets the streak on a wrong answer without reducing the score', () => {
    const tracker = new ScoreTracker();
    tracker.register(fast);
    tracker.register(fast);
    const beforeMistake = tracker.score;

    const gained = tracker.register(wrong);

    expect(gained).toBe(0);
    expect(tracker.streak).toBe(0);
    expect(tracker.score).toBe(beforeMistake);
    expect(tracker.correctAnswers).toBe(2);
  });

  it('remembers the highest streak reached', () => {
    const tracker = new ScoreTracker();
    tracker.register(fast);
    tracker.register(fast);
    tracker.register(fast);
    tracker.register(wrong);
    tracker.register(fast);

    expect(tracker.streak).toBe(1);
    expect(tracker.bestStreak).toBe(3);
  });

  it('never lets the total score decrease', () => {
    const tracker = new ScoreTracker();
    let previous = 0;
    for (const correct of [true, false, true, true, false, false, true]) {
      tracker.register({ correct, decisionMs: 1200, windowMs: WINDOW });
      expect(tracker.score).toBeGreaterThanOrEqual(previous);
      previous = tracker.score;
    }
  });

  it('clears everything on reset', () => {
    const tracker = new ScoreTracker();
    tracker.register(fast);
    tracker.reset();
    expect(tracker.score).toBe(0);
    expect(tracker.streak).toBe(0);
    expect(tracker.bestStreak).toBe(0);
    expect(tracker.correctAnswers).toBe(0);
  });
});
