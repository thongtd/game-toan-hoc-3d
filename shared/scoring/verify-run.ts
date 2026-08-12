import type { Grade, LaneIndex } from '../game-types.ts';
import { generateQuestions } from '../math/question-generator.ts';
import { ScoreTracker, computeStars } from './scoring.ts';
import { computeRunPacing } from './run-pacing.ts';

/**
 * Recomputes a run's result from the answers alone.
 *
 * The client never sends a score. Given the grade, the server-issued seed and
 * the lane the player chose for each question, this rebuilds the exact set of
 * questions and works out the score independently - so a tampered client can
 * change what it displays, but not what gets recorded.
 */

export const MAX_RESPONSE_MS = 120_000;

export type RunRejectionReason =
  | 'ANSWER_COUNT_MISMATCH'
  | 'DUPLICATE_QUESTION_INDEX'
  | 'QUESTION_INDEX_OUT_OF_RANGE'
  | 'SELECTED_INDEX_OUT_OF_RANGE'
  | 'RESPONSE_TIME_INVALID'
  | 'DURATION_IMPLAUSIBLE'
  | 'GENERATOR_VERSION_UNSUPPORTED';

export interface SubmittedAnswer {
  questionIndex: number;
  selectedIndex: number;
  responseMs: number;
}

export interface VerifiedAnswer {
  questionIndex: number;
  selectedIndex: LaneIndex;
  responseMs: number;
  isCorrect: boolean;
  awardedScore: number;
}

export interface VerifyRunInput {
  grade: Grade;
  seed: number;
  totalQuestions: number;
  answers: readonly SubmittedAnswer[];
  /** Milliseconds the run actually took, measured by the server. */
  serverElapsedMs: number;
  clientDurationMs: number;
}

export type VerifyRunOutcome =
  | {
      ok: true;
      score: number;
      correctAnswers: number;
      bestStreak: number;
      stars: 1 | 2 | 3;
      durationMs: number;
      answers: VerifiedAnswer[];
    }
  | { ok: false; reason: RunRejectionReason };

/** A run finishing faster than this could not have been played by a person. */
const MIN_PLAUSIBLE_RUN_MS = 5_000;

/** Allowance for clock skew between the client's stopwatch and the server's. */
const DURATION_TOLERANCE_MS = 5_000;

export function verifyRun(input: VerifyRunInput): VerifyRunOutcome {
  const { grade, seed, totalQuestions, answers } = input;

  if (answers.length !== totalQuestions) {
    return { ok: false, reason: 'ANSWER_COUNT_MISMATCH' };
  }

  const seen = new Set<number>();
  for (const answer of answers) {
    if (!Number.isInteger(answer.questionIndex)) {
      return { ok: false, reason: 'QUESTION_INDEX_OUT_OF_RANGE' };
    }
    if (answer.questionIndex < 0 || answer.questionIndex >= totalQuestions) {
      return { ok: false, reason: 'QUESTION_INDEX_OUT_OF_RANGE' };
    }
    if (seen.has(answer.questionIndex)) {
      return { ok: false, reason: 'DUPLICATE_QUESTION_INDEX' };
    }
    seen.add(answer.questionIndex);

    if (![0, 1, 2].includes(answer.selectedIndex)) {
      return { ok: false, reason: 'SELECTED_INDEX_OUT_OF_RANGE' };
    }
    if (
      typeof answer.responseMs !== 'number' ||
      !Number.isFinite(answer.responseMs) ||
      answer.responseMs < 0 ||
      answer.responseMs > MAX_RESPONSE_MS
    ) {
      return { ok: false, reason: 'RESPONSE_TIME_INVALID' };
    }
  }

  if (input.serverElapsedMs < MIN_PLAUSIBLE_RUN_MS) {
    return { ok: false, reason: 'DURATION_IMPLAUSIBLE' };
  }
  if (
    !Number.isFinite(input.clientDurationMs) ||
    input.clientDurationMs < 0 ||
    input.clientDurationMs > input.serverElapsedMs + DURATION_TOLERANCE_MS
  ) {
    return { ok: false, reason: 'DURATION_IMPLAUSIBLE' };
  }

  // Rebuild exactly what the player saw.
  const questions = generateQuestions({ grade, seed, count: totalQuestions });
  const pacing = computeRunPacing(grade, seed, totalQuestions);
  const byIndex = new Map(answers.map((answer) => [answer.questionIndex, answer]));

  const tracker = new ScoreTracker();
  const verified: VerifiedAnswer[] = [];

  for (let index = 0; index < totalQuestions; index += 1) {
    const question = questions[index];
    const answer = byIndex.get(index);
    const window = pacing[index];
    if (question === undefined || answer === undefined || window === undefined) {
      return { ok: false, reason: 'ANSWER_COUNT_MISMATCH' };
    }

    const selectedIndex = answer.selectedIndex as LaneIndex;
    const isCorrect = selectedIndex === question.correctIndex;
    const awardedScore = tracker.register({
      correct: isCorrect,
      decisionMs: answer.responseMs,
      windowMs: window.windowMs,
    });

    verified.push({
      questionIndex: index,
      selectedIndex,
      responseMs: answer.responseMs,
      isCorrect,
      awardedScore,
    });
  }

  return {
    ok: true,
    score: tracker.score,
    correctAnswers: tracker.correctAnswers,
    bestStreak: tracker.bestStreak,
    stars: computeStars(tracker.correctAnswers, totalQuestions),
    // Never trust the client's stopwatch beyond what the server observed.
    durationMs: Math.min(Math.round(input.clientDurationMs), Math.round(input.serverElapsedMs)),
    answers: verified,
  };
}
