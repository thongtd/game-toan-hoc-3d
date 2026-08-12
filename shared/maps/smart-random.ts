import type { MapId } from './map-manifest.ts';

/**
 * "Ngẫu nhiên thông minh" - the map roulette.
 *
 * Plain random repeats itself often enough that a child notices, so the pick is
 * biased towards the maps they have seen least, with an injectable RNG so the
 * behaviour is testable rather than merely plausible.
 */

export interface PlayerMapStats {
  /** Most recent first, at most 10 entries. */
  recentMapIds: MapId[];
  totalPlays: Partial<Record<MapId, number>>;
  lastPlayedMapId: MapId | null;
}

export const RECENT_MAP_HISTORY = 10;

export function emptyMapStats(): PlayerMapStats {
  return { recentMapIds: [], totalPlays: {}, lastPlayedMapId: null };
}

/**
 * Picks the next map.
 *
 * Order of preference: never the map just played (unless it is the only one),
 * then the least seen in recent history, then the least played overall, and
 * only then the RNG.
 */
export function chooseSmartMap(
  enabledMapIds: readonly MapId[],
  stats: PlayerMapStats,
  rng: () => number = Math.random,
): MapId {
  if (enabledMapIds.length === 0) {
    throw new Error('No enabled maps');
  }

  const withoutImmediateRepeat = enabledMapIds.filter((id) => id !== stats.lastPlayedMapId);
  const candidates =
    withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : [...enabledMapIds];

  const recentCount = (id: MapId): number =>
    stats.recentMapIds.filter((recentId) => recentId === id).length;

  const minRecentCount = Math.min(...candidates.map(recentCount));
  const leastRecent = candidates.filter((id) => recentCount(id) === minRecentCount);

  const minTotalPlays = Math.min(...leastRecent.map((id) => stats.totalPlays[id] ?? 0));
  const leastPlayed = leastRecent.filter((id) => (stats.totalPlays[id] ?? 0) === minTotalPlays);

  // Clamped so an RNG that returns exactly 1 cannot index past the end.
  const index = Math.min(leastPlayed.length - 1, Math.floor(rng() * leastPlayed.length));
  const chosen = leastPlayed[Math.max(0, index)];
  if (chosen === undefined) {
    throw new Error('No enabled maps');
  }
  return chosen;
}

/** Folds one finished run into the stats used by the next smart pick. */
export function recordMapPlay(stats: PlayerMapStats, mapId: MapId): PlayerMapStats {
  return {
    recentMapIds: [mapId, ...stats.recentMapIds].slice(0, RECENT_MAP_HISTORY),
    totalPlays: { ...stats.totalPlays, [mapId]: (stats.totalPlays[mapId] ?? 0) + 1 },
    lastPlayedMapId: mapId,
  };
}
