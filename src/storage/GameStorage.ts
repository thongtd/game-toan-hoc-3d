import type { Grade } from '../../shared/game-types.ts';
import { isGrade } from '../../shared/game-types.ts';

export const STORAGE_KEY = 'math-runner-3d:v1';

export interface StoredGameDataV1 {
  version: 1;
  tutorialSeen: boolean;
  muted: boolean;
  selectedGrade: Grade;
  bestScoreByGrade: Partial<Record<Grade, number>>;
}

export const DEFAULT_DATA: StoredGameDataV1 = {
  version: 1,
  tutorialSeen: false,
  muted: false,
  selectedGrade: 1,
  bestScoreByGrade: {},
};

/** The small subset of the Storage API the game relies on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads untrusted JSON into a known-good shape.
 *
 * Anything unexpected - corrupt JSON, a future version, a hand-edited value -
 * falls back to the default rather than throwing, because losing a best score
 * must never stop a child from playing.
 */
export function parseStoredData(raw: string | null): StoredGameDataV1 {
  if (raw === null || raw.trim().length === 0) return { ...DEFAULT_DATA, bestScoreByGrade: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_DATA, bestScoreByGrade: {} };
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    return { ...DEFAULT_DATA, bestScoreByGrade: {} };
  }

  const bestScoreByGrade: Partial<Record<Grade, number>> = {};
  const rawScores = parsed.bestScoreByGrade;
  if (isRecord(rawScores)) {
    for (const [key, value] of Object.entries(rawScores)) {
      const grade = Number.parseInt(key, 10);
      if (!isGrade(grade)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
      bestScoreByGrade[grade] = Math.floor(value);
    }
  }

  const selectedGrade = parsed.selectedGrade;

  return {
    version: 1,
    tutorialSeen: parsed.tutorialSeen === true,
    muted: parsed.muted === true,
    selectedGrade: isGrade(selectedGrade) ? selectedGrade : DEFAULT_DATA.selectedGrade,
    bestScoreByGrade,
  };
}

/**
 * Persistent player preferences and personal bests.
 *
 * Nothing identifying is ever stored: no name, age, school or contact details.
 */
export class GameStorage {
  private data: StoredGameDataV1;

  constructor(private readonly storage: StorageLike | null) {
    this.data = parseStoredData(this.readRaw());
  }

  /** Builds a storage bound to `localStorage`, or a no-op if unavailable. */
  static fromWindow(): GameStorage {
    try {
      const probe = '__math_runner_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return new GameStorage(window.localStorage);
    } catch {
      // Private browsing or a blocked origin - play without persistence.
      return new GameStorage(null);
    }
  }

  private readRaw(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Quota or permissions - preferences simply do not survive the session.
    }
  }

  snapshot(): StoredGameDataV1 {
    return { ...this.data, bestScoreByGrade: { ...this.data.bestScoreByGrade } };
  }

  get tutorialSeen(): boolean {
    return this.data.tutorialSeen;
  }

  markTutorialSeen(): void {
    this.data = { ...this.data, tutorialSeen: true };
    this.persist();
  }

  get muted(): boolean {
    return this.data.muted;
  }

  setMuted(muted: boolean): void {
    this.data = { ...this.data, muted };
    this.persist();
  }

  get selectedGrade(): Grade {
    return this.data.selectedGrade;
  }

  setSelectedGrade(grade: Grade): void {
    this.data = { ...this.data, selectedGrade: grade };
    this.persist();
  }

  bestScore(grade: Grade): number {
    return this.data.bestScoreByGrade[grade] ?? 0;
  }

  /**
   * Records a run's score. Returns true when it beat the previous best.
   * Best scores never move downwards.
   */
  submitScore(grade: Grade, score: number): boolean {
    if (!Number.isFinite(score) || score < 0) return false;
    const rounded = Math.floor(score);
    const previous = this.bestScore(grade);
    if (rounded <= previous) return false;

    this.data = {
      ...this.data,
      bestScoreByGrade: { ...this.data.bestScoreByGrade, [grade]: rounded },
    };
    this.persist();
    return true;
  }

  reset(): void {
    this.data = { ...DEFAULT_DATA, bestScoreByGrade: {} };
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Ignore - nothing else to do.
    }
  }
}
