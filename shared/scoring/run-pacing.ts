import type { Grade } from '../game-types.ts';
import {
  BASE_GATE_DISTANCE,
  MIN_READING_SECONDS_BY_GRADE,
  SAFETY_MARGIN_WORLD_UNITS,
  SPEED_CONFIG,
  gateDistanceForQuestion,
  targetSpeedForScore,
} from './speed-config.ts';

/**
 * The pacing of one question: how fast the world is moving while it is on
 * screen and how long the player has before the gate arrives.
 *
 * This is shared deterministic logic. The browser uses it to place each gate,
 * and the server uses the very same function to recompute the speed bonus when
 * it verifies a run - so the window a score is judged against is exactly the
 * window the child was given.
 *
 * Pacing depends on the score so far, never on the question number, so two
 * players on the same question can legitimately be running at different speeds.
 */

export { BASE_GATE_DISTANCE, MIN_READING_SECONDS_BY_GRADE, SAFETY_MARGIN_WORLD_UNITS };

export interface QuestionPacing {
  index: number;
  /** Speed tier 0..5 the world is heading for while this question is up. */
  tier: number;
  /** World speed while this question is on screen, in units per second. */
  speed: number;
  /** Distance the gate is placed ahead of the player. */
  distance: number;
  /** Milliseconds available before the gate is reached. */
  windowMs: number;
}

/**
 * Pacing for one question, given the score the player had when it appeared.
 *
 * `currentSpeed` is only used for gate spacing during the 0.65 s ramp; leaving
 * it out plans for the target speed, which is what the verifier does.
 */
export function pacingForQuestion(
  grade: Grade,
  index: number,
  scoreBefore: number,
  currentSpeed = 0,
): QuestionPacing {
  const speed = targetSpeedForScore(scoreBefore);
  const distance = gateDistanceForQuestion(grade, currentSpeed, speed);

  return {
    index,
    tier: Math.round((speed - SPEED_CONFIG.baseSpeed) / SPEED_CONFIG.speedPerTier),
    speed,
    distance,
    windowMs: (distance / speed) * 1000,
  };
}
