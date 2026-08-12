import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from './map-types.ts';
import { MapMaterialPool } from './map-materials.ts';
import { MapParticles } from './MapParticles.ts';
import { MapSegmentPool } from './MapSegmentPool.ts';
import type { SegmentVariant } from './MapSegmentPool.ts';
import type { QualitySettings } from '../../scene/quality.ts';
import { asScenery } from './primitives.ts';

/** How far behind the player a segment may fall before it is recycled. */
const RECYCLE_BEHIND = 45;

export interface ProceduralMapSpec {
  /** Roadside variants, at least five per the map specification. */
  buildVariants(pool: MapMaterialPool, context: MapBuildContext): SegmentVariant[];
  /**
   * The far landmark: a rainbow, a ringed planet, a castle. It is kept a fixed
   * distance ahead of the player so it never arrives and never disappears.
   */
  buildBackdrop?(pool: MapMaterialPool, context: MapBuildContext): THREE.Object3D;
  /** Distance ahead of the player the backdrop sits at. */
  backdropDistance?: number;
}

/**
 * Builds a map runtime from primitives.
 *
 * Every map is the same three things - recycled roadside segments, a landmark
 * that follows the player, and an ambient particle layer - so the differences
 * between the five maps stay in what they draw, not in how they behave.
 */
export function createProceduralMap(context: MapBuildContext, spec: ProceduralMapSpec): MapRuntime {
  const pool = new MapMaterialPool();
  const root = new THREE.Group();
  root.name = `map:${context.definition.id}`;

  const segments = new MapSegmentPool(spec.buildVariants(pool, context), context.rng);
  root.add(segments.group);

  const particles = new MapParticles(
    context.definition.particlePreset,
    context.rng,
    context.quality,
  );
  particles.setReducedMotion(context.reducedMotion);
  root.add(particles.points);

  const backdropDistance = spec.backdropDistance ?? 190;
  const backdrop = spec.buildBackdrop?.(pool, context) ?? null;
  if (backdrop !== null) {
    asScenery(backdrop);
    root.add(backdrop);
  }

  return {
    id: context.definition.id,
    root,
    isFallback: false,

    update(delta: number, _worldSpeed: number, playerZ: number): void {
      segments.update(playerZ, RECYCLE_BEHIND);
      particles.update(delta, playerZ);
      if (backdrop !== null) {
        backdrop.position.z = playerZ - backdropDistance;
      }
    },

    setQuality(quality: QualitySettings): void {
      particles.setQuality(quality);
    },

    setReducedMotion(reduced: boolean): void {
      particles.setReducedMotion(reduced);
    },

    dispose(): void {
      segments.dispose();
      particles.dispose();
      root.clear();
      // Materials and geometries are owned by this map alone, so nothing else
      // in the scene can be holding on to them.
      pool.dispose();
    },
  };
}
