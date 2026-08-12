import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from '../map-types.ts';
import { createProceduralMap } from '../createProceduralMap.ts';
import { cone, cylinder, leafyTree } from '../primitives.ts';
import { buildForestVariants } from './segments.ts';

/** Map 4 - Rừng Cổ Tích. */
export function createEnchantedForest(context: MapBuildContext): MapRuntime {
  return createProceduralMap(context, {
    buildVariants: (pool, ctx) => buildForestVariants(pool, ctx),
    buildBackdrop: (pool, ctx) => {
      const group = new THREE.Group();
      group.name = 'forest-landmark';

      // A pale castle on a distant hill, the promise at the end of the road.
      const hill = cone(pool, 34, 22, '#8FB98A', 6);
      hill.position.set(0, 4, 0);
      group.add(hill);

      for (let i = 0; i < 4; i += 1) {
        const tower = cylinder(pool, 2.2, 2.6, 14 + i * 3, '#EDE8F7', 8);
        tower.position.set(-9 + i * 6, 20 + (14 + i * 3) / 2, 0);
        group.add(tower);

        const roof = cone(pool, 3.2, 5, '#A98CE8', 8);
        roof.position.set(-9 + i * 6, 20 + 14 + i * 3 + 2.5, 0);
        group.add(roof);
      }

      for (let i = 0; i < 10; i += 1) {
        const tree = leafyTree(pool, ctx.rng, { trunk: '#6B4E38', leaves: ['#5E9C57'] }, 3);
        tree.position.set((ctx.rng.next() - 0.5) * 150, 0, 20 + ctx.rng.next() * 30);
        group.add(tree);
      }

      return group;
    },
    backdropDistance: 200,
  });
}
