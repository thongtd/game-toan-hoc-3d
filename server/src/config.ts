import path from 'node:path';

/**
 * Environment configuration.
 *
 * The process fails fast on anything invalid rather than starting with a
 * half-working storage driver or an insecure default secret in production.
 */

export type StorageDriver = 'sqlite' | 'json';

export interface ServerConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  storageDriver: StorageDriver;
  sqlitePath: string;
  jsonDataPath: string;
  playerTokenPepper: string;
  corsOrigins: string[];
  trustProxy: boolean;
  /** Largest accepted request body. */
  bodyLimitBytes: number;
  /** How long leaderboard responses may be served from cache. */
  leaderboardCacheMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DEV_PEPPER = 'dev-only-insecure-pepper';

function readEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  if (value === undefined || value === '') return fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ConfigError(`${name} must be one of: ${allowed.join(', ')} (received "${value}")`);
  }
  return value as T;
}

function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`PORT must be a valid port number (received "${value}")`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv = readEnum(
    env.NODE_ENV,
    ['development', 'test', 'production'] as const,
    'development',
    'NODE_ENV',
  );
  const storageDriver = readEnum(
    env.STORAGE_DRIVER,
    ['sqlite', 'json'] as const,
    'sqlite',
    'STORAGE_DRIVER',
  );

  const pepper = env.PLAYER_TOKEN_PEPPER ?? '';
  if (nodeEnv === 'production' && (pepper.length < 32 || pepper === DEV_PEPPER)) {
    throw new ConfigError(
      'PLAYER_TOKEN_PEPPER must be set to a random secret of at least 32 characters in production.',
    );
  }

  const corsOrigins = (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (nodeEnv === 'production' && corsOrigins.includes('*')) {
    throw new ConfigError('CORS_ORIGINS cannot be "*" in production because requests are authenticated.');
  }

  return {
    nodeEnv,
    port: readPort(env.PORT, 8787),
    host: env.HOST ?? '127.0.0.1',
    storageDriver,
    sqlitePath: path.resolve(env.SQLITE_PATH ?? './data/math-runner.db'),
    jsonDataPath: path.resolve(env.JSON_DATA_PATH ?? './data/math-runner.json'),
    playerTokenPepper: pepper.length > 0 ? pepper : DEV_PEPPER,
    corsOrigins,
    trustProxy: env.TRUST_PROXY === 'true',
    bodyLimitBytes: 32 * 1024,
    leaderboardCacheMs: 15_000,
  };
}
