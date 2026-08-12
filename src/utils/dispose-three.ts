import * as THREE from 'three';

/**
 * Disposal helpers.
 *
 * Ownership rule used across the game: a pool or entity disposes only the
 * geometry, material and texture instances it created itself. Anything handed
 * over by `AssetLoader` stays owned by the loader, so recycling an object
 * never frees a resource another pool is still drawing.
 */

/** A mesh with concrete geometry/material types rather than Three's defaults. */
export type TypedMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

/**
 * Type guard based on Three's own marker flag.
 *
 * `instanceof THREE.Mesh` narrows to `Mesh<any, any>`, which spreads `any`
 * through everything it touches; this keeps the traversal fully typed.
 */
export function isMesh(object: THREE.Object3D): object is TypedMesh {
  return (object as Partial<THREE.Mesh>).isMesh === true;
}

export function toMaterialList(
  material: THREE.Material | THREE.Material[],
): readonly THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

export function disposeTexture(texture: THREE.Texture | null | undefined): void {
  texture?.dispose();
}

/** Disposes a material together with every texture it references. */
export function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

/** Removes an object from its parent without touching shared resources. */
export function detach(object: THREE.Object3D): void {
  object.parent?.remove(object);
}

/**
 * Disposes every resource created *by the caller* under `root`.
 * Pass the set of shared geometries/materials to keep them alive.
 */
export function disposeOwned(
  root: THREE.Object3D,
  shared: { geometries?: Set<THREE.BufferGeometry>; materials?: Set<THREE.Material> } = {},
): void {
  const sharedGeometries = shared.geometries ?? new Set<THREE.BufferGeometry>();
  const sharedMaterials = shared.materials ?? new Set<THREE.Material>();

  root.traverse((object) => {
    if (!isMesh(object)) return;

    if (!sharedGeometries.has(object.geometry)) {
      object.geometry.dispose();
    }

    for (const material of toMaterialList(object.material)) {
      if (sharedMaterials.has(material)) continue;
      disposeMaterial(material);
    }
  });

  detach(root);
}
