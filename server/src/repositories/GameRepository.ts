import type { Grade } from '../../../shared/game-types.ts';
import type {
  FinishRunRecord,
  GameRunRecord,
  LeaderboardQuery,
  NewPlayerRecord,
  NewRunSessionRecord,
  PlayerRankQuery,
  PlayerRecord,
  RankedLeaderboardRow,
  UpdatePlayerRecord,
} from '../domain/records.ts';

/**
 * The one storage contract.
 *
 * Both the SQLite driver (default) and the JSON driver (demo/local) implement
 * it, and the same contract test suite runs against both, so switching drivers
 * cannot change behaviour.
 */
export interface GameRepository {
  createPlayer(input: NewPlayerRecord): Promise<PlayerRecord>;
  getPlayerById(id: string): Promise<PlayerRecord | null>;
  getPlayerByTokenHash(tokenHash: string): Promise<PlayerRecord | null>;
  updatePlayer(id: string, patch: UpdatePlayerRecord): Promise<PlayerRecord>;
  touchPlayer(id: string, seenAt: string): Promise<void>;

  createRunSession(input: NewRunSessionRecord): Promise<GameRunRecord>;
  getRunById(id: string): Promise<GameRunRecord | null>;
  countOpenRuns(playerId: string, now: string): Promise<number>;
  finishRun(input: FinishRunRecord): Promise<GameRunRecord>;

  /** Best score per grade for one player, across all time. */
  getBestScores(playerId: string): Promise<Partial<Record<Grade, number>>>;

  getLeaderboard(query: LeaderboardQuery): Promise<RankedLeaderboardRow[]>;
  getPlayerRank(query: PlayerRankQuery): Promise<RankedLeaderboardRow | null>;

  /** True when the underlying store is reachable. Never writes. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.cause = cause;
  }
}

export class PlayerNotFoundError extends RepositoryError {
  constructor(id: string) {
    super(`Player not found: ${id}`);
    this.name = 'PlayerNotFoundError';
  }
}

export class RunNotFoundError extends RepositoryError {
  constructor(id: string) {
    super(`Run not found: ${id}`);
    this.name = 'RunNotFoundError';
  }
}

/**
 * Ordering used everywhere a leaderboard is produced.
 *
 * Deterministic by construction: if every metric ties, the earlier finish and
 * then the lexicographically smaller run id decide, so two calls never disagree.
 */
export function compareLeaderboardRows(
  a: { score: number; correctAnswers: number; durationMs: number; finishedAt: string; runId: string },
  b: { score: number; correctAnswers: number; durationMs: number; finishedAt: string; runId: string },
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.correctAnswers !== b.correctAnswers) return b.correctAnswers - a.correctAnswers;
  if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
  if (a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
  if (a.runId !== b.runId) return a.runId < b.runId ? -1 : 1;
  return 0;
}
