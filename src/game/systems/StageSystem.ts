import * as THREE from 'three';
import type { AssetLoader } from '../../scene/AssetLoader.ts';
import { FinishLine } from '../entities/FinishLine.ts';
import { COLORS, LANE_POSITIONS_X } from '../game-config.ts';
import type { LaneIndex } from '../../../shared/game-types.ts';

export type StageMode = 'attract' | 'tutorial' | 'countdown' | 'running' | 'result';

/**
 * Set dressing that changes with the screen.
 *
 * Every screen shows the same world, so instead of swapping pages the game
 * swaps what is standing on the track: showcase coins while attracting, glowing
 * lane guides while teaching, a start arch for the countdown and the finish
 * arch with its treasure chest at the end.
 */
export class StageSystem {
  readonly group = new THREE.Group();

  private readonly startLine: FinishLine;
  private readonly finishLine: FinishLine;
  private readonly showcaseCoins = new THREE.Group();
  private readonly laneGuides = new THREE.Group();
  private readonly guideMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];

  private mode: StageMode = 'attract';
  private spinPhase = 0;

  constructor(assets: AssetLoader) {
    this.group.name = 'stage';

    this.startLine = new FinishLine(assets, 'start');
    this.finishLine = new FinishLine(assets, 'finish');
    this.group.add(
      this.startLine.group,
      this.finishLine.group,
      this.showcaseCoins,
      this.laneGuides,
    );

    this.buildShowcaseCoins(assets);
    this.buildLaneGuides();

    this.showcaseCoins.visible = false;
    this.laneGuides.visible = false;
  }

  private buildShowcaseCoins(assets: AssetLoader): void {
    if (!assets.has('coin')) return;
    for (const [index, x] of LANE_POSITIONS_X.entries()) {
      const coin = assets.cloneStatic('coin');
      coin.scale.setScalar(1.1);
      coin.position.set(x, 1.5 + (index === 1 ? 0.3 : 0), -14 - index * 2);
      this.showcaseCoins.add(coin);
    }
  }

  private buildLaneGuides(): void {
    const geometry = new THREE.PlaneGeometry(2.1, 26);
    this.ownedGeometries.push(geometry);

    for (const x of LANE_POSITIONS_X) {
      const material = new THREE.MeshBasicMaterial({
        color: COLORS.coin,
        transparent: true,
        opacity: 0.22,
        toneMapped: false,
        depthWrite: false,
      });
      this.guideMaterials.push(material);

      const strip = new THREE.Mesh(geometry, material);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.08, 0);
      this.laneGuides.add(strip);
    }
  }

  setMode(mode: StageMode, playerZ: number): void {
    this.mode = mode;

    this.showcaseCoins.visible = mode === 'attract';
    this.laneGuides.visible = mode === 'tutorial';

    switch (mode) {
      case 'attract':
        this.startLine.placeAt(playerZ - 26);
        this.finishLine.hide();
        this.showcaseCoins.position.z = playerZ;
        break;
      case 'tutorial':
        this.startLine.placeAt(playerZ - 60);
        this.finishLine.hide();
        break;
      case 'countdown':
        // The start arch stands just ahead and is left behind as the run begins.
        this.startLine.placeAt(playerZ - 16);
        this.finishLine.hide();
        break;
      case 'running':
        this.finishLine.hide();
        break;
      case 'result':
        this.startLine.hide();
        // The runner has just passed under the arch, so it stands behind them
        // while the chest it carries sits in front, facing the camera.
        this.finishLine.placeAt(playerZ + 3.2);
        break;
    }
  }

  /** Highlights the lane the runner is currently on during the tutorial. */
  setActiveLane(lane: LaneIndex): void {
    if (!this.laneGuides.visible) return;
    this.guideMaterials.forEach((material, index) => {
      material.opacity = index === lane ? 0.55 : 0.2;
    });
  }

  update(delta: number, playerZ: number): void {
    this.spinPhase += delta;

    for (const coin of this.showcaseCoins.children) {
      coin.rotation.y = this.spinPhase * 1.6;
      coin.position.y = 1.5 + Math.sin(this.spinPhase * 2 + coin.position.x) * 0.18;
    }

    if (this.laneGuides.visible) {
      this.laneGuides.position.z = playerZ - 11;
    }

    this.startLine.update(delta, false);
    this.finishLine.update(delta, this.mode === 'result');

    // Drop the start arch as soon as it is behind the runner, so it never
    // competes with the first answer gate for attention.
    if (this.mode === 'running' && this.startLine.isVisible && this.startLine.z > playerZ + 3) {
      this.startLine.hide();
    }
  }

  /** Where the celebration coins should burst from on the result screen. */
  celebrationOrigin(target: THREE.Vector3): THREE.Vector3 {
    return this.finishLine.celebrationOrigin(target);
  }

  dispose(): void {
    this.startLine.dispose();
    this.finishLine.dispose();
    for (const material of this.guideMaterials) material.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    this.guideMaterials.length = 0;
    this.ownedGeometries.length = 0;
    this.showcaseCoins.clear();
    this.laneGuides.clear();
    this.group.clear();
  }
}
