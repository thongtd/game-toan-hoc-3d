import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
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
  StoredAnswer,
  UpdatePlayerRecord,
} from '../domain/records.ts';
import type { GameRepository } from './GameRepository.ts';
import { PlayerNotFoundError, RepositoryError, RunNotFoundError } from './GameRepository.ts';
import { runMigrations } from '../storage/migrations.ts';

interface PlayerRow {
  id: string;
  nickname: string;
  nickname_normalized: string;
  age: number;
  avatar_id: string;
  token_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

interface RunRow {
  id: string;
  player_id: string;
  grade: number;
  seed: number;
  generator_version: number;
  status: string;
  score: number | null;
  correct_answers: number | null;
  best_streak: number | null;
  duration_ms: number | null;
  answers_json: string | null;
  rejection_reason: string | null;
  started_at: string;
  expires_at: string;
  finished_at: string | null;
}

interface LeaderboardRow {
  player_id: string;
  nickname: string;
  avatar_id: string;
  score: number;
  correct_answers: number;
  duration_ms: number;
  finished_at: string;
  run_id: string;
}

/**
 * The default storage driver.
 *
 * Every statement is parameterised, the leaderboard is resolved with a window
 * function rather than by sorting in the application, and finishing a run runs
 * inside a transaction so a crash can never leave a half-recorded result.
 */
export class SqliteGameRepository implements GameRepository {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    if (filePath !== ':memory:') {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }

    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    runMigrations(this.db);
  }

  /* -------------------------------- Players ------------------------------- */

  // These methods are async so a storage failure always surfaces as a rejected
  // promise, exactly like the JSON driver, rather than a synchronous throw.
  async createPlayer(input: NewPlayerRecord): Promise<PlayerRecord> {
    try {
      this.db
        .prepare(
          `INSERT INTO players
             (id, nickname, nickname_normalized, age, avatar_id, token_hash,
              status, created_at, updated_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        )
        .run(
          input.id,
          input.nickname,
          input.nicknameNormalized,
          input.age,
          input.avatarId,
          input.tokenHash,
          input.createdAt,
          input.createdAt,
          input.createdAt,
        );
    } catch (error) {
      throw new RepositoryError('Could not create player', error);
    }
    return this.requirePlayer(input.id);
  }

  getPlayerById(id: string): Promise<PlayerRecord | null> {
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as
      | PlayerRow
      | undefined;
    return Promise.resolve(row === undefined ? null : toPlayer(row));
  }

  getPlayerByTokenHash(tokenHash: string): Promise<PlayerRecord | null> {
    const row = this.db.prepare('SELECT * FROM players WHERE token_hash = ?').get(tokenHash) as
      | PlayerRow
      | undefined;
    return Promise.resolve(row === undefined ? null : toPlayer(row));
  }

  async updatePlayer(id: string, patch: UpdatePlayerRecord): Promise<PlayerRecord> {
    const sets: string[] = [];
    const values: (string | number)[] = [];

    if (patch.nickname !== undefined) {
      sets.push('nickname = ?');
      values.push(patch.nickname);
    }
    if (patch.nicknameNormalized !== undefined) {
      sets.push('nickname_normalized = ?');
      values.push(patch.nicknameNormalized);
    }
    if (patch.age !== undefined) {
      sets.push('age = ?');
      values.push(patch.age);
    }
    if (patch.avatarId !== undefined) {
      sets.push('avatar_id = ?');
      values.push(patch.avatarId);
    }
    if (patch.status !== undefined) {
      sets.push('status = ?');
      values.push(patch.status);
    }

    sets.push('updated_at = ?');
    values.push(patch.updatedAt);
    values.push(id);

    const result = this.db.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      throw new PlayerNotFoundError(id);
    }
    return this.requirePlayer(id);
  }

  touchPlayer(id: string, seenAt: string): Promise<void> {
    this.db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').run(seenAt, id);
    return Promise.resolve();
  }

  private async requirePlayer(id: string): Promise<PlayerRecord> {
    const player = await this.getPlayerById(id);
    if (player === null) throw new PlayerNotFoundError(id);
    return player;
  }

  /* ---------------------------------- Runs -------------------------------- */

  async createRunSession(input: NewRunSessionRecord): Promise<GameRunRecord> {
    this.db
      .prepare(
        `INSERT INTO game_runs
           (id, player_id, grade, seed, generator_version, status, started_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'started', ?, ?)`,
      )
      .run(
        input.id,
        input.playerId,
        input.grade,
        input.seed,
        input.generatorVersion,
        input.startedAt,
        input.expiresAt,
      );
    return this.requireRun(input.id);
  }

  getRunById(id: string): Promise<GameRunRecord | null> {
    const row = this.db.prepare('SELECT * FROM game_runs WHERE id = ?').get(id) as
      | RunRow
      | undefined;
    return Promise.resolve(row === undefined ? null : toRun(row));
  }

  countOpenRuns(playerId: string, now: string): Promise<number> {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total FROM game_runs
          WHERE player_id = ? AND status = 'started' AND expires_at > ?`,
      )
      .get(playerId, now) as { total: number } | undefined;
    return Promise.resolve(row?.total ?? 0);
  }

  async finishRun(input: FinishRunRecord): Promise<GameRunRecord> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db
        .prepare(
          `UPDATE game_runs
              SET status = ?, score = ?, correct_answers = ?, best_streak = ?,
                  duration_ms = ?, answers_json = ?, rejection_reason = ?, finished_at = ?
            WHERE id = ? AND status = 'started'`,
        )
        .run(
          input.status,
          input.score,
          input.correctAnswers,
          input.bestStreak,
          input.durationMs,
          input.answers === null ? null : JSON.stringify(input.answers),
          input.rejectionReason,
          input.finishedAt,
          input.id,
        );

      if (result.changes === 0) {
        // Either the run does not exist or it is no longer open. Both cases are
        // handled by the caller, which re-reads the record.
        this.db.exec('ROLLBACK');
        return await this.requireRun(input.id);
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw new RepositoryError('Could not finish run', error);
    }
    return this.requireRun(input.id);
  }

  private async requireRun(id: string): Promise<GameRunRecord> {
    const run = await this.getRunById(id);
    if (run === null) throw new RunNotFoundError(id);
    return run;
  }

  getBestScores(playerId: string): Promise<Partial<Record<Grade, number>>> {
    const rows = this.db
      .prepare(
        `SELECT grade, MAX(score) AS best FROM game_runs
          WHERE player_id = ? AND status = 'finished' AND score IS NOT NULL
          GROUP BY grade`,
      )
      .all(playerId) as { grade: number; best: number }[];

    const result: Partial<Record<Grade, number>> = {};
    for (const row of rows) {
      result[row.grade as Grade] = row.best;
    }
    return Promise.resolve(result);
  }

  /* ------------------------------ Leaderboard ----------------------------- */

  private rankedRows(query: LeaderboardQuery, limit: number | null): LeaderboardRow[] {
    const periodClause =
      query.periodStart === null || query.periodEnd === null
        ? ''
        : 'AND r.finished_at >= :periodStart AND r.finished_at < :periodEnd';

    const sql = `
      WITH ranked_player_runs AS (
        SELECT
          r.player_id, r.score, r.correct_answers, r.duration_ms,
          r.finished_at, r.id AS run_id, p.nickname, p.avatar_id,
          ROW_NUMBER() OVER (
            PARTITION BY r.player_id
            ORDER BY r.score DESC, r.correct_answers DESC,
                     r.duration_ms ASC, r.finished_at ASC, r.id ASC
          ) AS player_best
        FROM game_runs r
        JOIN players p ON p.id = r.player_id
        WHERE r.status = 'finished'
          AND p.status = 'active'
          AND r.grade = :grade
          AND r.score IS NOT NULL
          ${periodClause}
      )
      SELECT player_id, nickname, avatar_id, score, correct_answers,
             duration_ms, finished_at, run_id
      FROM ranked_player_runs
      WHERE player_best = 1
      ORDER BY score DESC, correct_answers DESC, duration_ms ASC,
               finished_at ASC, run_id ASC
      ${limit === null ? '' : 'LIMIT :limit'}
    `;

    const params: Record<string, string | number> = { grade: query.grade };
    if (query.periodStart !== null && query.periodEnd !== null) {
      params.periodStart = query.periodStart;
      params.periodEnd = query.periodEnd;
    }
    if (limit !== null) {
      params.limit = limit;
    }

    return this.db.prepare(sql).all(params) as unknown as LeaderboardRow[];
  }

  getLeaderboard(query: LeaderboardQuery): Promise<RankedLeaderboardRow[]> {
    const rows = this.rankedRows(query, query.limit);
    return Promise.resolve(rows.map((row, index) => toRankedRow(row, index + 1)));
  }

  getPlayerRank(query: PlayerRankQuery): Promise<RankedLeaderboardRow | null> {
    // The rank is the player's position in the full ordering, so this walks the
    // unlimited result rather than the top-N slice.
    const rows = this.rankedRows(query, null);
    const index = rows.findIndex((row) => row.player_id === query.playerId);
    if (index < 0) return Promise.resolve(null);

    const row = rows[index];
    if (row === undefined) return Promise.resolve(null);
    return Promise.resolve(toRankedRow(row, index + 1));
  }

  /* ------------------------------- Lifecycle ------------------------------ */

  ping(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  close(): Promise<void> {
    try {
      // Fold the write-ahead log back into the database file so a copy of the
      // .db file on its own is a complete backup.
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      // Checkpointing is best effort during shutdown.
    }
    this.db.close();
    return Promise.resolve();
  }
}

function toPlayer(row: PlayerRow): PlayerRecord {
  return {
    id: row.id,
    nickname: row.nickname,
    nicknameNormalized: row.nickname_normalized,
    age: row.age,
    avatarId: row.avatar_id,
    tokenHash: row.token_hash,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function toRun(row: RunRow): GameRunRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    grade: row.grade as Grade,
    seed: row.seed,
    generatorVersion: row.generator_version,
    status: row.status as GameRunRecord['status'],
    score: row.score,
    correctAnswers: row.correct_answers,
    bestStreak: row.best_streak,
    durationMs: row.duration_ms,
    answers: row.answers_json === null ? null : (JSON.parse(row.answers_json) as StoredAnswer[]),
    rejectionReason: row.rejection_reason,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    finishedAt: row.finished_at,
  };
}

function toRankedRow(row: LeaderboardRow, rank: number): RankedLeaderboardRow {
  return {
    rank,
    playerId: row.player_id,
    nickname: row.nickname,
    avatarId: row.avatar_id,
    score: row.score,
    correctAnswers: row.correct_answers,
    durationMs: row.duration_ms,
    finishedAt: row.finished_at,
    runId: row.run_id,
  };
}
