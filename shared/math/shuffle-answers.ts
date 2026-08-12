import type { LaneIndex } from '../game-types.ts';
import { isLaneIndex } from '../game-types.ts';
import type { Rng } from './seeded-rng.ts';

export interface PlacedAnswers {
  answers: [string, string, string];
  correctIndex: LaneIndex;
}

/**
 * Places the correct answer among two distractors.
 *
 * `forbiddenIndex` prevents the correct answer from landing on the same lane
 * three questions in a row, which would let a player win by never moving.
 */
export function placeAnswers(
  correct: string,
  distractors: readonly [string, string],
  rng: Rng,
  forbiddenIndex: LaneIndex | null = null,
): PlacedAnswers {
  const unique = new Set([correct, ...distractors]);
  if (unique.size !== 3) {
    throw new Error(`Answers must be distinct after formatting: ${[...unique].join(', ')}`);
  }

  const candidates: LaneIndex[] = [0, 1, 2];
  const allowed =
    forbiddenIndex === null ? candidates : candidates.filter((i) => i !== forbiddenIndex);

  const correctIndex = rng.pick(allowed);
  if (!isLaneIndex(correctIndex)) {
    throw new Error('placeAnswers produced an invalid lane index');
  }

  const remaining = rng.shuffle(distractors);
  const answers: [string, string, string] = ['', '', ''];
  answers[correctIndex] = correct;

  let cursor = 0;
  for (let i = 0; i < 3; i += 1) {
    if (i === correctIndex) continue;
    const distractor = remaining[cursor];
    if (distractor === undefined) {
      throw new Error('Not enough distractors supplied');
    }
    answers[i] = distractor;
    cursor += 1;
  }

  return { answers, correctIndex };
}

/**
 * Tracks which lane held the correct answer recently so the generator can keep
 * the run from becoming predictable.
 */
export class CorrectLaneHistory {
  private readonly recent: LaneIndex[] = [];
  private readonly maxRepeat: number;

  constructor(maxRepeat = 2) {
    this.maxRepeat = maxRepeat;
  }

  /** Lane that must be avoided for the next question, if any. */
  forbiddenIndex(): LaneIndex | null {
    if (this.recent.length < this.maxRepeat) return null;
    const tail = this.recent.slice(-this.maxRepeat);
    const first = tail[0];
    if (first === undefined) return null;
    return tail.every((lane) => lane === first) ? first : null;
  }

  record(lane: LaneIndex): void {
    this.recent.push(lane);
    if (this.recent.length > this.maxRepeat) {
      this.recent.shift();
    }
  }
}
