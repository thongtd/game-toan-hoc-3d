import * as THREE from 'three';
import type { Rng } from '../../../shared/math/seeded-rng.ts';
import { SEGMENT_LENGTH } from './map-types.ts';
import { asScenery } from './primitives.ts';

export interface SegmentVariant {
  id: string;
  build(): THREE.Object3D;
}

/**
 * The endless roadside of one map.
 *
 * Every variant is built once, up front, and then recycled forward for the rest
 * of the run: no geometry is created or destroyed while the player is running.
 * A couple of spare segments are kept off-screen so the sequence can vary
 * instead of cycling through the same fixed order.
 */
export class MapSegmentPool {
  readonly group = new THREE.Group();

  private readonly active: { object: THREE.Object3D; variantId: string }[] = [];
  private readonly spares: { object: THREE.Object3D; variantId: string }[] = [];
  /** Last two variants placed, so the same one never appears three times. */
  private recentIds: string[] = [];
  private frontZ = 0;

  constructor(
    variants: readonly SegmentVariant[],
    private readonly rng: Rng,
    options: { slots?: number; spares?: number } = {},
  ) {
    this.group.name = 'map-segments';

    const slots = options.slots ?? 6;
    const spareCount = options.spares ?? 2;
    const total = Math.max(slots + spareCount, variants.length);

    for (let i = 0; i < total; i += 1) {
      const variant = variants[i % variants.length];
      if (variant === undefined) continue;
      const object = asScenery(variant.build());
      object.visible = false;
      this.group.add(object);
      this.spares.push({ object, variantId: variant.id });
    }

    for (let i = 0; i < slots; i += 1) {
      this.placeNext();
    }
  }

  /** Lays the pool out again from a clean start, e.g. for a new run. */
  reset(startZ = 0): void {
    while (this.active.length > 0) {
      const entry = this.active.pop();
      if (entry === undefined) break;
      entry.object.visible = false;
      this.spares.push(entry);
    }
    this.recentIds = [];
    this.frontZ = startZ;

    const slots = this.spares.length - 2;
    for (let i = 0; i < slots; i += 1) {
      this.placeNext();
    }
  }

  update(playerZ: number, behindDistance: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const entry = this.active[i];
      if (entry === undefined) continue;
      if (entry.object.position.z <= playerZ + behindDistance) continue;

      entry.object.visible = false;
      this.active.splice(i, 1);
      this.spares.push(entry);
      this.placeNext();
    }
  }

  /** Moves the furthest-back spare to the front of the road. */
  private placeNext(): void {
    const index = this.pickSpareIndex();
    if (index < 0) return;

    const entry = this.spares.splice(index, 1)[0];
    if (entry === undefined) return;

    this.frontZ -= SEGMENT_LENGTH;
    entry.object.position.z = this.frontZ;
    entry.object.visible = true;
    this.active.push(entry);

    this.recentIds.push(entry.variantId);
    if (this.recentIds.length > 2) this.recentIds.shift();
  }

  private pickSpareIndex(): number {
    if (this.spares.length === 0) return -1;

    const fresh = this.spares
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !this.recentIds.includes(entry.variantId));

    const pool = fresh.length > 0 ? fresh : this.spares.map((entry, index) => ({ entry, index }));
    const choice = pool[Math.min(pool.length - 1, Math.floor(this.rng.next() * pool.length))];
    return choice?.index ?? 0;
  }

  dispose(): void {
    this.group.clear();
    this.active.length = 0;
    this.spares.length = 0;
  }
}
