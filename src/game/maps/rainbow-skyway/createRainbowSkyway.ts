import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from '../map-types.ts';
import { createProceduralMap } from '../createProceduralMap.ts';
import { cloudPuff, rainbowArch } from '../primitives.ts';
import { buildRainbowVariants } from './segments.ts';

/** Map 1 - Đường Cầu Vồng. The reference implementation for the other four. */
export function createRainbowSkyway(context: MapBuildContext): MapRuntime {
  return createProceduralMap(context, {
    buildVariants: (pool, ctx) => buildRainbowVariants(pool, ctx),
    buildBackdrop: (pool, ctx) => {
      const group = new THREE.Group();
      group.name = 'rainbow-landmark';

      // One enormous arch on the horizon: the thing you are running towards.
      const arch = rainbowArch(pool, 46, 1);
      arch.position.y = 0;
      group.add(arch);

      for (let i = 0; i < 6; i += 1) {
        const cloud = cloudPuff(pool, ctx.rng, '#FFFFFF', 3 + ctx.rng.next() * 2);
        cloud.position.set(
          (ctx.rng.next() - 0.5) * 120,
          6 + ctx.rng.next() * 26,
          ctx.rng.next() * 40,
        );
        group.add(cloud);
      }

      return group;
    },
  });
}
