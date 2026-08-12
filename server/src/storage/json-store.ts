import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { GameRunRecord, PlayerRecord } from '../domain/records.ts';

/**
 * File-backed store for the JSON driver.
 *
 * Writes go to a temporary file in the same directory and are then renamed over
 * the target, which is atomic on a single filesystem. A crash therefore leaves
 * either the previous file or the new one - never a truncated one. Writes are
 * serialised through an in-process queue because this driver is explicitly
 * single-process only.
 */

export const JSON_SCHEMA_VERSION = 1;

export interface JsonData {
  schemaVersion: number;
  players: PlayerRecord[];
  runs: GameRunRecord[];
  metadata: { updatedAt: string };
}

export class JsonStoreCorruptError extends Error {
  readonly filePath: string;

  constructor(filePath: string, cause?: unknown) {
    super(`JSON data file is not readable: ${filePath}`);
    this.name = 'JsonStoreCorruptError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

function emptyData(): JsonData {
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    players: [],
    runs: [],
    metadata: { updatedAt: new Date().toISOString() },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rejects anything that is not a complete, correctly versioned data file. */
export function parseJsonData(raw: string, filePath: string): JsonData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new JsonStoreCorruptError(filePath, error);
  }

  if (!isRecord(parsed)) throw new JsonStoreCorruptError(filePath);
  if (parsed.schemaVersion !== JSON_SCHEMA_VERSION) {
    throw new JsonStoreCorruptError(filePath);
  }
  if (!Array.isArray(parsed.players) || !Array.isArray(parsed.runs)) {
    throw new JsonStoreCorruptError(filePath);
  }

  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    players: parsed.players as PlayerRecord[],
    runs: parsed.runs as GameRunRecord[],
    metadata: { updatedAt: readUpdatedAt(parsed.metadata) },
  };
}

function readUpdatedAt(metadata: unknown): string {
  if (isRecord(metadata) && typeof metadata.updatedAt === 'string') {
    return metadata.updatedAt;
  }
  return new Date().toISOString();
}

export class JsonStore {
  private data: JsonData;
  private writeQueue: Promise<void> = Promise.resolve();
  private closed = false;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(path.dirname(filePath), { recursive: true });

    if (!existsSync(filePath)) {
      this.data = emptyData();
      this.writeFileNow(this.data);
      return;
    }

    // A corrupt file is never silently overwritten: the caller decides.
    this.data = parseJsonData(readFileSync(filePath, 'utf8'), filePath);
  }

  /** In-memory snapshot; reads never touch the disk. */
  read(): JsonData {
    return this.data;
  }

  /** Applies a mutation and persists it. Serialised against other writes. */
  async write<T>(mutate: (data: JsonData) => T): Promise<T> {
    if (this.closed) throw new Error('JSON store is closed');

    let result!: T;
    const task = this.writeQueue.then(() => {
      result = mutate(this.data);
      this.data.metadata.updatedAt = new Date().toISOString();
      this.writeFileNow(this.data);
    });

    this.writeQueue = task.catch(() => undefined);
    await task;
    return result;
  }

  private writeFileNow(data: JsonData): void {
    const directory = path.dirname(this.filePath);
    const temporary = path.join(directory, `.${path.basename(this.filePath)}.tmp`);

    // Keep the previous good file so a bad write is recoverable by hand.
    if (existsSync(this.filePath)) {
      try {
        copyFileSync(this.filePath, `${this.filePath}.bak`);
      } catch {
        // A missing backup must not stop the write itself.
      }
    }

    writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
    renameSync(temporary, this.filePath);
  }

  /** Waits for queued writes to land, then refuses further writes. */
  async close(): Promise<void> {
    await this.writeQueue;
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
