import type { Grade, LaneIndex } from '../game-types.ts';
import type { MapId } from '../maps/map-manifest.ts';
import type { NicknameErrorCode } from '../validation/nickname.ts';
import type { AgeErrorCode, AvatarErrorCode } from '../validation/profile.ts';

/**
 * The wire contract between the web client and the server.
 *
 * Both sides import these types, so a change to a payload cannot compile on
 * one side and silently break the other.
 */

export const API_BASE_PATH = '/api/v1';

/**
 * Version of the deterministic question pipeline.
 *
 * The server stores this with every run and refuses to verify a run generated
 * by a version it no longer supports. Bump it whenever the generator, the
 * answer shuffle or the scoring formula changes in a way that alters output.
 */
export const GENERATOR_VERSION = 1;

export const QUESTIONS_PER_RUN = 12;

/** How long a started run may stay open before it can no longer be finished. */
export const RUN_TTL_MS = 10 * 60 * 1000;

export type LeaderboardPeriod = 'weekly' | 'all_time';

export type ApiErrorCode =
  | NicknameErrorCode
  | AgeErrorCode
  | AvatarErrorCode
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RUN_EXPIRED'
  | 'RUN_ALREADY_FINISHED'
  | 'RUN_REJECTED'
  | 'MAP_NOT_AVAILABLE'
  | 'TOO_MANY_REQUESTS'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'STORAGE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    /** Which input caused the problem, when it maps to one. */
    field?: string;
  };
}

/* --------------------------------- Avatars -------------------------------- */

export interface AvatarDto {
  id: string;
  category: string;
  displayName: string;
  imageUrl: string;
}

export interface AvatarsResponse {
  items: AvatarDto[];
  version: number;
}

/* --------------------------------- Players -------------------------------- */

export interface PlayerDto {
  id: string;
  nickname: string;
  age: number;
  avatarId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlayerRequest {
  nickname: string;
  age: number;
  avatarId: string;
}

export interface CreatePlayerResponse {
  player: PlayerDto;
  /** Returned exactly once, at creation. The server only stores its hash. */
  playerToken: string;
}

export interface UpdatePlayerRequest {
  nickname?: string;
  age?: number;
  avatarId?: string;
}

/** Which maps this player has been playing, for the smart-random pick. */
export interface PlayerMapStatsDto {
  /** Most recent first, at most ten entries. */
  recentMapIds: MapId[];
  totalPlays: Partial<Record<MapId, number>>;
  lastPlayedMapId: MapId | null;
}

export interface PlayerMeResponse {
  player: PlayerDto;
  /** Best verified score per grade, keyed by grade number. */
  bestScores: Partial<Record<Grade, number>>;
  /** Counted from finished runs only. */
  mapStats: PlayerMapStatsDto;
}

/* ----------------------------------- Runs --------------------------------- */

export interface StartRunRequest {
  grade: Grade;
  mapId: MapId;
}

export interface StartRunResponse {
  runId: string;
  grade: Grade;
  /** The map the server bound to this run; the client must use this one. */
  mapId: MapId;
  mapManifestVersion: number;
  seed: number;
  generatorVersion: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
}

export interface RunAnswerInput {
  questionIndex: number;
  selectedIndex: LaneIndex;
  responseMs: number;
}

export interface FinishRunRequest {
  clientDurationMs: number;
  answers: RunAnswerInput[];
}

export interface VerifiedRunResult {
  runId: string;
  grade: Grade;
  /** Taken from the stored run, never from the finish payload. */
  mapId: MapId;
  score: number;
  correctAnswers: number;
  bestStreak: number;
  stars: 1 | 2 | 3;
  durationMs: number;
  isNewBest: boolean;
  /** Rank in the weekly board for this grade, when the run made the board. */
  rank: number | null;
}

export interface FinishRunResponse {
  result: VerifiedRunResult;
}

/* ------------------------------- Leaderboard ------------------------------ */

export interface LeaderboardEntryDto {
  rank: number;
  nickname: string;
  avatarId: string;
  score: number;
}

export interface LeaderboardResponse {
  grade: Grade;
  period: LeaderboardPeriod;
  periodStart: string | null;
  periodEnd: string | null;
  entries: LeaderboardEntryDto[];
  /** Present when the caller is authenticated and has a ranked run. */
  currentPlayerEntry: LeaderboardEntryDto | null;
  generatedAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  storage: 'ok' | 'unavailable';
  uptimeSeconds: number;
}
