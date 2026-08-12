import * as THREE from 'three';
import { COLORS, GAME_CONFIG } from '../game/game-config.ts';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/** Builds the scene, its sky colour, distance fog and the chase camera. */
export function createScene(aspect: number): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  // Fog hides the point where recycled track segments pop in.
  scene.fog = new THREE.Fog(COLORS.sky, 70, 190);

  const camera = new THREE.PerspectiveCamera(GAME_CONFIG.cameraFov, aspect, 0.1, 300);
  camera.position.set(
    GAME_CONFIG.cameraOffset.x,
    GAME_CONFIG.cameraOffset.y,
    GAME_CONFIG.cameraOffset.z,
  );

  return { scene, camera };
}

/** Simple stylised clouds; cheap boxes rather than sprites or textures. */
export function createClouds(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'clouds';

  const geometry = new THREE.SphereGeometry(1, 8, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });

  const layout: readonly (readonly [number, number, number, number])[] = [
    [-38, 26, -120, 7],
    [34, 30, -160, 9],
    [-14, 34, -200, 6],
    [46, 22, -80, 5],
    [-52, 30, -180, 8],
  ];

  for (const [x, y, z, scale] of layout) {
    const cloud = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const puff = new THREE.Mesh(geometry, material);
      puff.position.set((i - 1) * scale * 0.8, (i === 1 ? 0.35 : 0) * scale, 0);
      puff.scale.setScalar(scale * (i === 1 ? 0.75 : 0.55));
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    group.add(cloud);
  }

  return group;
}
