import type { Grade } from '../game-types.ts';
import { getGradeConfig } from '../content/grade-config.ts';
import { createRng } from '../math/seeded-rng.ts';

/**
 * The pacing of one run: how fast the world moves and how long the player has
 * to read each question.
 *
 * This is shared deterministic logic. The browser uses it to place the gates,
 * and the server uses it to recompute the speed bonus when it verifies a run,
 * so both sides agree on the scoring window without the client sending it.
 */

/** Distance from the player to the first gate of a run. */
export const FIRST_GATE_DISTANCE = 48;
export const GATE_DISTANCE_MIN = 45;
export const GATE_DISTANCE_MAX = 55;

/** A question must stay readable for at least this long before its gate. */
export const MIN_READING_SECONDS = 4.5;

/** Speed added to the world after each resolved question. */
export const SPEED_INCREMENT_PER_QUESTION = 0.28;

/** Keeps the pacing RNG independent of the question generator's stream. */
const PACING_SEED_MIX = 0x5bf03635;

export interface QuestionPacing {
  index: number;
  /** World speed while this question is on screen, in units per second. */
  speed: number;
  /** Distance the gate is placed ahead of the player. */
  distance: number;
  /** Milliseconds available before the gate is reached. */
  windowMs: number;
}

/**
 * Computes the pacing for every question in a run.
 *
 * Depends only on `grade`, `seed` and `count`, so the same three inputs always
 * produce the same schedule on any machine.
 */
export function computeRunPacing(grade: Grade, seed: number, count: number): QuestionPacing[] {
  const config = getGradeConfig(grade);
  const rng = createRng(seed ^ PACING_SEED_MIX);

  const pacing: QuestionPacing[] = [];
  let speed = config.baseSpeed;

  for (let index = 0; index < count; index += 1) {
    const base =
      index === 0
        ? FIRST_GATE_DISTANCE
        : GATE_DISTANCE_MIN + rng.next() * (GATE_DISTANCE_MAX - GATE_DISTANCE_MIN);

    // Stretch the spacing whenever the world speed would leave less than the
    // required reading time.
    const distance = Math.max(base, speed * MIN_READING_SECONDS);

    pacing.push({ index, speed, distance, windowMs: (distance / speed) * 1000 });

    speed = Math.min(config.maxSpeed, speed + SPEED_INCREMENT_PER_QUESTION);
  }

  return pacing;
}
