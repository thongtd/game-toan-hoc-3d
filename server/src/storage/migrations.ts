import type { DatabaseSync } from 'node:sqlite';

/**
 * Versioned schema migrations.
 *
 * Tables are only ever created here, never inline in a route or repository, so
 * the schema of a deployed database is always identifiable by its recorded
 * version.
 */

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'create_players_and_runs',
    up: `
      CREATE TABLE players (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        nickname_normalized TEXT NOT NULL,
        age INTEGER NOT NULL CHECK (age BETWEEN 6 AND 12),
        avatar_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'disabled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX idx_players_status ON players(status);

      CREATE TABLE game_runs (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
        seed INTEGER NOT NULL,
        generator_version INTEGER NOT NULL,
        status TEXT NOT NULL
          CHECK (status IN ('started', 'finished', 'expired', 'rejected')),
        score INTEGER,
        correct_answers INTEGER,
        best_streak INTEGER,
        duration_ms INTEGER,
        answers_json TEXT,
        rejection_reason TEXT,
        started_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        finished_at TEXT,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );

      CREATE INDEX idx_runs_player_grade
        ON game_runs(player_id, grade, status);

      CREATE INDEX idx_runs_leaderboard
        ON game_runs(grade, status, finished_at, score DESC);
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);

/** Applies every migration the database has not seen yet, in one transaction. */
export function runMigrations(db: DatabaseSync): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as {
    version: number;
  }[];
  const applied = new Set(appliedRows.map((row) => row.version));

  const executed: number[] = [];
  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;

    db.exec('BEGIN');
    try {
      db.exec(migration.up);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT');
      executed.push(migration.version);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return executed;
}

export function currentSchemaVersion(db: DatabaseSync): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number } | undefined;
  return row?.version ?? 0;
}
