import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from '../map-types.ts';
import { createProceduralMap } from '../createProceduralMap.ts';
import { blockStack, cylinder, torus, toyHouse } from '../primitives.ts';
import { buildToyCityVariants } from './segments.ts';

/** Map 5 - Thành Phố Đồ Chơi. */
export function createToyCity(context: MapBuildContext): MapRuntime {
  return createProceduralMap(context, {
    buildVariants: (pool, ctx) => buildToyCityVariants(pool, ctx),
    buildBackdrop: (pool, ctx) => {
      const group = new THREE.Group();
      group.name = 'toy-city-landmark';

      // A tower of building blocks and a fairground wheel close the view.
      const tower = blockStack(pool, ctx.rng, ['#F2564B', '#F7B32B', '#3FA7D6', '#59CD90'], 9);
      tower.position.set(-24, 0, 0);
      group.add(tower);

      const wheel = torus(pool, 16, 0.9, '#F7B32B', { segments: 28 });
      wheel.position.set(30, 18, 6);
      group.add(wheel);

      for (let i = 0; i < 8; i += 1) {
        const spoke = cylinder(pool, 0.25, 0.25, 32, '#EAF2FA', 6);
        spoke.position.set(30, 18, 6);
        spoke.rotation.z = (i * Math.PI) / 8;
        group.add(spoke);
      }

      for (let i = 0; i < 8; i += 1) {
        const house = toyHouse(pool, ctx.rng, '#FFE7C4', '#3FA7D6', 3);
        house.position.set(-70 + i * 20 + ctx.rng.next() * 5, 0, 22 + ctx.rng.next() * 14);
        group.add(house);
      }

      return group;
    },
    backdropDistance: 200,
  });
}
