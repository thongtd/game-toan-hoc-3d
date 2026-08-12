import type { Grade } from '../game-types.ts';

/**
 * The single source of truth for how fast the world moves.
 *
 * Speed follows the score, not the question number: a child who is answering
 * well feels the track pick up, and a child who is finding it hard keeps a calm
 * pace all the way to the finish. Nothing else - not the map, not the grade,
 * not the frame rate - may change it.
 */

export interface SpeedConfig {
  baseSpeed: number;
  pointsPerTier: number;
  speedPerTier: number;
  maxTierIndex: number;
  maxSpeed: number;
  transitionSeconds: number;
}

export const SPEED_CONFIG: Readonly<SpeedConfig> = Object.freeze({
  /** World speed at the start of every run, in units per second. */
  baseSpeed: 7.5,
  /** Points needed to climb one tier. */
  pointsPerTier: 300,
  /** Speed added per tier. */
  speedPerTier: 0.75,
  /** Tier indices run 0..5, which is the six notches shown on the HUD. */
  maxTierIndex: 5,
  /** Absolute ceiling. No code path may produce a higher speed. */
  maxSpeed: 11.25,
  /** How long the world takes to ease up to a new tier. */
  transitionSeconds: 0.65,
});

/** Notches drawn on the speed meter. */
export const SPEED_TIER_COUNT = SPEED_CONFIG.maxTierIndex + 1;

export function speedTierForScore(score: number): number {
  const safeScore = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  return Math.min(Math.floor(safeScore / SPEED_CONFIG.pointsPerTier), SPEED_CONFIG.maxTierIndex);
}

export function targetSpeedForScore(score: number): number {
  const tier = speedTierForScore(score);
  const calculated = SPEED_CONFIG.baseSpeed + tier * SPEED_CONFIG.speedPerTier;
  return Math.min(calculated, SPEED_CONFIG.maxSpeed);
}

/** Clamps any speed into the legal range. Used as a last line of defence. */
export function clampWorldSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return SPEED_CONFIG.baseSpeed;
  return Math.min(Math.max(speed, SPEED_CONFIG.baseSpeed), SPEED_CONFIG.maxSpeed);
}

/**
 * Reading time per grade block.
 *
 * Younger children read more slowly, so their gates are placed further away
 * rather than their world being made slower - every grade shares one speed
 * curve, which is what keeps the leaderboards comparable.
 */
export const MIN_READING_SECONDS_BY_GRADE: Readonly<Record<Grade, number>> = {
  1: 5.5,
  2: 5.0,
  3: 4.5,
  4: 4.5,
  5: 4.5,
};

/** Shortest gate spacing, used when the world is slow enough not to need more. */
export const BASE_GATE_DISTANCE = 48;

/** Extra room so a gate never arrives exactly as the reading window closes. */
export const SAFETY_MARGIN_WORLD_UNITS = 6;

/**
 * How far ahead of the player the next gate is placed.
 *
 * Planning uses the higher of the current and target speed, so a gate placed
 * during a tier change is spaced for the speed the world is heading towards,
 * never for the slower speed it happens to have this frame.
 */
export function gateDistanceForQuestion(
  grade: Grade,
  currentSpeed: number,
  targetSpeed: number,
): number {
  const planningSpeed = Math.min(
    Math.max(safeSpeed(currentSpeed), safeSpeed(targetSpeed)),
    SPEED_CONFIG.maxSpeed,
  );

  return Math.max(
    BASE_GATE_DISTANCE,
    planningSpeed * MIN_READING_SECONDS_BY_GRADE[grade] + SAFETY_MARGIN_WORLD_UNITS,
  );
}

function safeSpeed(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : SPEED_CONFIG.baseSpeed;
}
