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
import type { GameRepository } from './GameRepository.ts';
import { PlayerNotFoundError, RepositoryError, RunNotFoundError, compareLeaderboardRows } from './GameRepository.ts';
import { JsonStore } from '../storage/json-store.ts';

/**
 * Fallback storage driver for demos and local development.
 *
 * Behaviour matches the SQLite driver exactly - the same contract test suite
 * runs against both. It is deliberately single-process: the whole dataset lives
 * in memory and every write is queued and flushed atomically.
 */
export class JsonGameRepository implements GameRepository {
  private readonly store: JsonStore;

  constructor(filePath: string) {
    this.store = new JsonStore(filePath);
  }

  /* -------------------------------- Players ------------------------------- */

  async createPlayer(input: NewPlayerRecord): Promise<PlayerRecord> {
    return this.store.write((data) => {
      if (data.players.some((player) => player.id === input.id)) {
        throw new RepositoryError(`Player already exists: ${input.id}`);
      }
      if (data.players.some((player) => player.tokenHash === input.tokenHash)) {
        throw new RepositoryError('Token hash collision');
      }

      const player: PlayerRecord = {
        id: input.id,
        nickname: input.nickname,
        nicknameNormalized: input.nicknameNormalized,
        age: input.age,
        avatarId: input.avatarId,
        tokenHash: input.tokenHash,
        status: 'active',
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        lastSeenAt: input.createdAt,
      };
      data.players.push(player);
      return { ...player };
    });
  }

  getPlayerById(id: string): Promise<PlayerRecord | null> {
    const player = this.store.read().players.find((entry) => entry.id === id);
    return Promise.resolve(player === undefined ? null : { ...player });
  }

  getPlayerByTokenHash(tokenHash: string): Promise<PlayerRecord | null> {
    const player = this.store.read().players.find((entry) => entry.tokenHash === tokenHash);
    return Promise.resolve(player === undefined ? null : { ...player });
  }

  async updatePlayer(id: string, patch: UpdatePlayerRecord): Promise<PlayerRecord> {
    return this.store.write((data) => {
      const player = data.players.find((entry) => entry.id === id);
      if (player === undefined) throw new PlayerNotFoundError(id);

      if (patch.nickname !== undefined) player.nickname = patch.nickname;
      if (patch.nicknameNormalized !== undefined) {
        player.nicknameNormalized = patch.nicknameNormalized;
      }
      if (patch.age !== undefined) player.age = patch.age;
      if (patch.avatarId !== undefined) player.avatarId = patch.avatarId;
      if (patch.status !== undefined) player.status = patch.status;
      player.updatedAt = patch.updatedAt;

      return { ...player };
    });
  }

  async touchPlayer(id: string, seenAt: string): Promise<void> {
    await this.store.write((data) => {
      const player = data.players.find((entry) => entry.id === id);
      if (player !== undefined) player.lastSeenAt = seenAt;
    });
  }

  /* ---------------------------------- Runs -------------------------------- */

  async createRunSession(input: NewRunSessionRecord): Promise<GameRunRecord> {
    return this.store.write((data) => {
      const run: GameRunRecord = {
        id: input.id,
        playerId: input.playerId,
        grade: input.grade,
        seed: input.seed,
        generatorVersion: input.generatorVersion,
        status: 'started',
        score: null,
        correctAnswers: null,
        bestStreak: null,
        durationMs: null,
        answers: null,
        rejectionReason: null,
        startedAt: input.startedAt,
        expiresAt: input.expiresAt,
        finishedAt: null,
      };
      data.runs.push(run);
      return { ...run };
    });
  }

  getRunById(id: string): Promise<GameRunRecord | null> {
    const run = this.store.read().runs.find((entry) => entry.id === id);
    return Promise.resolve(run === undefined ? null : { ...run });
  }

  countOpenRuns(playerId: string, now: string): Promise<number> {
    const total = this.store
      .read()
      .runs.filter(
        (run) => run.playerId === playerId && run.status === 'started' && run.expiresAt > now,
      ).length;
    return Promise.resolve(total);
  }

  async finishRun(input: FinishRunRecord): Promise<GameRunRecord> {
    return this.store.write((data) => {
      const run = data.runs.find((entry) => entry.id === input.id);
      if (run === undefined) throw new RunNotFoundError(input.id);

      // Already settled: return it unchanged so finishing is idempotent.
      if (run.status !== 'started') return { ...run };

      run.status = input.status;
      run.score = input.score;
      run.correctAnswers = input.correctAnswers;
      run.bestStreak = input.bestStreak;
      run.durationMs = input.durationMs;
      run.answers = input.answers;
      run.rejectionReason = input.rejectionReason;
      run.finishedAt = input.finishedAt;

      return { ...run };
    });
  }

  getBestScores(playerId: string): Promise<Partial<Record<Grade, number>>> {
    const result: Partial<Record<Grade, number>> = {};
    for (const run of this.store.read().runs) {
      if (run.playerId !== playerId || run.status !== 'finished' || run.score === null) continue;
      const previous = result[run.grade] ?? -1;
      if (run.score > previous) result[run.grade] = run.score;
    }
    return Promise.resolve(result);
  }

  /* ------------------------------ Leaderboard ----------------------------- */

  private rankedRows(query: LeaderboardQuery): RankedLeaderboardRow[] {
    const data = this.store.read();
    const activePlayers = new Map(
      data.players.filter((player) => player.status === 'active').map((p) => [p.id, p]),
    );

    const candidates = data.runs.filter((run) => {
      if (run.status !== 'finished' || run.score === null) return false;
      if (run.grade !== query.grade) return false;
      if (!activePlayers.has(run.playerId)) return false;
      if (query.periodStart === null || query.periodEnd === null) return true;
      const finishedAt = run.finishedAt ?? '';
      return finishedAt >= query.periodStart && finishedAt < query.periodEnd;
    });

    // Best run per player, using the shared ordering so the choice matches SQL.
    const bestByPlayer = new Map<string, RankedLeaderboardRow>();
    for (const run of candidates) {
      const player = activePlayers.get(run.playerId);
      if (player === undefined) continue;

      const row: RankedLeaderboardRow = {
        rank: 0,
        playerId: run.playerId,
        nickname: player.nickname,
        avatarId: player.avatarId,
        score: run.score ?? 0,
        correctAnswers: run.correctAnswers ?? 0,
        durationMs: run.durationMs ?? 0,
        finishedAt: run.finishedAt ?? '',
        runId: run.id,
      };

      const current = bestByPlayer.get(run.playerId);
      if (current === undefined || compareLeaderboardRows(row, current) < 0) {
        bestByPlayer.set(run.playerId, row);
      }
    }

    return [...bestByPlayer.values()]
      .sort(compareLeaderboardRows)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  getLeaderboard(query: LeaderboardQuery): Promise<RankedLeaderboardRow[]> {
    return Promise.resolve(this.rankedRows(query).slice(0, query.limit));
  }

  getPlayerRank(query: PlayerRankQuery): Promise<RankedLeaderboardRow | null> {
    const row = this.rankedRows(query).find((entry) => entry.playerId === query.playerId);
    return Promise.resolve(row ?? null);
  }

  /* ------------------------------- Lifecycle ------------------------------ */

  ping(): Promise<boolean> {
    return Promise.resolve(!this.store.isClosed);
  }

  async close(): Promise<void> {
    await this.store.close();
  }
}
