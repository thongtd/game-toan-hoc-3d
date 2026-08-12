/**
 * The one and only list of maps.
 *
 * The browser builds its scenes from this manifest and the server validates
 * `mapId` against the very same module, so a map cannot exist on one side and
 * be unknown on the other. Deliberately free of Three.js and DOM types.
 */

export const MAP_IDS = [
  'rainbow-skyway',
  'vietnam-countryside',
  'cosmic-orbit',
  'enchanted-forest',
  'toy-city',
] as const;

export type MapId = (typeof MAP_IDS)[number];

/** Bumped when the manifest changes in a way that affects stored runs. */
export const MAP_MANIFEST_VERSION = 1;

/**
 * Fallback for runs recorded before maps existed, and the preview shown before
 * the player has ever picked one.
 */
export const DEFAULT_MAP_ID: MapId = 'rainbow-skyway';

export type ParticlePresetId =
  'soft-stars' | 'pollen-light' | 'slow-stars' | 'fireflies' | 'confetti-sparse';

export interface MapPalette {
  fog: string;
  sky: string;
  ground: string;
  keyLight: string;
  track: string;
  trackEdge: string;
}

export interface MapQualityBudget {
  maxVisibleTrianglesMobile: number;
  maxVisibleTrianglesDesktop: number;
  maxDrawCallsMobile: number;
  maxDrawCallsDesktop: number;
}

export interface MapDefinition {
  id: MapId;
  displayName: string;
  /** One short line, at most 45 characters, shown under the preview. */
  description: string;
  /** Set to false to hide a broken map in one release; never per player. */
  enabled: boolean;
  sortOrder: number;
  thumbnailUrl: string;
  assetBaseUrl: string;
  palette: MapPalette;
  /**
   * False for the maps whose road floats (sky, orbit): the shared ground plane
   * is hidden so the track reads as suspended instead of sitting on grass.
   */
  hasGroundPlane: boolean;
  /** False where white clouds would be nonsense, such as in orbit. */
  showSharedClouds: boolean;
  particlePreset: ParticlePresetId;
  segmentIds: readonly string[];
  qualityBudget: MapQualityBudget;
  manifestVersion: typeof MAP_MANIFEST_VERSION;
}

/** Every map shares the same budget: none of them may cost more than another. */
const SHARED_BUDGET: MapQualityBudget = {
  maxVisibleTrianglesMobile: 80_000,
  maxVisibleTrianglesDesktop: 150_000,
  maxDrawCallsMobile: 80,
  maxDrawCallsDesktop: 120,
};

export const MAPS: readonly MapDefinition[] = [
  {
    id: 'rainbow-skyway',
    displayName: 'Đường Cầu Vồng',
    description: 'Lướt qua mây và những vòm sắc màu!',
    enabled: true,
    sortOrder: 10,
    thumbnailUrl: '/assets/maps/rainbow-skyway/thumbnail.webp',
    assetBaseUrl: '/assets/maps/rainbow-skyway/',
    palette: {
      fog: '#BDEEFF',
      sky: '#A8E8FF',
      ground: '#F7E7A9',
      keyLight: '#FFF4C7',
      track: '#F6FBFF',
      trackEdge: '#7FD5F5',
    },
    hasGroundPlane: false,
    showSharedClouds: true,
    particlePreset: 'soft-stars',
    segmentIds: [
      'cloud-islands',
      'rainbow-arches',
      'star-garden',
      'balloon-valley',
      'sunny-windmills',
    ],
    qualityBudget: SHARED_BUDGET,
    manifestVersion: MAP_MANIFEST_VERSION,
  },
  {
    id: 'vietnam-countryside',
    displayName: 'Đường Làng Quê Việt Nam',
    description: 'Chạy giữa đồng lúa và hàng tre xanh!',
    enabled: true,
    sortOrder: 20,
    thumbnailUrl: '/assets/maps/vietnam-countryside/thumbnail.webp',
    assetBaseUrl: '/assets/maps/vietnam-countryside/',
    palette: {
      fog: '#D7F1D0',
      sky: '#A9DFFF',
      ground: '#9EBD58',
      keyLight: '#FFE3A0',
      track: '#EADCBA',
      trackEdge: '#B98A4B',
    },
    hasGroundPlane: true,
    showSharedClouds: true,
    particlePreset: 'pollen-light',
    segmentIds: [
      'green-rice-fields',
      'bamboo-gate',
      'lotus-pond',
      'tile-roof-hamlet',
      'banana-garden',
      'harvest-fields',
    ],
    qualityBudget: SHARED_BUDGET,
    manifestVersion: MAP_MANIFEST_VERSION,
  },
  {
    id: 'cosmic-orbit',
    displayName: 'Đường Không Gian Vũ Trụ',
    description: 'Bay qua hành tinh và trạm không gian!',
    enabled: true,
    sortOrder: 30,
    thumbnailUrl: '/assets/maps/cosmic-orbit/thumbnail.webp',
    assetBaseUrl: '/assets/maps/cosmic-orbit/',
    palette: {
      fog: '#151A46',
      sky: '#4C5BD4',
      ground: '#161B3E',
      keyLight: '#B9D9FF',
      track: '#2A3468',
      trackEdge: '#4DE3F5',
    },
    hasGroundPlane: false,
    showSharedClouds: false,
    particlePreset: 'slow-stars',
    segmentIds: [
      'orbital-station',
      'ringed-planet-pass',
      'satellite-alley',
      'safe-asteroid-field',
      'comet-viewpoint',
    ],
    qualityBudget: SHARED_BUDGET,
    manifestVersion: MAP_MANIFEST_VERSION,
  },
  {
    id: 'enchanted-forest',
    displayName: 'Rừng Cổ Tích',
    description: 'Khám phá nấm khổng lồ và đom đóm!',
    enabled: true,
    sortOrder: 40,
    thumbnailUrl: '/assets/maps/enchanted-forest/thumbnail.webp',
    assetBaseUrl: '/assets/maps/enchanted-forest/',
    palette: {
      fog: '#CFE7D2',
      sky: '#C7D7FF',
      ground: '#6E8C58',
      keyLight: '#FFF0B5',
      track: '#E7DCC4',
      trackEdge: '#A6C48A',
    },
    hasGroundPlane: true,
    showSharedClouds: true,
    particlePreset: 'fireflies',
    segmentIds: [
      'giant-mushroom-grove',
      'crystal-brook',
      'flower-archway',
      'firefly-hollow',
      'castle-overlook',
    ],
    qualityBudget: SHARED_BUDGET,
    manifestVersion: MAP_MANIFEST_VERSION,
  },
  {
    id: 'toy-city',
    displayName: 'Thành Phố Đồ Chơi',
    description: 'Đua giữa những khối đồ chơi tí hon!',
    enabled: true,
    sortOrder: 50,
    thumbnailUrl: '/assets/maps/toy-city/thumbnail.webp',
    assetBaseUrl: '/assets/maps/toy-city/',
    palette: {
      fog: '#D8F0FF',
      sky: '#BFE5FF',
      ground: '#FFD7A8',
      keyLight: '#FFF0C6',
      track: '#F2F4F8',
      trackEdge: '#F26B5B',
    },
    hasGroundPlane: true,
    showSharedClouds: true,
    particlePreset: 'confetti-sparse',
    segmentIds: [
      'building-block-boulevard',
      'tiny-garage',
      'toy-train-park',
      'traffic-cone-plaza',
      'mini-airport-view',
    ],
    qualityBudget: SHARED_BUDGET,
    manifestVersion: MAP_MANIFEST_VERSION,
  },
];

const BY_ID = new Map<MapId, MapDefinition>(MAPS.map((map) => [map.id, map]));

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && (MAP_IDS as readonly string[]).includes(value);
}

export function getMapDefinition(id: MapId): MapDefinition {
  const definition = BY_ID.get(id);
  if (definition === undefined) {
    throw new Error(`Unknown map: ${id}`);
  }
  return definition;
}

/** The map ids a player may start a run with, in display order. */
export function enabledMapIds(): MapId[] {
  return MAPS.filter((map) => map.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((map) => map.id);
}

export function enabledMaps(): MapDefinition[] {
  return MAPS.filter((map) => map.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** True when a run may be started on this map right now. */
export function isMapAvailable(value: unknown): value is MapId {
  return isMapId(value) && getMapDefinition(value).enabled;
}

/**
 * Maps only ever change what the run looks and sounds like.
 *
 * Kept as an explicit, asserted constant so a future map cannot quietly add a
 * score or difficulty multiplier: there is nowhere to put one.
 */
export const MAP_GAMEPLAY_MULTIPLIERS = Object.freeze({
  speedMultiplier: 1,
  scoreMultiplier: 1,
  questionDifficultyMultiplier: 1,
});
