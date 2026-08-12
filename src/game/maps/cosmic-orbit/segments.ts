import * as THREE from 'three';
import type { MapMaterialPool } from '../map-materials.ts';
import type { SegmentVariant } from '../MapSegmentPool.ts';
import type { MapBuildContext } from '../map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from '../map-types.ts';
import { box, cylinder, planet, satellite, sphere, torus } from '../primitives.ts';

/**
 * Đường Không Gian Vũ Trụ.
 *
 * Neon trim and deep blue, but nothing strobes, nothing sweeps across the
 * screen and no asteroid ever enters the corridor: it is a calm orbit, not a
 * shooter.
 */
export function buildCosmicVariants(
  pool: MapMaterialPool,
  context: MapBuildContext,
): SegmentVariant[] {
  const { rng } = context;
  const half = SEGMENT_LENGTH / 2;
  const side = (index: number): number => (index % 2 === 0 ? -1 : 1);
  const outside = (index: number, spread = 10): number =>
    side(index) * (SAFE_HALF_WIDTH + 2 + rng.next() * spread);

  return [
    {
      id: 'orbital-station',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 2; i += 1) {
          const module = new THREE.Group();
          const hull = cylinder(pool, 1.5, 1.5, 6, '#D7E2FF', 10);
          hull.rotation.z = Math.PI / 2;
          module.add(hull);

          const ring = torus(pool, 2.6, 0.22, '#4DE3F5', { glow: true, segments: 22 });
          module.add(ring);

          for (const panelSide of [-1, 1] as const) {
            const panel = box(pool, [0.1, 2.2, 4], '#31489F');
            panel.position.x = panelSide * 3.6;
            module.add(panel);
          }

          module.position.set(outside(i, 6), 4 + rng.next() * 5, -half + 8 + i * 20);
          module.rotation.y = rng.next() * 0.6;
          group.add(module);
        }
        return group;
      },
    },
    {
      id: 'ringed-planet-pass',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const body = planet(pool, 7 + rng.next() * 3, '#8C6BD8', '#F2C879');
        body.position.set(side(0) * 26, 10, -half + 14);
        group.add(body);

        const moon = planet(pool, 2, '#CBD5F0');
        moon.position.set(side(1) * 18, 15, -half + 30);
        group.add(moon);
        return group;
      },
    },
    {
      id: 'satellite-alley',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 5; i += 1) {
          const unit = satellite(pool, 0.8 + rng.next() * 0.5);
          unit.position.set(outside(i, 8), 3 + rng.next() * 8, -half + rng.next() * SEGMENT_LENGTH);
          unit.rotation.set(rng.next(), rng.next() * Math.PI, 0);
          group.add(unit);
        }
        return group;
      },
    },
    {
      id: 'safe-asteroid-field',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        // Well outside the corridor and well above it: scenery, not obstacles.
        for (let i = 0; i < 14; i += 1) {
          const rock = sphere(pool, 0.6 + rng.next() * 1.6, '#5A639B', { detail: 0 });
          rock.scale.set(1, 0.7 + rng.next() * 0.5, 0.9);
          rock.position.set(
            outside(i, 16),
            1 + rng.next() * 14,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          rock.rotation.set(rng.next(), rng.next(), rng.next());
          group.add(rock);
        }
        return group;
      },
    },
    {
      id: 'comet-viewpoint',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 3; i += 1) {
          const comet = new THREE.Group();
          const head = sphere(pool, 0.8, '#BFF7FF', { glow: true });
          comet.add(head);

          // A tapering tail of shrinking, dimming spheres.
          for (let t = 1; t <= 5; t += 1) {
            const piece = sphere(pool, 0.8 - t * 0.13, '#7FE6FF', { glow: true });
            piece.position.z = t * 1.1;
            comet.add(piece);
          }

          comet.position.set(
            outside(i, 14),
            8 + rng.next() * 10,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          comet.rotation.y = rng.next() * 0.8 - 0.4;
          group.add(comet);
        }

        for (let i = 0; i < 4; i += 1) {
          const beacon = sphere(pool, 0.3, '#FFE9A8', { glow: true });
          beacon.position.set(outside(i, 4), 1.2, -half + rng.next() * SEGMENT_LENGTH);
          group.add(beacon);
        }
        return group;
      },
    },
  ];
}
