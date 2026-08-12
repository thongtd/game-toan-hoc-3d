import * as THREE from 'three';
import { COLORS } from '../game/game-config.ts';
import type { QualitySettings } from './quality.ts';

export interface SceneLights {
  hemisphere: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** Sun target that is kept in front of the player. */
  sunTarget: THREE.Object3D;
}

/**
 * Two lights only: a hemisphere fill for the flat low-poly look and one
 * directional "sun" that casts the character's shadow.
 */
export function createLights(quality: QualitySettings): SceneLights {
  const hemisphere = new THREE.HemisphereLight(COLORS.sky, COLORS.grass, 1.5);
  hemisphere.position.set(0, 40, 0);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.85);
  sun.position.set(14, 26, 12);
  sun.castShadow = quality.shadowsEnabled;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;

  const sunTarget = new THREE.Object3D();
  sun.target = sunTarget;

  return { hemisphere, sun, sunTarget };
}

/** Keeps the shadow frustum around the player instead of the world origin. */
export function followLights(lights: SceneLights, playerZ: number): void {
  lights.sunTarget.position.set(0, 0, playerZ - 6);
  lights.sunTarget.updateMatrixWorld();
  lights.sun.position.set(14, 26, playerZ + 12);
}

export function applyLightQuality(lights: SceneLights, quality: QualitySettings): void {
  lights.sun.castShadow = quality.shadowsEnabled;
  lights.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  lights.sun.shadow.map?.dispose();
  lights.sun.shadow.map = null;
}
