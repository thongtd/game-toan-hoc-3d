import * as THREE from 'three';
import type { MapMaterialPool } from '../map-materials.ts';
import type { SegmentVariant } from '../MapSegmentPool.ts';
import type { MapBuildContext } from '../map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from '../map-types.ts';
import { box, cone, cylinder, leafyTree, mushroom, sphere, torus } from '../primitives.ts';

/**
 * Rừng Cổ Tích.
 *
 * Storybook, not spooky: the canopy is kept high so it never covers the HUD,
 * the palette stays light, and the fireflies drift instead of blinking.
 */
export function buildForestVariants(
  pool: MapMaterialPool,
  context: MapBuildContext,
): SegmentVariant[] {
  const { rng } = context;
  const half = SEGMENT_LENGTH / 2;
  const side = (index: number): number => (index % 2 === 0 ? -1 : 1);
  const outside = (index: number, spread = 10): number =>
    side(index) * (SAFE_HALF_WIDTH + 1.5 + rng.next() * spread);

  const capColors = ['#E86B87', '#F0A05A', '#B58CE8', '#EF8FB8'];

  return [
    {
      id: 'giant-mushroom-grove',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 10; i += 1) {
          const cap = mushroom(pool, rng, rng.pick(capColors), 1.2 + rng.next() * 1.4);
          cap.position.set(outside(i, 9), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(cap);
        }
        for (let i = 0; i < 4; i += 1) {
          const tree = leafyTree(
            pool,
            rng,
            { trunk: '#7A5A42', leaves: ['#6FAE63', '#8FC97A'] },
            1.6,
          );
          tree.position.set(outside(i, 12), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(tree);
        }
        return group;
      },
    },
    {
      id: 'crystal-brook',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const brook = box(pool, [10, 0.1, SEGMENT_LENGTH - 4], '#A6D8EA');
        brook.position.set(-(SAFE_HALF_WIDTH + 7), 0.05, 0);
        group.add(brook);

        for (let i = 0; i < 10; i += 1) {
          const crystal = cone(pool, 0.4 + rng.next() * 0.4, 1.6 + rng.next() * 1.6, '#9BE8E0', 5);
          crystal.position.set(outside(i, 10), 0.8, -half + rng.next() * SEGMENT_LENGTH);
          crystal.rotation.z = (rng.next() - 0.5) * 0.4;
          group.add(crystal);
        }

        for (let i = 0; i < 4; i += 1) {
          const stone = sphere(pool, 0.5 + rng.next() * 0.5, '#B9AE9B');
          stone.scale.y = 0.6;
          stone.position.set(
            -(SAFE_HALF_WIDTH + 2 + rng.next() * 8),
            0.2,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          group.add(stone);
        }
        return group;
      },
    },
    {
      id: 'flower-archway',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 2; i += 1) {
          // Much wider than the road so it frames the scene, never a gate.
          const arch = torus(pool, 13, 0.5, '#9CC97F', { arc: Math.PI, segments: 18 });
          arch.position.set(0, 0.5, -half + 10 + i * 20);
          group.add(arch);

          for (let f = 0; f < 10; f += 1) {
            const angle = (f / 9) * Math.PI;
            const flower = sphere(pool, 0.55, rng.pick(['#F2A6C2', '#F6D06B', '#C5A6F2']));
            flower.position.set(
              Math.cos(angle) * 13,
              0.5 + Math.sin(angle) * 13,
              -half + 10 + i * 20,
            );
            group.add(flower);
          }
        }
        return group;
      },
    },
    {
      id: 'firefly-hollow',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 5; i += 1) {
          const tree = leafyTree(
            pool,
            rng,
            { trunk: '#6B4E38', leaves: ['#5E9C57', '#7FBE6E'] },
            2,
          );
          tree.position.set(outside(i, 8), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(tree);
        }
        for (let i = 0; i < 14; i += 1) {
          const spark = sphere(pool, 0.18, '#FFE58A', { glow: true });
          spark.position.set(
            outside(i, 10),
            1 + rng.next() * 5,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          group.add(spark);
        }
        return group;
      },
    },
    {
      id: 'castle-overlook',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const castle = new THREE.Group();

        for (let i = 0; i < 3; i += 1) {
          const tower = cylinder(pool, 1.4, 1.7, 8 + i * 2, '#E4E0F2', 8);
          tower.position.set(i * 4 - 4, (8 + i * 2) / 2, 0);
          castle.add(tower);

          const roof = cone(pool, 2, 3.2, '#8C6BD8', 8);
          roof.position.set(i * 4 - 4, 8 + i * 2 + 1.6, 0);
          castle.add(roof);
        }

        castle.position.set(side(0) * 26, 0, -half + 16);
        castle.rotation.y = 0.4;
        group.add(castle);

        for (let i = 0; i < 5; i += 1) {
          const cap = mushroom(pool, rng, rng.pick(capColors), 1);
          cap.position.set(outside(i + 1, 8), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(cap);
        }
        return group;
      },
    },
  ];
}
