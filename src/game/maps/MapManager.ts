import * as THREE from 'three';
import type { MapDefinition, MapId, MapPalette } from '../../../shared/maps/map-manifest.ts';
import { getMapDefinition, isMapAvailable } from '../../../shared/maps/map-manifest.ts';
import { createRng } from '../../../shared/math/seeded-rng.ts';
import type { QualitySettings } from '../../scene/quality.ts';
import type { SceneLights } from '../../scene/create-lights.ts';
import type { Track } from '../entities/Track.ts';
import type { MapFactory, MapRuntime } from './map-types.ts';
import { createFallbackMap } from './fallback-map.ts';

/**
 * Loads exactly one map at a time.
 *
 * Only the chosen map's code is downloaded - the other four are separate chunks
 * that are never requested - and the previous map is disposed before the next
 * one is added, so switching maps twenty times costs the same as switching once.
 */

/** After this long a map is considered broken and the fallback is used. */
export const MAP_LOAD_TIMEOUT_MS = 5_000;

export type MapLoadOutcome = 'loaded' | 'fallback';

export interface MapLoadResult {
  runtime: MapRuntime;
  outcome: MapLoadOutcome;
  durationMs: number;
}

/**
 * Dynamic imports, one per map.
 *
 * Written as literal `import()` calls so the bundler can split them; a computed
 * path would defeat code splitting and pull all five maps into the main chunk.
 */
const LOADERS: Readonly<Record<MapId, () => Promise<MapFactory>>> = {
  'rainbow-skyway': async () =>
    (await import('./rainbow-skyway/createRainbowSkyway.ts')).createRainbowSkyway,
  'vietnam-countryside': async () =>
    (await import('./vietnam-countryside/createVietnamCountryside.ts')).createVietnamCountryside,
  'cosmic-orbit': async () =>
    (await import('./cosmic-orbit/createCosmicOrbit.ts')).createCosmicOrbit,
  'enchanted-forest': async () =>
    (await import('./enchanted-forest/createEnchantedForest.ts')).createEnchantedForest,
  'toy-city': async () => (await import('./toy-city/createToyCity.ts')).createToyCity,
};

export interface MapManagerOptions {
  scene: THREE.Scene;
  lights: SceneLights;
  track: Track;
  /** The shared cloud layer, hidden by maps that have no sky. */
  clouds: THREE.Object3D;
  /** Milliseconds before a slow map is given up on. */
  timeoutMs?: number;
}

export class MapManager {
  private readonly scene: THREE.Scene;
  private readonly lights: SceneLights;
  private readonly track: Track;
  private readonly clouds: THREE.Object3D;
  private readonly timeoutMs: number;

  private active: MapRuntime | null = null;
  private quality: QualitySettings | null = null;
  private reducedMotion = false;

  constructor(options: MapManagerOptions) {
    this.scene = options.scene;
    this.lights = options.lights;
    this.track = options.track;
    this.clouds = options.clouds;
    this.timeoutMs = options.timeoutMs ?? MAP_LOAD_TIMEOUT_MS;
  }

  get activeMapId(): MapId | null {
    return this.active?.id ?? null;
  }

  get isShowingFallback(): boolean {
    return this.active?.isFallback ?? false;
  }

  /**
   * Loads a map and swaps it in.
   *
   * A map that fails or is too slow never blocks the run: the code-only
   * fallback scene is activated instead and the caller is told, so the UI can
   * say so in words a child understands.
   */
  async load(
    mapId: MapId,
    options: { seed: number; quality: QualitySettings; reducedMotion: boolean },
  ): Promise<MapLoadResult> {
    const startedAt = performance.now();
    const definition = getMapDefinition(mapId);
    this.quality = options.quality;
    this.reducedMotion = options.reducedMotion;

    const context = {
      definition,
      quality: options.quality,
      reducedMotion: options.reducedMotion,
      rng: createRng(options.seed ^ 0x4d61_7053),
    };

    let outcome: MapLoadOutcome = 'loaded';
    let runtime: MapRuntime;

    try {
      if (!isMapAvailable(mapId)) {
        throw new Error(`Map is not available: ${String(mapId)}`);
      }
      const factory = await withTimeout(LOADERS[mapId](), this.timeoutMs);
      runtime = factory(context);
    } catch (error) {
      console.warn(`Không tải được bản đồ ${mapId}, dùng đường dự phòng.`, error);
      runtime = createFallbackMap(context);
      outcome = 'fallback';
    }

    this.activate(runtime, definition);
    return { runtime, outcome, durationMs: Math.round(performance.now() - startedAt) };
  }

  private activate(runtime: MapRuntime, definition: MapDefinition): void {
    this.disposeActiveMap();
    this.applyPalette(definition.palette, definition.hasGroundPlane);
    this.clouds.visible = definition.showSharedClouds;
    this.scene.add(runtime.root);
    this.active = runtime;

    if (this.quality !== null) runtime.setQuality(this.quality);
    runtime.setReducedMotion(this.reducedMotion);
  }

  /** Colours the shared scene - sky, fog, lights and road - for one map. */
  private applyPalette(palette: MapPalette, hasGroundPlane: boolean): void {
    const sky = new THREE.Color(palette.sky);
    this.scene.background = sky;

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(palette.fog);
    } else {
      this.scene.fog = new THREE.Fog(new THREE.Color(palette.fog), 70, 190);
    }

    this.lights.hemisphere.color.set(palette.sky);
    this.lights.hemisphere.groundColor.set(palette.ground);
    this.lights.sun.color.set(palette.keyLight);

    this.track.setPalette({
      road: palette.track,
      edge: palette.trackEdge,
      ground: palette.ground,
      groundVisible: hasGroundPlane,
    });
  }

  update(delta: number, worldSpeed: number, playerZ: number): void {
    this.active?.update(delta, worldSpeed, playerZ);
  }

  setQuality(quality: QualitySettings): void {
    this.quality = quality;
    this.active?.setQuality(quality);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.active?.setReducedMotion(reduced);
  }

  disposeActiveMap(): void {
    if (this.active === null) return;
    this.scene.remove(this.active.root);
    this.active.dispose();
    this.active = null;
  }
}

/** Rejects when a promise takes longer than `ms`, without cancelling it. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Map load timed out after ${String(ms)} ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
