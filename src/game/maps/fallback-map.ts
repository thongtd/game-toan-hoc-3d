import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from './map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from './map-types.ts';
import { MapMaterialPool } from './map-materials.ts';
import { MapSegmentPool } from './MapSegmentPool.ts';
import { cloudPuff, cone, cylinder, sphere } from './primitives.ts';

/**
 * The road that always works.
 *
 * Built from primitives with no external file of any kind, so it cannot fail to
 * load. When a map's scenery breaks, the run continues here rather than on a
 * black screen - and the run keeps the map id the server issued, so the record
 * of what was played stays honest.
 */
export function createFallbackMap(context: MapBuildContext): MapRuntime {
  const pool = new MapMaterialPool();
  const root = new THREE.Group();
  root.name = 'map:fallback';

  const half = SEGMENT_LENGTH / 2;
  const { rng } = context;

  const variants = [0, 1, 2].map((variantIndex) => ({
    id: `fallback-${String(variantIndex)}`,
    build(): THREE.Object3D {
      const group = new THREE.Group();

      for (let i = 0; i < 5; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * (SAFE_HALF_WIDTH + 2 + rng.next() * 6);
        const z = -half + rng.next() * SEGMENT_LENGTH;

        if (variantIndex === 2) {
          const rock = sphere(pool, 0.8 + rng.next() * 0.6, '#B9C2CC');
          rock.position.set(x, 0.4, z);
          group.add(rock);
          continue;
        }

        const trunk = cylinder(pool, 0.22, 0.3, 2.4, '#8A5A3B', 6);
        trunk.position.set(x, 1.2, z);
        group.add(trunk);

        const crown = cone(pool, 1.4, 2.6, '#6FAE63', 6);
        crown.position.set(x, 3.4, z);
        group.add(crown);
      }

      const cloud = cloudPuff(pool, rng, '#FFFFFF', 1.4);
      cloud.position.set(
        (rng.next() - 0.5) * 30,
        12 + rng.next() * 6,
        -half + rng.next() * SEGMENT_LENGTH,
      );
      group.add(cloud);

      return group;
    },
  }));

  const segments = new MapSegmentPool(variants, rng, { slots: 5, spares: 1 });
  root.add(segments.group);

  return {
    id: context.definition.id,
    root,
    isFallback: true,

    update(_delta: number, _worldSpeed: number, playerZ: number): void {
      segments.update(playerZ, 45);
    },
    setQuality(): void {
      // Nothing to scale: the fallback is already the cheapest scene there is.
    },
    setReducedMotion(): void {
      // Nothing in the fallback moves on its own.
    },
    dispose(): void {
      segments.dispose();
      root.clear();
      pool.dispose();
    },
  };
}
