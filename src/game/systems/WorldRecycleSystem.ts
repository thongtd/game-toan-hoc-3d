import * as THREE from 'three';
import type { AssetLoader, ModelId } from '../../scene/AssetLoader.ts';
import { isMesh } from '../../utils/dispose-three.ts';
import { GAME_CONFIG } from '../game-config.ts';
import type { Rng } from '../../../shared/math/seeded-rng.ts';
import { createRng } from '../../../shared/math/seeded-rng.ts';

interface Decoration {
  object: THREE.Object3D;
  side: -1 | 1;
}

const DECOR_MODELS: readonly { id: ModelId; scale: number; weight: number }[] = [
  { id: 'tree', scale: 1.6, weight: 4 },
  { id: 'treePine', scale: 1.8, weight: 4 },
  { id: 'rocks', scale: 1.2, weight: 2 },
  { id: 'crate', scale: 1, weight: 1 },
  { id: 'fence', scale: 1.2, weight: 3 },
  { id: 'flag', scale: 1.1, weight: 1 },
  { id: 'chest', scale: 1, weight: 1 },
];

/**
 * Roadside scenery.
 *
 * Objects are pooled and pushed forward once they fall behind the camera, so
 * the roadside never allocates during a run. Placement uses its own seeded
 * generator, keeping screenshots reproducible without touching the question
 * sequence.
 */
export class WorldRecycleSystem {
  readonly group = new THREE.Group();

  private readonly decorations: Decoration[] = [];
  private rng: Rng;
  private nextZ = 0;

  constructor(
    private readonly assets: AssetLoader,
    seed: number,
    decorationScale: number,
  ) {
    this.group.name = 'decorations';
    this.rng = createRng(seed);

    const available = DECOR_MODELS.filter((entry) => this.assets.has(entry.id));
    if (available.length === 0) return;

    const weighted: { id: ModelId; scale: number }[] = [];
    for (const entry of available) {
      for (let i = 0; i < entry.weight; i += 1) {
        weighted.push({ id: entry.id, scale: entry.scale });
      }
    }

    const count = Math.max(8, Math.round(GAME_CONFIG.decorationCount * decorationScale));
    for (let i = 0; i < count; i += 1) {
      const template = this.rng.pick(weighted);
      const object = this.assets.cloneStatic(template.id);
      object.scale.setScalar(template.scale * (0.8 + this.rng.next() * 0.5));
      // Distant scenery does not cast shadows - it would double the shadow
      // draw cost for something nobody looks at.
      object.traverse((child) => {
        if (!isMesh(child)) return;
        child.castShadow = false;
        child.receiveShadow = true;
      });

      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      this.decorations.push({ object, side });
      this.group.add(object);
    }

    this.layout();
  }

  /** Spreads every decoration along the road from a clean start. */
  private layout(): void {
    this.nextZ = 10;
    for (const decoration of this.decorations) {
      this.place(decoration);
    }
  }

  private place(decoration: Decoration): void {
    const lateral = 6.4 + this.rng.next() * 12;
    decoration.object.position.set(
      decoration.side * lateral,
      0,
      this.nextZ - GAME_CONFIG.decorationSpacing,
    );
    decoration.object.rotation.y = this.rng.next() * Math.PI * 2;
    this.nextZ -= GAME_CONFIG.decorationSpacing;
  }

  update(playerZ: number): void {
    const behindLimit = playerZ + GAME_CONFIG.recycleBehindDistance;
    for (const decoration of this.decorations) {
      if (decoration.object.position.z <= behindLimit) continue;
      this.place(decoration);
    }
  }

  reset(seed: number): void {
    this.rng = createRng(seed);
    this.layout();
  }

  dispose(): void {
    // Geometry and materials belong to AssetLoader's cache: these are clones
    // that share them, so only the scene graph link is released here.
    this.group.clear();
    this.decorations.length = 0;
  }
}
