import * as THREE from 'three';
import type { AssetLoader } from '../../scene/AssetLoader.ts';
import { COLORS, GAME_CONFIG } from '../game-config.ts';

const ARCH_HEIGHT = 6.4;
const ARCH_WIDTH = GAME_CONFIG.trackWidth + 1.4;

/**
 * The checkered arch that opens and closes a run.
 *
 * The same object is reused as the start gate and as the finish, so the run has
 * visible bookends instead of fading in and out of empty road. The finish
 * variant also carries the treasure chest and two flags that the result screen
 * is staged around.
 */
export class FinishLine {
  readonly group = new THREE.Group();

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly checkerTexture: THREE.CanvasTexture;
  private readonly chest: THREE.Object3D | null = null;
  private readonly flags: THREE.Object3D[] = [];
  private chestOpenPhase = 0;

  constructor(assets: AssetLoader, variant: 'start' | 'finish') {
    this.group.name = `${variant}-line`;
    this.group.visible = false;

    this.checkerTexture = createCheckerTexture();

    const postGeometry = new THREE.BoxGeometry(0.5, ARCH_HEIGHT, 0.5);
    // Kept slim and high so passing under it never blocks the road ahead.
    const bannerGeometry = new THREE.BoxGeometry(ARCH_WIDTH, 0.8, 0.4);
    this.ownedGeometries.push(postGeometry, bannerGeometry);

    const postMaterial = new THREE.MeshStandardMaterial({
      color: variant === 'finish' ? COLORS.panelEdge : COLORS.secondary,
      roughness: 0.7,
      metalness: 0,
    });
    const bannerMaterial = new THREE.MeshStandardMaterial({
      map: variant === 'finish' ? this.checkerTexture : null,
      color: variant === 'finish' ? 0xffffff : COLORS.primary,
      roughness: 0.8,
      metalness: 0,
    });
    this.ownedMaterials.push(postMaterial, bannerMaterial);

    for (const side of [-1, 1] as const) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set((side * ARCH_WIDTH) / 2, ARCH_HEIGHT / 2, 0);
      post.castShadow = true;
      this.group.add(post);
    }

    const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
    banner.position.set(0, ARCH_HEIGHT - 0.55, 0);
    banner.castShadow = true;
    this.group.add(banner);

    if (variant === 'finish') {
      if (assets.has('chest')) {
        const chest = assets.cloneStatic('chest');
        chest.scale.setScalar(2.4);
        // Just under the arch, so the runner ends up standing in front of it
        // and both are in frame for the result camera.
        chest.position.set(-2.4, 0, 0.4);
        this.chest = chest;
        this.group.add(chest);
      }

      if (assets.has('flag')) {
        for (const side of [-1, 1] as const) {
          const flag = assets.cloneStatic('flag');
          flag.scale.setScalar(1.8);
          flag.position.set(side * (ARCH_WIDTH / 2 - 1.2), 0, -0.6);
          flag.rotation.y = side > 0 ? Math.PI : 0;
          this.flags.push(flag);
          this.group.add(flag);
        }
      }
    }
  }

  get z(): number {
    return this.group.position.z;
  }

  get isVisible(): boolean {
    return this.group.visible;
  }

  placeAt(z: number): void {
    this.group.position.z = z;
    this.group.visible = true;
    this.chestOpenPhase = 0;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** Gentle idle motion: flags sway and the chest lid nudges open. */
  update(delta: number, celebrating: boolean): void {
    if (!this.group.visible) return;

    for (const [index, flag] of this.flags.entries()) {
      flag.rotation.z = Math.sin(this.chestOpenPhase * 2 + index) * 0.06;
    }

    if (!celebrating) return;
    this.chestOpenPhase = Math.min(1.6, this.chestOpenPhase + delta);
    if (this.chest !== null) {
      const lift = Math.min(0.35, this.chestOpenPhase * 0.3);
      this.chest.position.y = lift * 0.4;
      this.chest.rotation.y = Math.PI + Math.sin(this.chestOpenPhase * 3) * 0.05;
    }
  }

  /** World position where celebration coins should spawn - above the chest. */
  celebrationOrigin(target: THREE.Vector3): THREE.Vector3 {
    return target.set(this.group.position.x - 2.4, 1.6, this.group.position.z + 0.4);
  }

  dispose(): void {
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.checkerTexture.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.flags.length = 0;
    this.group.clear();
  }
}

/** Two rows of black-and-white squares, drawn once and reused. */
function createCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    const cell = 64;
    for (let y = 0; y < canvas.height / cell; y += 1) {
      for (let x = 0; x < canvas.width / cell; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f8fafc' : '#243b53';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}
