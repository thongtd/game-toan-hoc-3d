import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DATA,
  GameStorage,
  STORAGE_KEY,
  parseStoredData,
} from '../../src/storage/GameStorage.ts';
import type { StorageLike } from '../../src/storage/GameStorage.ts';

/** In-memory stand-in for localStorage so the tests stay environment free. */
class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  throwOnWrite = false;

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
});

describe('parseStoredData', () => {
  it('loads valid data', () => {
    const raw = JSON.stringify({
      version: 1,
      tutorialSeen: true,
      muted: true,
      selectedGrade: 4,
      bestScoreByGrade: { 1: 1200, 4: 900 },
    });

    expect(parseStoredData(raw)).toEqual({
      version: 1,
      tutorialSeen: true,
      muted: true,
      selectedGrade: 4,
      bestScoreByGrade: { 1: 1200, 4: 900 },
    });
  });

  it('falls back to the defaults for corrupt JSON', () => {
    expect(parseStoredData('{not json')).toEqual(DEFAULT_DATA);
    expect(parseStoredData('')).toEqual(DEFAULT_DATA);
    expect(parseStoredData(null)).toEqual(DEFAULT_DATA);
  });

  it('falls back safely for an unknown version', () => {
    const raw = JSON.stringify({ version: 99, muted: true, selectedGrade: 3 });
    expect(parseStoredData(raw)).toEqual(DEFAULT_DATA);
  });

  it('ignores values of the wrong type instead of throwing', () => {
    const raw = JSON.stringify({
      version: 1,
      tutorialSeen: 'yes',
      muted: 1,
      selectedGrade: 9,
      bestScoreByGrade: { 2: 'lots', 3: -50, 7: 100, 5: 640.7 },
    });

    expect(parseStoredData(raw)).toEqual({
      version: 1,
      tutorialSeen: false,
      muted: false,
      selectedGrade: DEFAULT_DATA.selectedGrade,
      bestScoreByGrade: { 5: 640 },
    });
  });

  it('rejects a non-object payload', () => {
    expect(parseStoredData('[1,2,3]')).toEqual(DEFAULT_DATA);
    expect(parseStoredData('"hello"')).toEqual(DEFAULT_DATA);
  });
});

describe('GameStorage', () => {
  it('starts from the defaults with an empty backing store', () => {
    const game = new GameStorage(storage);
    expect(game.tutorialSeen).toBe(false);
    expect(game.muted).toBe(false);
    expect(game.selectedGrade).toBe(1);
    expect(game.bestScore(3)).toBe(0);
  });

  it('persists preferences under the single versioned key', () => {
    const game = new GameStorage(storage);
    game.setMuted(true);
    game.setSelectedGrade(5);
    game.markTutorialSeen();

    expect([...storage.map.keys()]).toEqual([STORAGE_KEY]);

    const reloaded = new GameStorage(storage);
    expect(reloaded.muted).toBe(true);
    expect(reloaded.selectedGrade).toBe(5);
    expect(reloaded.tutorialSeen).toBe(true);
  });

  it('only raises the best score', () => {
    const game = new GameStorage(storage);

    expect(game.submitScore(2, 500)).toBe(true);
    expect(game.bestScore(2)).toBe(500);

    expect(game.submitScore(2, 400)).toBe(false);
    expect(game.bestScore(2)).toBe(500);

    expect(game.submitScore(2, 500)).toBe(false);
    expect(game.bestScore(2)).toBe(500);

    expect(game.submitScore(2, 501)).toBe(true);
    expect(game.bestScore(2)).toBe(501);
  });

  it('keeps best scores separate per grade', () => {
    const game = new GameStorage(storage);
    game.submitScore(1, 300);
    game.submitScore(5, 900);

    expect(game.bestScore(1)).toBe(300);
    expect(game.bestScore(5)).toBe(900);
    expect(game.bestScore(3)).toBe(0);
  });

  it('ignores invalid scores', () => {
    const game = new GameStorage(storage);
    expect(game.submitScore(1, Number.NaN)).toBe(false);
    expect(game.submitScore(1, Number.POSITIVE_INFINITY)).toBe(false);
    expect(game.submitScore(1, -10)).toBe(false);
    expect(game.bestScore(1)).toBe(0);
  });

  it('recovers from a corrupt payload without throwing', () => {
    storage.map.set(STORAGE_KEY, '{{{');
    const game = new GameStorage(storage);
    expect(game.selectedGrade).toBe(DEFAULT_DATA.selectedGrade);
    expect(game.bestScore(1)).toBe(0);
  });

  it('stays usable when writing fails', () => {
    const game = new GameStorage(storage);
    storage.throwOnWrite = true;
    expect(() => {
      game.setMuted(true);
    }).not.toThrow();
    expect(game.muted).toBe(true);
  });

  it('works without any backing store at all', () => {
    const game = new GameStorage(null);
    game.setMuted(true);
    expect(game.muted).toBe(true);
    expect(game.submitScore(1, 100)).toBe(true);
    expect(game.bestScore(1)).toBe(100);
  });

  it('never stores identifying information', () => {
    const game = new GameStorage(storage);
    game.setMuted(true);
    game.submitScore(2, 750);

    const raw = storage.map.get(STORAGE_KEY) ?? '';
    const parsed: unknown = JSON.parse(raw);
    expect(Object.keys(parsed as object).sort()).toEqual([
      'bestScoreByGrade',
      'muted',
      'selectedGrade',
      'tutorialSeen',
      'version',
    ]);
  });

  it('clears everything on reset', () => {
    const game = new GameStorage(storage);
    game.submitScore(1, 900);
    game.markTutorialSeen();
    game.reset();

    expect(game.bestScore(1)).toBe(0);
    expect(game.tutorialSeen).toBe(false);
    expect(storage.map.has(STORAGE_KEY)).toBe(false);
  });

  it('returns an isolated snapshot', () => {
    const game = new GameStorage(storage);
    game.submitScore(1, 100);

    const snapshot = game.snapshot();
    snapshot.bestScoreByGrade[1] = 99999;

    expect(game.bestScore(1)).toBe(100);
  });
});
