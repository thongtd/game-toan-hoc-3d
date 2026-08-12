import type { Grade, LaneIndex } from '../../../shared/game-types.ts';
import type { LeaderboardPeriod } from '../../../shared/contracts/api.ts';

/** Storage-level shapes. These mirror the database columns, not the API. */

export type PlayerStatus = 'active' | 'disabled';

export interface PlayerRecord {
  id: string;
  nickname: string;
  nicknameNormalized: string;
  age: number;
  avatarId: string;
  tokenHash: string;
  status: PlayerStatus;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface NewPlayerRecord {
  id: string;
  nickname: string;
  nicknameNormalized: string;
  age: number;
  avatarId: string;
  tokenHash: string;
  createdAt: string;
}

export interface UpdatePlayerRecord {
  nickname?: string;
  nicknameNormalized?: string;
  age?: number;
  avatarId?: string;
  status?: PlayerStatus;
  updatedAt: string;
}

export type RunStatus = 'started' | 'finished' | 'expired' | 'rejected';

export interface StoredAnswer {
  questionIndex: number;
  selectedIndex: LaneIndex;
  responseMs: number;
  isCorrect: boolean;
  awardedScore: number;
}

export interface GameRunRecord {
  id: string;
  playerId: string;
  grade: Grade;
  seed: number;
  generatorVersion: number;
  status: RunStatus;
  score: number | null;
  correctAnswers: number | null;
  bestStreak: number | null;
  durationMs: number | null;
  answers: StoredAnswer[] | null;
  rejectionReason: string | null;
  startedAt: string;
  expiresAt: string;
  finishedAt: string | null;
}

export interface NewRunSessionRecord {
  id: string;
  playerId: string;
  grade: Grade;
  seed: number;
  generatorVersion: number;
  startedAt: string;
  expiresAt: string;
}

export interface FinishRunRecord {
  id: string;
  status: Extract<RunStatus, 'finished' | 'rejected'>;
  score: number | null;
  correctAnswers: number | null;
  bestStreak: number | null;
  durationMs: number | null;
  answers: StoredAnswer[] | null;
  rejectionReason: string | null;
  finishedAt: string;
}

export interface LeaderboardQuery {
  grade: Grade;
  period: LeaderboardPeriod;
  limit: number;
  /** Inclusive start of the period; null for all-time. */
  periodStart: string | null;
  /** Exclusive end of the period; null for all-time. */
  periodEnd: string | null;
}

export interface PlayerRankQuery extends LeaderboardQuery {
  playerId: string;
}

/** A player's best run inside one grade/period, plus their display fields. */
export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  avatarId: string;
  score: number;
  correctAnswers: number;
  durationMs: number;
  finishedAt: string;
  runId: string;
}

export interface RankedLeaderboardRow extends LeaderboardRow {
  rank: number;
}
