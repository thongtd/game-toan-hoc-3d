import * as THREE from 'three';

/**
 * Materials and geometries owned by one map.
 *
 * Every map builds its scenery from a handful of shared primitives, so the same
 * colour is requested dozens of times. Caching them here keeps the draw call
 * count low and makes unloading a map a single `dispose()` - nothing else in
 * the scene holds a reference, so nothing else can be freed by accident.
 */
export class MapMaterialPool {
  private readonly materials = new Map<string, THREE.Material>();
  private readonly geometries: THREE.BufferGeometry[] = [];

  /** Flat matte colour, the base look of the whole game. */
  standard(
    color: string | number,
    options: { roughness?: number; flatShading?: boolean } = {},
  ): THREE.Material {
    const roughness = options.roughness ?? 0.9;
    const flat = options.flatShading ?? true;
    const key = `std:${String(color)}:${String(roughness)}:${String(flat)}`;
    return this.cache(
      key,
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness,
          metalness: 0,
          flatShading: flat,
        }),
    );
  }

  /** Self-lit colour for glowing trim, stars and neon edges. */
  glow(color: string | number, intensity = 0.55): THREE.Material {
    const key = `glow:${String(color)}:${String(intensity)}`;
    return this.cache(
      key,
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: intensity,
          roughness: 0.5,
          metalness: 0,
        }),
    );
  }

  /** Unlit colour for very distant backdrops that must not cost lighting. */
  flat(color: string | number, options: { fog?: boolean; opacity?: number } = {}): THREE.Material {
    const fog = options.fog ?? true;
    const opacity = options.opacity ?? 1;
    const key = `flat:${String(color)}:${String(fog)}:${String(opacity)}`;
    return this.cache(
      key,
      () =>
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          fog,
          transparent: opacity < 1,
          opacity,
        }),
    );
  }

  /** Registers a geometry so it is released with the map. */
  own<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private cache(key: string, create: () => THREE.Material): THREE.Material {
    const existing = this.materials.get(key);
    if (existing !== undefined) return existing;
    const created = create();
    this.materials.set(key, created);
    return created;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.materials.clear();
    this.geometries.length = 0;
  }
}
