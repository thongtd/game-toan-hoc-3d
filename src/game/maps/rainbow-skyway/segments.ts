import * as THREE from 'three';
import type { MapMaterialPool } from '../map-materials.ts';
import type { SegmentVariant } from '../MapSegmentPool.ts';
import type { MapBuildContext } from '../map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from '../map-types.ts';
import { box, cloudPuff, cylinder, rainbowArch, sphere, torus } from '../primitives.ts';

/**
 * Đường Cầu Vồng - a road suspended in a bright sky.
 *
 * Everything sits above or beside the corridor, never in it, and the arches are
 * deliberately much wider and higher than an answer gate so a decoration can
 * never be mistaken for the thing you are supposed to run through.
 */
export function buildRainbowVariants(
  pool: MapMaterialPool,
  context: MapBuildContext,
): SegmentVariant[] {
  const { rng } = context;
  const half = SEGMENT_LENGTH / 2;

  const outside = (index: number): number =>
    (index % 2 === 0 ? -1 : 1) * (SAFE_HALF_WIDTH + 2 + rng.next() * 8);

  return [
    {
      id: 'cloud-islands',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 7; i += 1) {
          const cloud = cloudPuff(pool, rng, '#FFFFFF', 1 + rng.next() * 0.8);
          cloud.position.set(outside(i), -2 + rng.next() * 9, -half + rng.next() * SEGMENT_LENGTH);
          group.add(cloud);
        }
        return group;
      },
    },
    {
      id: 'rainbow-arches',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 2; i += 1) {
          // Wide enough to frame the whole road, so it never lines up with a gate.
          const arch = rainbowArch(pool, 15, 1);
          arch.position.set(0, 1.5, -half + 8 + i * 22);
          group.add(arch);
        }
        for (let i = 0; i < 3; i += 1) {
          const cloud = cloudPuff(pool, rng, '#FFFFFF', 0.9);
          cloud.position.set(outside(i), 4 + rng.next() * 4, -half + rng.next() * SEGMENT_LENGTH);
          group.add(cloud);
        }
        return group;
      },
    },
    {
      id: 'star-garden',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 12; i += 1) {
          const star = sphere(pool, 0.34 + rng.next() * 0.3, '#FFF3B0', { glow: true });
          star.position.set(outside(i), 2 + rng.next() * 12, -half + rng.next() * SEGMENT_LENGTH);
          group.add(star);
        }
        for (let i = 0; i < 3; i += 1) {
          const ring = torus(pool, 1.5 + rng.next(), 0.14, '#8CD9FF', { glow: true });
          ring.position.set(
            outside(i + 1),
            5 + rng.next() * 6,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          ring.rotation.set(rng.next(), rng.next(), 0);
          group.add(ring);
        }
        return group;
      },
    },
    {
      id: 'balloon-valley',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const colors = ['#FF8FA3', '#FFD166', '#8CD9FF', '#B39DFF', '#8CE0A8'];
        for (let i = 0; i < 8; i += 1) {
          const balloon = new THREE.Group();
          const skin = sphere(pool, 0.9 + rng.next() * 0.4, rng.pick(colors));
          skin.scale.y = 1.25;
          balloon.add(skin);

          const basket = box(pool, [0.5, 0.4, 0.5], '#C98B4B');
          basket.position.y = -1.9;
          balloon.add(basket);

          const rope = cylinder(pool, 0.03, 0.03, 1.2, '#EADCC0', 4);
          rope.position.y = -1.25;
          balloon.add(rope);

          balloon.position.set(outside(i), 3 + rng.next() * 9, -half + rng.next() * SEGMENT_LENGTH);
          group.add(balloon);
        }
        return group;
      },
    },
    {
      id: 'sunny-windmills',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 4; i += 1) {
          const mill = new THREE.Group();
          const tower = cylinder(pool, 0.5, 0.9, 4.5, '#FFF1D0', 8);
          tower.position.y = 2.25;
          mill.add(tower);

          const cap = sphere(pool, 0.85, '#FF8FA3');
          cap.scale.y = 0.7;
          cap.position.y = 4.6;
          mill.add(cap);

          for (let blade = 0; blade < 4; blade += 1) {
            const wing = box(pool, [0.24, 2.6, 0.08], '#FFFFFF');
            wing.position.set(0, 4.2, 0.9);
            wing.rotation.z = (blade * Math.PI) / 2;
            wing.translateY(1.3);
            mill.add(wing);
          }

          const cloud = cloudPuff(pool, rng, '#FFFFFF', 0.7);
          cloud.position.set(0, 7 + rng.next() * 3, 0);
          mill.add(cloud);

          mill.position.set(outside(i), -1, -half + 6 + i * 9 + rng.next() * 3);
          group.add(mill);
        }
        return group;
      },
    },
  ];
}
