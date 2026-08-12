import * as THREE from 'three';
import type { MapMaterialPool } from './map-materials.ts';
import type { Rng } from '../../../shared/math/seeded-rng.ts';

/**
 * The parts every map is built from.
 *
 * All scenery is generated from Three.js primitives rather than downloaded
 * model packs: it keeps the download budget at zero extra megabytes, the
 * licence question closed, and every prop the project's own work.
 */

/** Marks a mesh as scenery: it never casts shadows and never has a collider. */
export function asScenery(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = false;
    child.receiveShadow = false;
    child.matrixAutoUpdate = false;
    child.updateMatrix();
  });
  return object;
}

export function box(
  pool: MapMaterialPool,
  size: readonly [number, number, number],
  color: string | number,
  options: { glow?: boolean } = {},
): THREE.Mesh {
  const geometry = pool.own(new THREE.BoxGeometry(size[0], size[1], size[2]));
  const material = options.glow === true ? pool.glow(color) : pool.standard(color);
  return new THREE.Mesh(geometry, material);
}

export function sphere(
  pool: MapMaterialPool,
  radius: number,
  color: string | number,
  options: { glow?: boolean; detail?: number } = {},
): THREE.Mesh {
  const detail = options.detail ?? 0;
  const geometry = pool.own(new THREE.IcosahedronGeometry(radius, detail));
  const material = options.glow === true ? pool.glow(color) : pool.standard(color);
  return new THREE.Mesh(geometry, material);
}

export function cylinder(
  pool: MapMaterialPool,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: string | number,
  segments = 8,
): THREE.Mesh {
  const geometry = pool.own(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
  return new THREE.Mesh(geometry, pool.standard(color));
}

export function cone(
  pool: MapMaterialPool,
  radius: number,
  height: number,
  color: string | number,
  segments = 7,
): THREE.Mesh {
  const geometry = pool.own(new THREE.ConeGeometry(radius, height, segments));
  return new THREE.Mesh(geometry, pool.standard(color));
}

export function torus(
  pool: MapMaterialPool,
  radius: number,
  tube: number,
  color: string | number,
  options: { arc?: number; glow?: boolean; segments?: number } = {},
): THREE.Mesh {
  const geometry = pool.own(
    new THREE.TorusGeometry(radius, tube, 6, options.segments ?? 18, options.arc ?? Math.PI * 2),
  );
  const material = options.glow === true ? pool.glow(color) : pool.standard(color);
  return new THREE.Mesh(geometry, material);
}

/** A leafy tree: trunk plus one to three stacked crowns. */
export function leafyTree(
  pool: MapMaterialPool,
  rng: Rng,
  colors: { trunk: string; leaves: readonly string[] },
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const trunkHeight = (2.2 + rng.next() * 1.4) * scale;
  const trunk = cylinder(pool, 0.22 * scale, 0.32 * scale, trunkHeight, colors.trunk, 6);
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const crowns = 2 + Math.floor(rng.next() * 2);
  const leafColor = rng.pick([...colors.leaves]);
  for (let i = 0; i < crowns; i += 1) {
    const radius = (1.5 - i * 0.32) * scale;
    const crown = sphere(pool, radius, leafColor);
    crown.position.y = trunkHeight + i * 0.9 * scale;
    crown.rotation.y = rng.next() * Math.PI;
    group.add(crown);
  }

  return group;
}

/** A stalk of bamboo: a few segments with a leafy tuft on top. */
export function bambooStalk(pool: MapMaterialPool, rng: Rng, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const joints = 4 + Math.floor(rng.next() * 3);
  const jointHeight = 1.1 * scale;

  for (let i = 0; i < joints; i += 1) {
    const segment = cylinder(pool, 0.13 * scale, 0.15 * scale, jointHeight * 0.94, '#6DA544', 6);
    segment.position.y = jointHeight * (i + 0.5);
    group.add(segment);
  }

  for (let i = 0; i < 4; i += 1) {
    const leaf = box(pool, [1.5 * scale, 0.06, 0.28 * scale], '#8CC63F');
    leaf.position.set(0.6 * scale, jointHeight * joints - i * 0.4 * scale, 0);
    leaf.rotation.set(0, (i * Math.PI) / 2 + rng.next(), -0.35);
    group.add(leaf);
  }

  return group;
}

/** A round-cap mushroom, the signature prop of the enchanted forest. */
export function mushroom(
  pool: MapMaterialPool,
  rng: Rng,
  capColor: string,
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const stemHeight = (1.6 + rng.next() * 1.6) * scale;
  const stem = cylinder(pool, 0.32 * scale, 0.46 * scale, stemHeight, '#F3E6CE', 7);
  stem.position.y = stemHeight / 2;
  group.add(stem);

  const cap = sphere(pool, 1.15 * scale, capColor);
  cap.scale.set(1, 0.6, 1);
  cap.position.y = stemHeight + 0.28 * scale;
  group.add(cap);

  for (let i = 0; i < 3; i += 1) {
    const dot = sphere(pool, 0.16 * scale, '#FFF6E0');
    const angle = rng.next() * Math.PI * 2;
    dot.position.set(
      Math.cos(angle) * 0.62 * scale,
      stemHeight + 0.52 * scale,
      Math.sin(angle) * 0.62 * scale,
    );
    group.add(dot);
  }

  return group;
}

/** A pastel toy house with a pitched roof. */
export function toyHouse(
  pool: MapMaterialPool,
  rng: Rng,
  wallColor: string,
  roofColor: string,
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const width = (2.4 + rng.next() * 1.4) * scale;
  const height = (2 + rng.next() * 1.2) * scale;

  const walls = box(pool, [width, height, width * 0.9], wallColor);
  walls.position.y = height / 2;
  group.add(walls);

  const roof = cone(pool, width * 0.82, height * 0.7, roofColor, 4);
  roof.position.y = height + height * 0.34;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const door = box(pool, [width * 0.26, height * 0.42, 0.08], '#8A5A3B');
  door.position.set(0, height * 0.21, (width * 0.9) / 2 + 0.04);
  group.add(door);

  return group;
}

/** A stack of toy building blocks. */
export function blockStack(
  pool: MapMaterialPool,
  rng: Rng,
  colors: readonly string[],
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const levels = 2 + Math.floor(rng.next() * 3);
  let y = 0;

  for (let i = 0; i < levels; i += 1) {
    const size = (1.6 - i * 0.18) * scale;
    const height = 0.8 * scale;
    const block = box(pool, [size, height, size], rng.pick([...colors]));
    block.position.y = y + height / 2;
    block.rotation.y = rng.next() * 0.4 - 0.2;
    group.add(block);

    // The studs on top are what make it read as a toy brick rather than a box.
    for (const [dx, dz] of [
      [-0.28, -0.28],
      [0.28, -0.28],
      [-0.28, 0.28],
      [0.28, 0.28],
    ] as const) {
      const stud = cylinder(pool, 0.12 * scale, 0.12 * scale, 0.16 * scale, '#FFFFFF', 6);
      // Local to the block, so the stud rides along with its rotation.
      stud.position.set(dx * size, height / 2 + 0.08 * scale, dz * size);
      block.add(stud);
    }

    y += height;
  }

  return group;
}

/** A cluster of cloud puffs. */
export function cloudPuff(
  pool: MapMaterialPool,
  rng: Rng,
  color = '#FFFFFF',
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  const puffs = 3 + Math.floor(rng.next() * 2);
  for (let i = 0; i < puffs; i += 1) {
    const radius = (1.1 + rng.next() * 0.9) * scale;
    const puff = sphere(pool, radius, color);
    puff.position.set((i - puffs / 2) * radius * 1.1, rng.next() * 0.4 * scale, rng.next() * scale);
    group.add(puff);
  }
  return group;
}

/** A rainbow arch made of concentric half-tori. */
export function rainbowArch(pool: MapMaterialPool, radius: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const bands = ['#FF7A7A', '#FFB86B', '#FFE066', '#7ED47E', '#6EC8FF', '#B98CFF'];

  bands.forEach((color, index) => {
    const band = torus(pool, (radius - index * 0.5) * scale, 0.24 * scale, color, {
      arc: Math.PI,
      segments: 20,
    });
    band.rotation.z = 0;
    group.add(band);
  });

  return group;
}

/** A planet with an optional ring. */
export function planet(
  pool: MapMaterialPool,
  radius: number,
  color: string,
  ringColor?: string,
): THREE.Group {
  const group = new THREE.Group();
  const body = sphere(pool, radius, color, { detail: 1 });
  group.add(body);

  if (ringColor !== undefined) {
    const ring = torus(pool, radius * 1.7, radius * 0.09, ringColor, { segments: 26 });
    ring.rotation.x = Math.PI / 2.3;
    group.add(ring);
  }

  return group;
}

/** A satellite or space module: a body with two panels. */
export function satellite(pool: MapMaterialPool, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const body = box(pool, [1.2 * scale, 1.2 * scale, 1.8 * scale], '#C9D6F5');
  group.add(body);

  for (const side of [-1, 1] as const) {
    const panel = box(pool, [2.4 * scale, 0.08 * scale, 1.1 * scale], '#3E58C8');
    panel.position.x = side * 1.9 * scale;
    group.add(panel);
  }

  const dish = cylinder(pool, 0.55 * scale, 0.1 * scale, 0.3 * scale, '#EFF4FF', 10);
  dish.position.set(0, 0.8 * scale, 0);
  dish.rotation.x = 0.4;
  group.add(dish);

  return group;
}

/** A Vietnamese tiled-roof house. */
export function tileRoofHouse(pool: MapMaterialPool, rng: Rng, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const width = (3.4 + rng.next() * 1.2) * scale;
  const height = 1.9 * scale;
  const depth = 2.6 * scale;

  const walls = box(pool, [width, height, depth], '#F5EBD6');
  walls.position.y = height / 2;
  group.add(walls);

  // A low, wide, four-sided tiled roof - the shape that reads as "quê".
  const roof = cone(pool, width * 0.78, 1.15 * scale, '#C0492F', 4);
  roof.position.y = height + 0.5 * scale;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = depth / width + 0.1;
  group.add(roof);

  for (const side of [-1, 1] as const) {
    const post = cylinder(pool, 0.1 * scale, 0.1 * scale, height, '#8A5A3B', 6);
    post.position.set((side * width) / 2.4, height / 2, depth / 2 + 0.4 * scale);
    group.add(post);
  }

  return group;
}

/** A lotus pad with a bud, used around ponds. */
export function lotus(pool: MapMaterialPool, rng: Rng, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const pad = cylinder(pool, 0.7 * scale, 0.7 * scale, 0.06 * scale, '#5FA55A', 9);
  group.add(pad);

  if (rng.next() > 0.4) {
    const bud = sphere(pool, 0.28 * scale, '#F7A8C4');
    bud.scale.y = 1.5;
    bud.position.set(0.2 * scale, 0.35 * scale, 0.1 * scale);
    group.add(bud);
  }

  return group;
}

/**
 * A field of repeated blades, drawn as one instanced mesh.
 *
 * A rice paddy is thousands of identical stalks; without instancing it would
 * blow the draw call budget on its own.
 */
export function instancedField(
  pool: MapMaterialPool,
  rng: Rng,
  options: {
    count: number;
    color: string;
    area: { width: number; depth: number };
    height: number;
  },
): THREE.InstancedMesh {
  const geometry = pool.own(new THREE.BoxGeometry(0.14, options.height, 0.14));
  const mesh = new THREE.InstancedMesh(geometry, pool.standard(options.color), options.count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let i = 0; i < options.count; i += 1) {
    position.set(
      (rng.next() - 0.5) * options.area.width,
      options.height / 2,
      (rng.next() - 0.5) * options.area.depth,
    );
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * Math.PI);
    scale.set(1, 0.7 + rng.next() * 0.6, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
