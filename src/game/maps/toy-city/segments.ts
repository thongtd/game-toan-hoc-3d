import * as THREE from 'three';
import type { MapMaterialPool } from '../map-materials.ts';
import type { SegmentVariant } from '../MapSegmentPool.ts';
import type { MapBuildContext } from '../map-types.ts';
import { SAFE_HALF_WIDTH, SEGMENT_LENGTH } from '../map-types.ts';
import { blockStack, box, cone, cylinder, sphere, toyHouse } from '../primitives.ts';

/**
 * Thành Phố Đồ Chơi.
 *
 * A race track laid out on a giant playroom floor. Every vehicle here is a
 * parked toy: nothing drives across the corridor, and nothing is a weapon.
 */
export function buildToyCityVariants(
  pool: MapMaterialPool,
  context: MapBuildContext,
): SegmentVariant[] {
  const { rng } = context;
  const half = SEGMENT_LENGTH / 2;
  const side = (index: number): number => (index % 2 === 0 ? -1 : 1);
  const outside = (index: number, spread = 9): number =>
    side(index) * (SAFE_HALF_WIDTH + 1.5 + rng.next() * spread);

  const brickColors = ['#F2564B', '#F7B32B', '#3FA7D6', '#59CD90', '#B084F5'];

  /** A blocky toy car: body, cabin and four wheels. */
  const toyCar = (color: string, scale: number): THREE.Group => {
    const car = new THREE.Group();
    const body = box(pool, [1.6 * scale, 0.6 * scale, 3 * scale], color);
    body.position.y = 0.6 * scale;
    car.add(body);

    const cabin = box(pool, [1.3 * scale, 0.6 * scale, 1.3 * scale], '#EAF2FA');
    cabin.position.set(0, 1.15 * scale, -0.2 * scale);
    car.add(cabin);

    for (const [dx, dz] of [
      [-0.85, -1],
      [0.85, -1],
      [-0.85, 1],
      [0.85, 1],
    ] as const) {
      const wheel = cylinder(pool, 0.34 * scale, 0.34 * scale, 0.24 * scale, '#3A3F44', 8);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx * scale, 0.34 * scale, dz * scale);
      car.add(wheel);
    }

    return car;
  };

  return [
    {
      id: 'building-block-boulevard',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 8; i += 1) {
          const stack = blockStack(pool, rng, brickColors, 1.1 + rng.next() * 0.8);
          stack.position.set(outside(i), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(stack);
        }
        return group;
      },
    },
    {
      id: 'tiny-garage',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 2; i += 1) {
          const garage = new THREE.Group();
          const shell = box(pool, [5, 3, 4], '#F7E7C6');
          shell.position.y = 1.5;
          garage.add(shell);

          const roof = box(pool, [5.4, 0.4, 4.4], '#F2564B');
          roof.position.y = 3.2;
          garage.add(roof);

          const opening = box(pool, [3.2, 2.2, 0.16], '#4A5568');
          opening.position.set(0, 1.1, 2.05);
          garage.add(opening);

          garage.position.set(outside(i, 5), 0, -half + 8 + i * 20);
          garage.rotation.y = side(i) * 0.3;
          garage.add(toyCar(rng.pick(brickColors), 0.9));
          group.add(garage);
        }
        return group;
      },
    },
    {
      id: 'toy-train-park',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const rail = box(pool, [0.5, 0.16, SEGMENT_LENGTH - 2], '#B4784A');
        rail.position.set(-(SAFE_HALF_WIDTH + 6), 0.1, 0);
        group.add(rail);

        // Sleepers, then a parked train beside them - never on the road.
        for (let i = 0; i < 10; i += 1) {
          const sleeper = box(pool, [1.8, 0.12, 0.4], '#8A5A3B');
          sleeper.position.set(-(SAFE_HALF_WIDTH + 6), 0.06, -half + 2 + i * 4);
          group.add(sleeper);
        }

        const train = new THREE.Group();
        const engine = box(pool, [1.6, 1.4, 3], '#3FA7D6');
        engine.position.y = 0.9;
        train.add(engine);
        const funnel = cylinder(pool, 0.28, 0.28, 1, '#F2564B', 8);
        funnel.position.set(0, 2.1, -1);
        train.add(funnel);
        train.position.set(-(SAFE_HALF_WIDTH + 6), 0.2, -half + 12);
        group.add(train);

        for (let i = 0; i < 4; i += 1) {
          const house = toyHouse(
            pool,
            rng,
            rng.pick(['#FFD9E0', '#D9F0FF', '#FFF3C4']),
            '#F2564B',
            1.1,
          );
          house.position.set(
            SAFE_HALF_WIDTH + 3 + rng.next() * 7,
            0,
            -half + rng.next() * SEGMENT_LENGTH,
          );
          group.add(house);
        }
        return group;
      },
    },
    {
      id: 'traffic-cone-plaza',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        for (let i = 0; i < 12; i += 1) {
          const coneMesh = cone(pool, 0.45, 1.2, '#F97316', 8);
          coneMesh.position.set(outside(i, 6), 0.6, -half + rng.next() * SEGMENT_LENGTH);
          group.add(coneMesh);

          const band = cylinder(pool, 0.3, 0.3, 0.18, '#FFFFFF', 8);
          band.position.copy(coneMesh.position);
          band.position.y = 0.72;
          group.add(band);
        }

        for (let i = 0; i < 3; i += 1) {
          const sign = new THREE.Group();
          const post = cylinder(pool, 0.08, 0.08, 2.2, '#94A3B8', 6);
          post.position.y = 1.1;
          sign.add(post);
          const board = box(pool, [1.1, 1.1, 0.1], '#3FA7D6');
          board.position.y = 2.4;
          sign.add(board);
          sign.position.set(outside(i, 4), 0, -half + rng.next() * SEGMENT_LENGTH);
          group.add(sign);
        }
        return group;
      },
    },
    {
      id: 'mini-airport-view',
      build(): THREE.Object3D {
        const group = new THREE.Group();
        const apron = box(pool, [16, 0.12, 22], '#DCE3EC');
        apron.position.set(SAFE_HALF_WIDTH + 10, 0.06, 0);
        group.add(apron);

        const plane = new THREE.Group();
        const fuselage = cylinder(pool, 0.6, 0.6, 5, '#FFFFFF', 10);
        fuselage.rotation.x = Math.PI / 2;
        plane.add(fuselage);
        const wing = box(pool, [6, 0.16, 1.2], '#F7B32B');
        plane.add(wing);
        const tail = box(pool, [0.16, 1.4, 1], '#F2564B');
        tail.position.set(0, 0.8, 2.2);
        plane.add(tail);
        plane.position.set(SAFE_HALF_WIDTH + 10, 1.2, -half + 14);
        plane.rotation.y = 0.5;
        group.add(plane);

        const tower = new THREE.Group();
        const shaft = cylinder(pool, 0.9, 1.1, 6, '#EAF2FA', 8);
        shaft.position.y = 3;
        tower.add(shaft);
        const cabin = sphere(pool, 1.4, '#3FA7D6');
        cabin.scale.y = 0.7;
        cabin.position.y = 6.4;
        tower.add(cabin);
        tower.position.set(-(SAFE_HALF_WIDTH + 5), 0, -half + 8);
        group.add(tower);

        return group;
      },
    },
  ];
}
