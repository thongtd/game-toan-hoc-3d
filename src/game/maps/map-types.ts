import type * as THREE from 'three';
import type { MapDefinition, MapId } from '../../../shared/maps/map-manifest.ts';
import type { Rng } from '../../../shared/math/seeded-rng.ts';
import type { QualitySettings } from '../../scene/quality.ts';

/**
 * A map is set dressing and nothing else.
 *
 * It owns its scenery, lighting colours and ambient particles. It has no say in
 * lanes, gates, questions, scoring or speed - those live in systems every map
 * shares, which is what keeps one leaderboard fair across five worlds.
 */
export interface MapRuntime {
  readonly id: MapId;
  /** Everything the map adds to the scene, so removal is a single operation. */
  readonly root: THREE.Group;
  /** True when this is the code-only scene used after an asset failure. */
  readonly isFallback: boolean;
  update(deltaSeconds: number, worldSpeed: number, playerZ: number): void;
  setQuality(quality: QualitySettings): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export interface MapBuildContext {
  definition: MapDefinition;
  quality: QualitySettings;
  reducedMotion: boolean;
  /** Seeded from the run, so a replay of the same run looks the same. */
  rng: Rng;
}

export type MapFactory = (context: MapBuildContext) => MapRuntime;

/**
 * Half-width of the corridor the runner and the gates occupy.
 *
 * Nothing a map builds may intrude on it: scenery starts outside this and has
 * no colliders at all, so a decoration can never block a lane.
 */
export const SAFE_HALF_WIDTH = 6.2;

/** Length along Z of one decoration segment. */
export const SEGMENT_LENGTH = 40;
