import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from '../map-types.ts';
import { createProceduralMap } from '../createProceduralMap.ts';
import { cone, tileRoofHouse } from '../primitives.ts';
import { buildCountrysideVariants } from './segments.ts';

/** Map 2 - Đường Làng Quê Việt Nam. */
export function createVietnamCountryside(context: MapBuildContext): MapRuntime {
  return createProceduralMap(context, {
    buildVariants: (pool, ctx) => buildCountrysideVariants(pool, ctx),
    buildBackdrop: (pool, ctx) => {
      const group = new THREE.Group();
      group.name = 'countryside-landmark';

      // A pale blue-green range of hills closes the horizon.
      for (let i = 0; i < 7; i += 1) {
        const hill = cone(pool, 16 + ctx.rng.next() * 12, 12 + ctx.rng.next() * 10, '#8FB98A', 5);
        hill.position.set(-70 + i * 24 + ctx.rng.next() * 6, 4, -ctx.rng.next() * 30);
        group.add(hill);
      }

      // A cluster of tiled roofs in the middle distance: the village itself.
      for (let i = 0; i < 5; i += 1) {
        const house = tileRoofHouse(pool, ctx.rng, 2.4);
        house.position.set(-40 + i * 18 + ctx.rng.next() * 6, 0, 20 + ctx.rng.next() * 12);
        house.rotation.y = ctx.rng.next() * 0.6 - 0.3;
        group.add(house);
      }

      return group;
    },
    backdropDistance: 210,
  });
}
