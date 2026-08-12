import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameRepository } from '../src/repositories/GameRepository.ts';
import { SqliteGameRepository } from '../src/repositories/SqliteGameRepository.ts';
import { JsonGameRepository } from '../src/repositories/JsonGameRepository.ts';
import { JsonStore, JsonStoreCorruptError } from '../src/storage/json-store.ts';
import { currentSchemaVersion, LATEST_SCHEMA_VERSION } from '../src/storage/migrations.ts';
import type { NewPlayerRecord, StoredAnswer } from '../src/domain/records.ts';
import type { Grade } from '../../shared/game-types.ts';

/**
 * One suite, both drivers.
 *
 * Anything that behaves differently between SQLite and JSON shows up here,
 * which is the whole point of having a single repository contract.
 */

interface Driver {
  name: string;
  create(): { repository: GameRepository; cleanup: () => void };
}

const DRIVERS: Driver[] = [
  {
    name: 'SqliteGameRepository',
    create() {
      const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-sqlite-'));
      const file = path.join(dir, 'test.db');
      return {
        repository: new SqliteGameRepository(file),
        cleanup: () => {
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  },
  {
    name: 'JsonGameRepository',
    create() {
      const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-json-'));
      const file = path.join(dir, 'test.json');
      return {
        repository: new JsonGameRepository(file),
        cleanup: () => {
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  },
];

let counter = 0;
function playerInput(overrides: Partial<NewPlayerRecord> = {}): NewPlayerRecord {
  counter += 1;
  return {
    id: `player-${String(counter)}`,
    nickname: `Tay đua ${String(counter)}`,
    nicknameNormalized: `tay dua ${String(counter)}`,
    age: 8,
    avatarId: 'animal-panda-01',
    tokenHash: `hash-${String(counter)}`,
    createdAt: '2026-08-12T08:00:00.000Z',
    ...overrides,
  };
}

const ANSWERS: StoredAnswer[] = [
  { questionIndex: 0, selectedIndex: 1, responseMs: 4200, isCorrect: true, awardedScore: 130 },
  { questionIndex: 1, selectedIndex: 0, responseMs: 5100, isCorrect: false, awardedScore: 0 },
];

for (const driver of DRIVERS) {
  describe(`GameRepository contract: ${driver.name}`, () => {
    let repository: GameRepository;
    let cleanup: () => void;

    beforeEach(() => {
      const created = driver.create();
      repository = created.repository;
      cleanup = created.cleanup;
    });

    afterEach(async () => {
      await repository.close();
      cleanup();
    });

    it('creates and reads a player', async () => {
      const input = playerInput();
      const created = await repository.createPlayer(input);

      expect(created.id).toBe(input.id);
      expect(created.status).toBe('active');
      expect(created.createdAt).toBe(input.createdAt);

      const byId = await repository.getPlayerById(input.id);
      expect(byId?.nickname).toBe(input.nickname);
    });

    it('looks a player up by token hash and never by nickname', async () => {
      const input = playerInput({ tokenHash: 'hash-lookup' });
      await repository.createPlayer(input);

      const found = await repository.getPlayerByTokenHash('hash-lookup');
      expect(found?.id).toBe(input.id);

      expect(await repository.getPlayerByTokenHash('hash-unknown')).toBeNull();
    });

    it('allows two players to share a nickname', async () => {
      await repository.createPlayer(playerInput({ nickname: 'Gấu Mập', tokenHash: 'h1' }));
      await repository.createPlayer(playerInput({ nickname: 'Gấu Mập', tokenHash: 'h2' }));

      const first = await repository.getPlayerByTokenHash('h1');
      const second = await repository.getPlayerByTokenHash('h2');
      expect(first?.id).not.toBe(second?.id);
    });

    it('updates only the supplied fields', async () => {
      const input = playerInput();
      await repository.createPlayer(input);

      const updated = await repository.updatePlayer(input.id, {
        nickname: 'Panda Tốc Độ',
        updatedAt: '2026-08-12T09:00:00.000Z',
      });

      expect(updated.nickname).toBe('Panda Tốc Độ');
      expect(updated.age).toBe(input.age);
      expect(updated.avatarId).toBe(input.avatarId);
      expect(updated.updatedAt).toBe('2026-08-12T09:00:00.000Z');
    });

    it('rejects an update to an unknown player', async () => {
      await expect(
        repository.updatePlayer('nope', { updatedAt: '2026-08-12T09:00:00.000Z' }),
      ).rejects.toThrow();
    });

    it('starts and finishes a run', async () => {
      const player = await repository.createPlayer(playerInput());
      const run = await repository.createRunSession({
        id: 'run-1',
        playerId: player.id,
        grade: 3,
        seed: 12345,
        generatorVersion: 1,
        startedAt: '2026-08-12T08:10:00.000Z',
        expiresAt: '2026-08-12T08:20:00.000Z',
      });

      expect(run.status).toBe('started');
      expect(run.score).toBeNull();

      const finished = await repository.finishRun({
        id: 'run-1',
        status: 'finished',
        score: 1420,
        correctAnswers: 10,
        bestStreak: 6,
        durationMs: 104230,
        answers: ANSWERS,
        rejectionReason: null,
        finishedAt: '2026-08-12T08:12:00.000Z',
      });

      expect(finished.status).toBe('finished');
      expect(finished.score).toBe(1420);
      expect(finished.answers).toEqual(ANSWERS);
    });

    it('makes finishing idempotent', async () => {
      const player = await repository.createPlayer(playerInput());
      await repository.createRunSession({
        id: 'run-idem',
        playerId: player.id,
        grade: 2,
        seed: 1,
        generatorVersion: 1,
        startedAt: '2026-08-12T08:10:00.000Z',
        expiresAt: '2026-08-12T08:20:00.000Z',
      });

      const first = await repository.finishRun({
        id: 'run-idem',
        status: 'finished',
        score: 900,
        correctAnswers: 8,
        bestStreak: 3,
        durationMs: 100000,
        answers: ANSWERS,
        rejectionReason: null,
        finishedAt: '2026-08-12T08:12:00.000Z',
      });

      // A retry with different numbers must not overwrite the settled result.
      const second = await repository.finishRun({
        id: 'run-idem',
        status: 'finished',
        score: 99999,
        correctAnswers: 12,
        bestStreak: 12,
        durationMs: 1,
        answers: ANSWERS,
        rejectionReason: null,
        finishedAt: '2026-08-12T08:13:00.000Z',
      });

      expect(second.score).toBe(first.score);
      expect(second.finishedAt).toBe(first.finishedAt);
    });

    it('counts only open, unexpired runs', async () => {
      const player = await repository.createPlayer(playerInput());
      const base = {
        playerId: player.id,
        grade: 1 as Grade,
        seed: 5,
        generatorVersion: 1,
        startedAt: '2026-08-12T08:00:00.000Z',
      };

      await repository.createRunSession({ ...base, id: 'open', expiresAt: '2026-08-12T09:00:00.000Z' });
      await repository.createRunSession({ ...base, id: 'stale', expiresAt: '2026-08-12T08:01:00.000Z' });

      const now = '2026-08-12T08:30:00.000Z';
      expect(await repository.countOpenRuns(player.id, now)).toBe(1);
    });

    it('reports best score per grade', async () => {
      const player = await repository.createPlayer(playerInput());
      await finishRunFor(repository, player.id, 'r1', 3, 1000, 8, 100000, '2026-08-12T08:10:00.000Z');
      await finishRunFor(repository, player.id, 'r2', 3, 1500, 10, 100000, '2026-08-12T08:20:00.000Z');
      await finishRunFor(repository, player.id, 'r3', 1, 700, 6, 100000, '2026-08-12T08:30:00.000Z');

      const best = await repository.getBestScores(player.id);
      expect(best[3]).toBe(1500);
      expect(best[1]).toBe(700);
      expect(best[5]).toBeUndefined();
    });

    it('gives each player exactly one leaderboard row', async () => {
      const a = await repository.createPlayer(playerInput({ nickname: 'A' }));
      const b = await repository.createPlayer(playerInput({ nickname: 'B' }));

      await finishRunFor(repository, a.id, 'a1', 3, 1000, 9, 90000, '2026-08-12T08:10:00.000Z');
      await finishRunFor(repository, a.id, 'a2', 3, 1600, 11, 95000, '2026-08-12T08:20:00.000Z');
      await finishRunFor(repository, b.id, 'b1', 3, 1200, 10, 80000, '2026-08-12T08:15:00.000Z');

      const board = await repository.getLeaderboard(allTime(3, 10));
      expect(board).toHaveLength(2);
      expect(board[0]?.playerId).toBe(a.id);
      expect(board[0]?.score).toBe(1600);
      expect(board[0]?.rank).toBe(1);
      expect(board[1]?.playerId).toBe(b.id);
      expect(board[1]?.rank).toBe(2);
    });

    it('breaks ties by correct answers, then duration, then finish time', async () => {
      const a = await repository.createPlayer(playerInput({ nickname: 'A' }));
      const b = await repository.createPlayer(playerInput({ nickname: 'B' }));
      const c = await repository.createPlayer(playerInput({ nickname: 'C' }));
      const d = await repository.createPlayer(playerInput({ nickname: 'D' }));

      // Same score; B has more correct answers, so B wins.
      await finishRunFor(repository, a.id, 'ta', 4, 1000, 9, 80000, '2026-08-12T08:10:00.000Z');
      await finishRunFor(repository, b.id, 'tb', 4, 1000, 10, 90000, '2026-08-12T08:10:00.000Z');
      // Same score and correct answers as A; C is faster, so C beats A.
      await finishRunFor(repository, c.id, 'tc', 4, 1000, 9, 70000, '2026-08-12T08:10:00.000Z');
      // Identical to A except a later finish, so D comes last.
      await finishRunFor(repository, d.id, 'td', 4, 1000, 9, 80000, '2026-08-12T08:30:00.000Z');

      const board = await repository.getLeaderboard(allTime(4, 10));
      expect(board.map((row) => row.nickname)).toEqual(['B', 'C', 'A', 'D']);
    });

    it('filters by weekly period', async () => {
      const player = await repository.createPlayer(playerInput());
      await finishRunFor(repository, player.id, 'old', 2, 5000, 12, 60000, '2026-08-01T08:00:00.000Z');
      await finishRunFor(repository, player.id, 'new', 2, 900, 7, 60000, '2026-08-12T08:00:00.000Z');

      const weekly = await repository.getLeaderboard({
        grade: 2,
        period: 'weekly',
        limit: 10,
        periodStart: '2026-08-09T17:00:00.000Z',
        periodEnd: '2026-08-16T17:00:00.000Z',
      });

      expect(weekly).toHaveLength(1);
      expect(weekly[0]?.score).toBe(900);

      const allTimeBoard = await repository.getLeaderboard(allTime(2, 10));
      expect(allTimeBoard[0]?.score).toBe(5000);
    });

    it('hides disabled players from the leaderboard', async () => {
      const active = await repository.createPlayer(playerInput({ nickname: 'Active' }));
      const banned = await repository.createPlayer(playerInput({ nickname: 'Banned' }));

      await finishRunFor(repository, active.id, 'ok', 5, 500, 5, 90000, '2026-08-12T08:10:00.000Z');
      await finishRunFor(repository, banned.id, 'no', 5, 9000, 12, 60000, '2026-08-12T08:10:00.000Z');

      await repository.updatePlayer(banned.id, {
        status: 'disabled',
        updatedAt: '2026-08-12T09:00:00.000Z',
      });

      const board = await repository.getLeaderboard(allTime(5, 10));
      expect(board).toHaveLength(1);
      expect(board[0]?.nickname).toBe('Active');
    });

    it('excludes runs that were rejected or never finished', async () => {
      const player = await repository.createPlayer(playerInput());
      await repository.createRunSession({
        id: 'open-run',
        playerId: player.id,
        grade: 1,
        seed: 3,
        generatorVersion: 1,
        startedAt: '2026-08-12T08:00:00.000Z',
        expiresAt: '2026-08-12T08:10:00.000Z',
      });
      await repository.createRunSession({
        id: 'bad-run',
        playerId: player.id,
        grade: 1,
        seed: 4,
        generatorVersion: 1,
        startedAt: '2026-08-12T08:00:00.000Z',
        expiresAt: '2026-08-12T08:10:00.000Z',
      });
      await repository.finishRun({
        id: 'bad-run',
        status: 'rejected',
        score: null,
        correctAnswers: null,
        bestStreak: null,
        durationMs: null,
        answers: null,
        rejectionReason: 'ANSWER_COUNT_MISMATCH',
        finishedAt: '2026-08-12T08:05:00.000Z',
      });

      expect(await repository.getLeaderboard(allTime(1, 10))).toHaveLength(0);
    });

    it('returns a rank for a player outside the top slice', async () => {
      const players = [];
      for (let i = 0; i < 12; i += 1) {
        players.push(await repository.createPlayer(playerInput({ nickname: `P${String(i)}` })));
      }
      for (const [index, player] of players.entries()) {
        await finishRunFor(
          repository,
          player.id,
          `run-${String(index)}`,
          3,
          2000 - index * 10,
          10,
          90000,
          '2026-08-12T08:10:00.000Z',
        );
      }

      const top = await repository.getLeaderboard(allTime(3, 10));
      expect(top).toHaveLength(10);

      const last = players[11];
      expect(last).toBeDefined();
      if (last === undefined) return;

      const rank = await repository.getPlayerRank({ ...allTime(3, 10), playerId: last.id });
      expect(rank?.rank).toBe(12);
      expect(top.some((row) => row.playerId === last.id)).toBe(false);
    });

    it('returns null when the player has no ranked run', async () => {
      const player = await repository.createPlayer(playerInput());
      const rank = await repository.getPlayerRank({ ...allTime(3, 10), playerId: player.id });
      expect(rank).toBeNull();
    });

    it('answers a ping without writing', async () => {
      expect(await repository.ping()).toBe(true);
    });
  });
}

describe('SQLite migrations', () => {
  it('records the latest schema version and is safe to re-run', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-migrate-'));
    const file = path.join(dir, 'migrate.db');

    const first = new SqliteGameRepository(file);
    void first.close();

    // Opening again runs the migration check a second time.
    const second = new SqliteGameRepository(file);
    void second.close();

    const db = new DatabaseSync(file);
    expect(currentSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    const rows = db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get() as {
      total: number;
    };
    expect(rows.total).toBe(LATEST_SCHEMA_VERSION);
    db.close();

    rmSync(dir, { recursive: true, force: true });
  });
});

describe('JSON store durability', () => {
  it('writes atomically and reloads what it wrote', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-atomic-'));
    const file = path.join(dir, 'data.json');

    const repository = new JsonGameRepository(file);
    await repository.createPlayer(playerInput({ nickname: 'Bền Bỉ' }));
    await repository.close();

    const reopened = new JsonGameRepository(file);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { players: { nickname: string }[] };
    expect(raw.players[0]?.nickname).toBe('Bền Bỉ');

    const players = await reopened.getPlayerByTokenHash(
      (raw as unknown as { players: { tokenHash: string }[] }).players[0]?.tokenHash ?? '',
    );
    expect(players?.nickname).toBe('Bền Bỉ');
    await reopened.close();

    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses to start on a corrupt file instead of overwriting it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-corrupt-'));
    const file = path.join(dir, 'data.json');
    writeFileSync(file, '{ this is not json');

    expect(() => new JsonStore(file)).toThrow(JsonStoreCorruptError);
    // The bad file must still be there for an operator to inspect.
    expect(readFileSync(file, 'utf8')).toBe('{ this is not json');

    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an unknown schema version', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-version-'));
    const file = path.join(dir, 'data.json');
    writeFileSync(file, JSON.stringify({ schemaVersion: 99, players: [], runs: [] }));

    expect(() => new JsonStore(file)).toThrow(JsonStoreCorruptError);
    rmSync(dir, { recursive: true, force: true });
  });

  it('serialises concurrent writes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mr3d-queue-'));
    const file = path.join(dir, 'data.json');
    const repository = new JsonGameRepository(file);

    await Promise.all(
      Array.from({ length: 20 }, () => repository.createPlayer(playerInput())),
    );

    const raw = JSON.parse(readFileSync(file, 'utf8')) as { players: unknown[] };
    expect(raw.players).toHaveLength(20);

    await repository.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

function allTime(grade: Grade, limit: number) {
  return { grade, period: 'all_time' as const, limit, periodStart: null, periodEnd: null };
}

async function finishRunFor(
  repository: GameRepository,
  playerId: string,
  runId: string,
  grade: Grade,
  score: number,
  correctAnswers: number,
  durationMs: number,
  finishedAt: string,
): Promise<void> {
  await repository.createRunSession({
    id: runId,
    playerId,
    grade,
    seed: 1,
    generatorVersion: 1,
    startedAt: '2026-08-12T08:00:00.000Z',
    expiresAt: '2026-08-12T23:00:00.000Z',
  });
  await repository.finishRun({
    id: runId,
    status: 'finished',
    score,
    correctAnswers,
    bestStreak: 4,
    durationMs,
    answers: ANSWERS,
    rejectionReason: null,
    finishedAt,
  });
}
