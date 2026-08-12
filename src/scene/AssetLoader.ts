import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { resolveAssetUrl } from '../utils/asset-url.ts';
import { required } from '../utils/assert-never.ts';
import { disposeMaterial, isMesh, toMaterialList } from '../utils/dispose-three.ts';

export type ModelId =
  | 'character'
  | 'coin'
  | 'tree'
  | 'treePine'
  | 'rocks'
  | 'crate'
  | 'fence'
  | 'flag'
  | 'chest';

interface ModelEntry {
  id: ModelId;
  url: string;
  /** Essential models block the loading screen; the rest can arrive later. */
  essential: boolean;
}

const MODEL_MANIFEST: readonly ModelEntry[] = [
  { id: 'character', url: 'assets/models/platformer/character-oopi.glb', essential: true },
  { id: 'coin', url: 'assets/models/platformer/coin-gold.glb', essential: true },
  { id: 'tree', url: 'assets/models/platformer/tree.glb', essential: false },
  { id: 'treePine', url: 'assets/models/platformer/tree-pine.glb', essential: false },
  { id: 'rocks', url: 'assets/models/platformer/rocks.glb', essential: false },
  { id: 'crate', url: 'assets/models/platformer/crate.glb', essential: false },
  { id: 'fence', url: 'assets/models/platformer/fence-low-straight.glb', essential: false },
  { id: 'flag', url: 'assets/models/platformer/flag.glb', essential: false },
  { id: 'chest', url: 'assets/models/platformer/chest.glb', essential: false },
];

export class AssetLoadError extends Error {
  constructor(readonly assetUrl: string, cause?: unknown) {
    super(`Failed to load asset: ${assetUrl}`);
    this.name = 'AssetLoadError';
    this.cause = cause;
  }
}

export interface LoadProgress {
  loaded: number;
  total: number;
  /** 0..1 */
  ratio: number;
}

/**
 * Loads and owns every GLTF used by the game.
 *
 * Each file is fetched once and cached; callers clone what they need. The
 * loader never silently swallows a failure - a missing model surfaces as an
 * `AssetLoadError` so the app can show a retry screen instead of hanging on
 * the loading bar forever.
 */
export class AssetLoader {
  private readonly manager = new THREE.LoadingManager();
  private readonly loader = new GLTFLoader(this.manager);
  private readonly cache = new Map<ModelId, GLTF>();
  private progressListener: ((progress: LoadProgress) => void) | null = null;

  constructor() {
    this.manager.onProgress = (_url, loaded, total): void => {
      this.progressListener?.({
        loaded,
        total,
        ratio: total > 0 ? loaded / total : 0,
      });
    };
  }

  onProgress(listener: (progress: LoadProgress) => void): void {
    this.progressListener = listener;
  }

  /** Loads the models needed before the first frame can be drawn. */
  async loadEssential(): Promise<void> {
    await this.loadEntries(MODEL_MANIFEST.filter((entry) => entry.essential));
  }

  /** Loads the decorative models. */
  async loadDecorations(): Promise<void> {
    await this.loadEntries(MODEL_MANIFEST.filter((entry) => !entry.essential));
  }

  private async loadEntries(entries: readonly ModelEntry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        if (this.cache.has(entry.id)) return;
        const url = resolveAssetUrl(entry.url);
        try {
          const gltf = await this.loader.loadAsync(url);
          prepareGltf(gltf);
          this.cache.set(entry.id, gltf);
        } catch (error) {
          throw new AssetLoadError(url, error);
        }
      }),
    );
  }

  has(id: ModelId): boolean {
    return this.cache.has(id);
  }

  /** The cached GLTF. Throws when the model was never loaded. */
  get(id: ModelId): GLTF {
    return required(this.cache.get(id), `model "${id}" was not loaded`);
  }

  /**
   * A fresh copy of a static model.
   *
   * `Object3D.clone()` shares geometry and material with the original, which
   * is exactly what the decoration pools want. Skinned meshes must not use
   * this path - the character is instantiated directly from the cached scene.
   */
  cloneStatic(id: ModelId): THREE.Object3D {
    return this.get(id).scene.clone(true);
  }

  /** Frees every cached GLTF. Only called on teardown. */
  dispose(): void {
    for (const gltf of this.cache.values()) {
      disposeObject(gltf.scene);
    }
    this.cache.clear();
  }
}

/** Applies the flat-shaded low-poly look and enables shadows on the meshes. */
function prepareGltf(gltf: GLTF): void {
  gltf.scene.traverse((object) => {
    if (!isMesh(object)) return;
    object.castShadow = true;
    object.receiveShadow = true;

    for (const material of toMaterialList(object.material)) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.metalness = 0;
        material.roughness = 0.85;
        if (material.map !== null) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          // The Kenney colormap is a tiny palette atlas - nearest filtering
          // keeps the colours crisp instead of bleeding between swatches.
          material.map.magFilter = THREE.NearestFilter;
          material.map.generateMipmaps = true;
        }
      }
    }
  });
}

/** Recursively releases geometry, materials and textures. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!isMesh(object)) return;
    object.geometry.dispose();
    for (const material of toMaterialList(object.material)) {
      disposeMaterial(material);
    }
  });
}
