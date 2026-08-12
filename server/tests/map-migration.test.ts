import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MIGRATIONS, currentSchemaVersion, runMigrations } from '../src/storage/migrations.ts';
import { SqliteGameRepository } from '../src/repositories/SqliteGameRepository.ts';
import { JsonGameRepository } from '../src/repositories/JsonGameRepository.ts';
import { DEFAULT_MAP_ID } from '../../shared/maps/map-manifest.ts';

/**
 * Upgrading a database that predates maps.
 *
 * Runs recorded before the map system existed must stay valid and stay on the
 * leaderboard - they are read as the first map rather than thrown away.
 */

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'mr3d-map-migration-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

/** Builds a database at schema version 1, exactly as the old release left it. */
function createLegacyDatabase(file: string): void {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const first = MIGRATIONS[0];
  if (first === undefined) throw new Error('No migrations defined');
  db.exec(first.up);
  db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
    first.version,
    first.name,
    '2026-08-01T00:00:00.000Z',
  );

  db.prepare(
    `INSERT INTO players
       (id, nickname, nickname_normalized, age, avatar_id, token_hash, status,
        created_at, updated_at, last_seen_at)
     VALUES ('p1', 'Cũ', 'cu', 8, 'animal-panda-01', 'hash-1', 'active', ?, ?, ?)`,
  ).run('2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

  db.prepare(
    `INSERT INTO game_runs
       (id, player_id, grade, seed, generator_version, status, score, correct_answers,
        best_streak, duration_ms, answers_json, rejection_reason, started_at, expires_at, finished_at)
     VALUES ('r1', 'p1', 2, 99, 1, 'finished', 800, 9, 4, 90000, '[]', NULL, ?, ?, ?)`,
  ).run('2026-08-01T00:00:00.000Z', '2026-08-01T00:10:00.000Z', '2026-08-01T00:05:00.000Z');

  db.close();
}

describe('migration bản đồ trên SQLite', () => {
  it('nâng cấp database cũ và gán bản đồ mặc định cho lượt chơi cũ', async () => {
    const file = path.join(directory, 'legacy.db');
    createLegacyDatabase(file);

    const probe = new DatabaseSync(file);
    expect(currentSchemaVersion(probe)).toBe(1);
    const applied = runMigrations(probe);
    expect(applied).toContain(2);
    probe.close();

    const repository = new SqliteGameRepository(file);
    const run = await repository.getRunById('r1');

    expect(run).not.toBeNull();
    expect(run?.mapId).toBe(DEFAULT_MAP_ID);
    expect(run?.mapManifestVersion).toBe(1);
    expect(run?.score).toBe(800);

    // The old run still counts, both for records and for the map history.
    expect(await repository.getBestScores('p1')).toEqual({ 2: 800 });
    const stats = await repository.getMapStats('p1');
    expect(stats.lastPlayedMapId).toBe(DEFAULT_MAP_ID);

    await repository.close();
  });

  it('migration chạy được nhiều lần mà không hỏng', () => {
    const file = path.join(directory, 'twice.db');
    createLegacyDatabase(file);

    const db = new DatabaseSync(file);
    expect(runMigrations(db)).toContain(2);
    expect(runMigrations(db)).toEqual([]);
    expect(currentSchemaVersion(db)).toBe(2);
    db.close();
  });
});

describe('migration bản đồ trên JSON', () => {
  it('đọc lượt chơi cũ thiếu mapId thành bản đồ mặc định', async () => {
    const file = path.join(directory, 'legacy.json');
    const seeded = {
      schemaVersion: 1,
      players: [
        {
          id: 'p1',
          nickname: 'Cũ',
          nicknameNormalized: 'cu',
          age: 8,
          avatarId: 'animal-panda-01',
          tokenHash: 'hash-1',
          status: 'active',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
          lastSeenAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      runs: [
        {
          id: 'r1',
          playerId: 'p1',
          grade: 2,
          seed: 99,
          generatorVersion: 1,
          status: 'finished',
          score: 800,
          correctAnswers: 9,
          bestStreak: 4,
          durationMs: 90_000,
          answers: [],
          rejectionReason: null,
          startedAt: '2026-08-01T00:00:00.000Z',
          expiresAt: '2026-08-01T00:10:00.000Z',
          finishedAt: '2026-08-01T00:05:00.000Z',
        },
      ],
      metadata: { updatedAt: '2026-08-01T00:00:00.000Z' },
    };

    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, JSON.stringify(seeded), 'utf8');

    const repository = new JsonGameRepository(file);
    const run = await repository.getRunById('r1');

    expect(run?.mapId).toBe(DEFAULT_MAP_ID);
    expect(run?.mapManifestVersion).toBe(1);

    const stats = await repository.getMapStats('p1');
    expect(stats.totalPlays[DEFAULT_MAP_ID]).toBe(1);

    await repository.close();
  });
});
