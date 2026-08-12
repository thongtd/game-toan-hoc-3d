/** Shared domain types. Deliberately free of any Three.js or DOM dependency. */

export type Grade = 1 | 2 | 3 | 4 | 5;

export type Topic =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'comparison'
  | 'missing-number'
  | 'decimal'
  | 'fraction';

export type LaneIndex = 0 | 1 | 2;

export interface Question {
  id: string;
  grade: Grade;
  topic: Topic;
  prompt: string;
  answers: [string, string, string];
  correctIndex: LaneIndex;
  explanation: string;
}

export interface RunResult {
  grade: Grade;
  seed: number;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  bestStreak: number;
  stars: 1 | 2 | 3;
  isNewBest: boolean;
  durationMs: number;
}

/** Outcome of a single resolved question. */
export interface AnswerOutcome {
  question: Question;
  questionIndex: number;
  selectedIndex: LaneIndex;
  correct: boolean;
  gainedScore: number;
  streak: number;
}

export const ALL_GRADES: readonly Grade[] = [1, 2, 3, 4, 5];

export function isGrade(value: unknown): value is Grade {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isLaneIndex(value: unknown): value is LaneIndex {
  return value === 0 || value === 1 || value === 2;
}
