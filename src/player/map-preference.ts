import type { MapId } from '../../shared/maps/map-manifest.ts';
import { DEFAULT_MAP_ID, isMapId } from '../../shared/maps/map-manifest.ts';
import type { PlayerMapStats } from '../../shared/maps/smart-random.ts';
import { emptyMapStats, RECENT_MAP_HISTORY } from '../../shared/maps/smart-random.ts';
import type { StorageLike } from './player-storage.ts';

/**
 * The player's map choice and their local play history.
 *
 * The history is a cache: the server's count from finished runs is the real
 * one. It exists so the smart pick still behaves sensibly when the profile
 * request has not come back yet, or fails.
 */

export const MAP_PREFERENCE_KEY = 'math-runner.map-preference.v1';
export const MAP_STATS_CACHE_KEY = 'math-runner.map-stats.v1';

export type MapSelectionMode = 'manual' | 'smart-random';

export interface SavedMapPreference {
  mode: MapSelectionMode;
  selectedMapId: MapId;
  updatedAt: string;
}

/** A player who has never chosen gets the roulette and a bright preview. */
export const DEFAULT_MAP_PREFERENCE: SavedMapPreference = {
  mode: 'smart-random',
  selectedMapId: DEFAULT_MAP_ID,
  updatedAt: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class MapPreferenceStorage {
  constructor(private readonly storage: StorageLike | null) {}

  static fromWindow(): MapPreferenceStorage {
    try {
      const probe = '__mr3d_map_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return new MapPreferenceStorage(window.localStorage);
    } catch {
      return new MapPreferenceStorage(null);
    }
  }

  getPreference(): SavedMapPreference {
    const raw = this.read(MAP_PREFERENCE_KEY);
    if (raw === null) return { ...DEFAULT_MAP_PREFERENCE };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return { ...DEFAULT_MAP_PREFERENCE };

      return {
        mode: parsed.mode === 'manual' ? 'manual' : 'smart-random',
        selectedMapId: isMapId(parsed.selectedMapId) ? parsed.selectedMapId : DEFAULT_MAP_ID,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      };
    } catch {
      return { ...DEFAULT_MAP_PREFERENCE };
    }
  }

  setPreference(preference: Omit<SavedMapPreference, 'updatedAt'>): void {
    this.write(
      MAP_PREFERENCE_KEY,
      JSON.stringify({ ...preference, updatedAt: new Date().toISOString() }),
    );
  }

  getStats(): PlayerMapStats {
    const raw = this.read(MAP_STATS_CACHE_KEY);
    if (raw === null) return emptyMapStats();

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return emptyMapStats();

      const recent = Array.isArray(parsed.recentMapIds)
        ? parsed.recentMapIds.filter(isMapId).slice(0, RECENT_MAP_HISTORY)
        : [];

      const totals: Partial<Record<MapId, number>> = {};
      if (isRecord(parsed.totalPlays)) {
        for (const [key, value] of Object.entries(parsed.totalPlays)) {
          if (isMapId(key) && typeof value === 'number' && Number.isFinite(value)) {
            totals[key] = value;
          }
        }
      }

      return {
        recentMapIds: recent,
        totalPlays: totals,
        lastPlayedMapId: isMapId(parsed.lastPlayedMapId) ? parsed.lastPlayedMapId : null,
      };
    } catch {
      return emptyMapStats();
    }
  }

  setStats(stats: PlayerMapStats): void {
    this.write(MAP_STATS_CACHE_KEY, JSON.stringify(stats));
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Private browsing: the choice simply does not survive a reload.
    }
  }
}
