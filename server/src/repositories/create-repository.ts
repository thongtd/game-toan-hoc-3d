import type { ServerConfig } from '../config.ts';
import type { GameRepository } from './GameRepository.ts';
import { JsonGameRepository } from './JsonGameRepository.ts';
import { SqliteGameRepository } from './SqliteGameRepository.ts';

/** Builds the configured storage driver. SQLite is the default. */
export function createRepository(config: ServerConfig): GameRepository {
  switch (config.storageDriver) {
    case 'sqlite':
      return new SqliteGameRepository(config.sqlitePath);
    case 'json':
      return new JsonGameRepository(config.jsonDataPath);
  }
}
