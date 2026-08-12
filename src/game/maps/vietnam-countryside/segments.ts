import * as THREE from 'three';
import type { MapMaterialPool } from '../map-materials.ts';
import type { SegmentVariant } from '../MapSegmentPool.ts';
import type { MapBuildContext } from '../map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from '../map-types.ts';
import {
  bambooStalk,
  box,
  cylinder,
  instancedField,
  leafyTree,
  lotus,
  sphere,
  tileRoofHouse,
} from '../primitives.ts';

/**
 * Đường Làng Quê Việt Nam.
 *
 * Rice paddies, bamboo, banana palms, a lotus pond and low red-tiled roofs -
 * the everyday countryside, drawn warm and tidy rather than poor or quaint.
 * Nothing here is borrowed from a generic "East Asian" prop set; every shape is
 * built for this map.
 */
export function buildCountrysideVariants(
  pool: MapMaterialPool,
  context: MapBuildContext,
): SegmentVariant[] {
  const { rng } = context;
  const half = SEGMENT_LENGTH / 2;
  const side = (index: number): number => (index % 2 === 0 ? -1 : 1);
  const outside = (index: number, spread = 10): number =>
    side(index) * (SAFE_HALF_WIDTH + 1.5 + rng.next() * spread);

  /** One paddy: a shallow water bed with thousands of instanced stalks. */
  const paddy = (x: number, color: string): THREE.Group => {
    const group = new THREE.Group();
    const water = box(pool, [22, 0.12, SEGMENT_LENGTH - 2], '#BFD8A8');
    water.position.set(x, 0.06, 0);
    group.add(water);

    const field = instancedField(pool, rng, {
      count: 420,
      color,
      area: { width: 21, depth: SEGMENT_LENGTH - 3 },
      height: 0.9,
    });
    field.position.set(x, 0.1, 0);
    group.add(field);

    // A raised earth path between paddies, the way the fields are divided.
    const bund = box(pool, [22, 0.22, 0.5], '#C9A56B');
    bund.position.set(x, 0.18, -half + 12);
    group.add(bund);

    return group;
  };

  return [
    {
      id: 'green-rice-fields',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        group.add(paddy(-(SAFE_HALF_WIDTH + 12), '#7FB84F'));
        group.add(paddy(SAFE_HALF_WIDTH + 12, '#8CC63F'));
        for (let i = 0; i < 3; i += 1) {
          const stork = new THREE.Group();
          const bodyMesh = sphere(pool, 0.34, '#FFFFFF');
          bodyMesh.scale.set(1.5, 0.8, 0.8);
          const legs = cylinder(pool, 0.04, 0.04, 0.9, '#E8B44A', 4);
          legs.position.y = -0.5;
          stork.add(bodyMesh, legs);
          stork.position.set(outside(i, 14), 1.2, -half + rng.next() * SEGMENT_LENGTH);
          group.add(stork);
        }
        return group;
      },
    },
    {
      id: 'bamboo-gate',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        // A dense bamboo hedge on both shoulders, the classic village edge.
        for (let i = 0; i < 16; i += 1) {
          const stalk = bambooStalk(pool, rng, 0.9 + rng.next() * 0.5);
          stalk.position.set(
            side(i) * (SAFE_HALF_WIDTH + 1 + rng.next() * 3),
            0,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          group.add(stalk);
        }
        return group;
      },
    },
    {
      id: 'lotus-pond',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const pond = box(pool, [18, 0.1, 26], '#88BBD6');
        pond.position.set(-(SAFE_HALF_WIDTH + 10), 0.05, 0);
        group.add(pond);

        for (let i = 0; i < 14; i += 1) {
          const pad = lotus(pool, rng, 0.9 + rng.next() * 0.6);
          pad.position.set(-(SAFE_HALF_WIDTH + 3 + rng.next() * 14), 0.12, -12 + rng.next() * 24);
          group.add(pad);
        }

        for (let i = 0; i < 4; i += 1) {
          const tree = leafyTree(
            pool,
            rng,
            { trunk: '#8A5A3B', leaves: ['#5FA55A', '#78C05F'] },
            1.1,
          );
          tree.position.set(
            SAFE_HALF_WIDTH + 2 + rng.next() * 8,
            0,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          group.add(tree);
        }
        return group;
      },
    },
    {
      id: 'tile-roof-hamlet',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 4; i += 1) {
          const house = tileRoofHouse(pool, rng, 1 + rng.next() * 0.4);
          house.position.set(outside(i, 9), 0, -half + 5 + i * 9);
          house.rotation.y = side(i) * 0.35;
          group.add(house);
        }
        for (let i = 0; i < 5; i += 1) {
          const stalk = bambooStalk(pool, rng, 0.8);
          stalk.position.set(outside(i, 12), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(stalk);
        }
        return group;
      },
    },
    {
      id: 'banana-garden',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 9; i += 1) {
          const palm = new THREE.Group();
          const trunk = cylinder(pool, 0.24, 0.34, 2.6, '#7FA05A', 6);
          trunk.position.y = 1.3;
          palm.add(trunk);

          // Long drooping leaves are what make a banana plant readable.
          for (let leaf = 0; leaf < 6; leaf += 1) {
            const blade = box(pool, [0.7, 0.08, 3.4], '#4E9A4E');
            blade.position.set(0, 2.7, 1.5);
            blade.rotation.set(-0.35, (leaf * Math.PI) / 3, 0);
            palm.add(blade);
          }

          palm.position.set(outside(i, 10), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(palm);
        }
        return group;
      },
    },
    {
      id: 'harvest-fields',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        group.add(paddy(-(SAFE_HALF_WIDTH + 12), '#E3C356'));
        group.add(paddy(SAFE_HALF_WIDTH + 12, '#D8B44A'));

        for (let i = 0; i < 4; i += 1) {
          const stack = cylinder(pool, 0.2, 1.2, 1.8, '#E0BE72', 7);
          stack.position.set(outside(i, 12), 0.9, -half + rng.next() * SEGMENT_LENGTH);
          group.add(stack);
        }
        return group;
      },
    },
  ];
}
