import * as THREE from 'three';
import type { AssetLoader } from '../../scene/AssetLoader.ts';
import type { LaneIndex } from '../../../shared/game-types.ts';
import { GAME_CONFIG, LANE_POSITIONS_X } from '../game-config.ts';
import { damp } from '../../../shared/utils/clamp.ts';

export type PlayerAnimation = 'idle' | 'sprint' | 'emote-yes' | 'emote-no';

const TARGET_HEIGHT = 1.8;
const FADE_SECONDS = 0.15;
const EMOTE_RETURN_MS = 900;

/**
 * The runner.
 *
 * Lane position is authoritative: `targetLane` drives an eased X position and
 * the answer is resolved from the lane index, never from mesh bounds. That
 * keeps collision behaviour identical at any frame rate.
 */
export class Player {
  readonly group = new THREE.Group();

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<PlayerAnimation, THREE.AnimationAction>();
  private currentAnimation: PlayerAnimation = 'idle';
  private emoteTimer = 0;

  private currentLane: LaneIndex = 1;
  private laneTarget: LaneIndex = 1;
  private laneStartX = LANE_POSITIONS_X[1];
  private laneTweenElapsed = Number.POSITIVE_INFINITY;

  private bobPhase = 0;
  private reducedMotion = false;

  constructor(assets: AssetLoader) {
    const gltf = assets.get('character');
    // The character is skinned, so it is used directly rather than cloned;
    // the game only ever needs one instance.
    const model = gltf.scene;

    normaliseModel(model);

    const holder = new THREE.Group();
    holder.add(model);
    this.group.add(holder);
    this.group.add(createShadowBlob());

    this.group.position.set(LANE_POSITIONS_X[1], 0, 0);
    this.group.name = 'player';

    this.mixer = new THREE.AnimationMixer(model);
    for (const name of ['idle', 'sprint', 'emote-yes', 'emote-no'] as const) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (clip === null) continue;
      const action = this.mixer.clipAction(clip);
      if (name === 'emote-yes' || name === 'emote-no') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(name, action);
    }

    this.actions.get('idle')?.play();
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get lane(): LaneIndex {
    return this.currentLane;
  }

  get targetLane(): LaneIndex {
    return this.laneTarget;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Moves one lane towards `direction`; returns true when the lane changed. */
  moveLane(direction: -1 | 1): boolean {
    const next = this.laneTarget + direction;
    if (next < 0 || next > 2) return false;
    return this.setLane(next as LaneIndex);
  }

  setLane(lane: LaneIndex): boolean {
    if (lane === this.laneTarget) return false;
    this.laneStartX = this.group.position.x;
    this.laneTarget = lane;
    this.laneTweenElapsed = 0;
    return true;
  }

  /** Snaps back to the middle lane without a tween. Used when a run starts. */
  reset(): void {
    this.currentLane = 1;
    this.laneTarget = 1;
    this.laneStartX = LANE_POSITIONS_X[1];
    this.laneTweenElapsed = Number.POSITIVE_INFINITY;
    this.group.position.set(LANE_POSITIONS_X[1], 0, 0);
    this.bobPhase = 0;
    this.emoteTimer = 0;
    this.playAnimation('idle', true);
  }

  update(delta: number, worldSpeed: number): void {
    this.group.position.z -= worldSpeed * delta;

    this.updateLaneTween(delta);
    this.updateBob(delta, worldSpeed);

    if (this.emoteTimer > 0) {
      this.emoteTimer -= delta * 1000;
      if (this.emoteTimer <= 0) {
        this.playAnimation('sprint');
      }
    }

    this.mixer.update(delta);
  }

  private updateLaneTween(delta: number): void {
    const targetX = LANE_POSITIONS_X[this.laneTarget];
    const duration = GAME_CONFIG.laneChangeMs / 1000;

    if (this.laneTweenElapsed < duration) {
      this.laneTweenElapsed += delta;
      const t = Math.min(1, this.laneTweenElapsed / duration);
      // easeOutCubic keeps the move snappy but never instantaneous.
      const eased = 1 - Math.pow(1 - t, 3);
      this.group.position.x = this.laneStartX + (targetX - this.laneStartX) * eased;
      if (t >= 1) {
        this.currentLane = this.laneTarget;
      }
    } else {
      this.group.position.x = damp(this.group.position.x, targetX, 0.0001, delta);
      this.currentLane = this.laneTarget;
    }

    // Lean into the turn a little; purely cosmetic.
    const lean = (targetX - this.group.position.x) * 0.08;
    this.group.rotation.z = damp(this.group.rotation.z, lean, 0.001, delta);
  }

  private updateBob(delta: number, worldSpeed: number): void {
    if (this.reducedMotion) {
      this.group.position.y = 0;
      return;
    }
    this.bobPhase += delta * worldSpeed * 1.1;
    this.group.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.09;
  }

  playAnimation(name: PlayerAnimation, immediate = false): void {
    if (this.currentAnimation === name && !immediate) return;
    const next = this.actions.get(name);
    if (next === undefined) return;

    const previous = this.actions.get(this.currentAnimation);
    next.reset();
    next.setEffectiveWeight(1);
    next.fadeIn(immediate ? 0 : FADE_SECONDS);
    next.play();
    if (previous !== undefined && previous !== next) {
      previous.fadeOut(immediate ? 0 : FADE_SECONDS);
    }
    this.currentAnimation = name;
  }

  /** Plays a short reaction, then returns to sprinting on its own. */
  playEmote(kind: 'emote-yes' | 'emote-no'): void {
    if (!this.actions.has(kind)) return;
    this.playAnimation(kind, true);
    // A wrong answer gets a very brief shake of the head - never a death.
    this.emoteTimer = kind === 'emote-no' ? EMOTE_RETURN_MS * 0.55 : EMOTE_RETURN_MS;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}

/**
 * Scales and orients the character.
 *
 * The Kenney model is authored a little under one unit tall and faces +Z, so
 * it is normalised to a fixed height and turned to face the running direction
 * (-Z) instead of relying on the exported transform.
 */
function normaliseModel(model: THREE.Object3D): void {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const height = size.y > 0 ? size.y : 1;
  const scale = TARGET_HEIGHT / height;
  model.scale.setScalar(scale);

  // Re-measure after scaling so the feet sit exactly on the road.
  model.updateWorldMatrix(true, true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBox.min.y;

  model.rotation.y = Math.PI;
}

/** A soft blob under the runner so it never looks like it is floating. */
function createShadowBlob(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(0.55, 20);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0b1a2b,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const blob = new THREE.Mesh(geometry, material);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.renderOrder = 1;
  return blob;
}
