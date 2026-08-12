import * as THREE from 'three';
import type { MapBuildContext, MapRuntime } from '../map-types.ts';
import { createProceduralMap } from '../createProceduralMap.ts';
import { planet, sphere } from '../primitives.ts';
import { buildCosmicVariants } from './segments.ts';

/** Map 3 - Đường Không Gian Vũ Trụ. */
export function createCosmicOrbit(context: MapBuildContext): MapRuntime {
  return createProceduralMap(context, {
    buildVariants: (pool, ctx) => buildCosmicVariants(pool, ctx),
    buildBackdrop: (pool, ctx) => {
      const group = new THREE.Group();
      group.name = 'cosmic-landmark';

      const giant = planet(pool, 34, '#6E7FE0', '#F2C879');
      giant.position.set(-46, 30, 0);
      group.add(giant);

      const moon = planet(pool, 9, '#D6DCF5');
      moon.position.set(52, 22, 20);
      group.add(moon);

      // A far starfield built from a handful of unlit points of light.
      for (let i = 0; i < 40; i += 1) {
        const star = sphere(pool, 0.5 + ctx.rng.next() * 0.5, '#FFFFFF', { glow: true });
        star.position.set(
          (ctx.rng.next() - 0.5) * 260,
          6 + ctx.rng.next() * 70,
          -20 + ctx.rng.next() * 40,
        );
        group.add(star);
      }

      return group;
    },
    backdropDistance: 230,
  });
}
