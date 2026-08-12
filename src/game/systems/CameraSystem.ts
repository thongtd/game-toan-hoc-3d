import * as THREE from 'three';
import { GAME_CONFIG } from '../game-config.ts';
import { damp } from '../../../shared/utils/clamp.ts';

export type CameraMode = 'attract' | 'gameplay' | 'result';

interface CameraPose {
  /** Offset from the player position. */
  offset: THREE.Vector3;
  /** Offset from the player for the look-at target. */
  lookAhead: THREE.Vector3;
  /** How much of the player's sideways movement the camera follows. */
  lateralFollow: number;
  /** Peak yaw drift in radians; zero disables the drift. */
  drift: number;
}

/**
 * Poses per mode, with a portrait variant.
 *
 * A phone held upright sees a much narrower slice of the world, so landscape
 * framing would push the character off the side of the screen. The portrait
 * variants centre the runner and pull the camera back instead.
 */
const POSES: Readonly<Record<CameraMode, { landscape: CameraPose; portrait: CameraPose }>> = {
  // Attract mode sits low and to the right, which places the character in the
  // left third of a wide frame and shows the road stretching away.
  attract: {
    landscape: {
      offset: new THREE.Vector3(2.6, 2.9, 8.6),
      lookAhead: new THREE.Vector3(-0.6, 1.25, -9),
      lateralFollow: 0,
      drift: 0.045,
    },
    portrait: {
      offset: new THREE.Vector3(0, 2.6, 7.4),
      lookAhead: new THREE.Vector3(0, 1.35, -10),
      lateralFollow: 0,
      drift: 0.03,
    },
  },
  gameplay: {
    landscape: {
      offset: new THREE.Vector3(
        GAME_CONFIG.cameraOffset.x,
        GAME_CONFIG.cameraOffset.y,
        GAME_CONFIG.cameraOffset.z,
      ),
      lookAhead: new THREE.Vector3(
        GAME_CONFIG.cameraLookAhead.x,
        GAME_CONFIG.cameraLookAhead.y,
        GAME_CONFIG.cameraLookAhead.z,
      ),
      lateralFollow: 0.35,
      drift: 0,
    },
    portrait: {
      // Further back and higher so all three gates fit in a narrow frame.
      offset: new THREE.Vector3(0, 5.4, 10.5),
      lookAhead: new THREE.Vector3(0, 1.1, -10),
      lateralFollow: 0.28,
      drift: 0,
    },
  },
  // The result pose swings round in front of the runner so the treasure chest,
  // the character's celebration and the finish arch behind them are all in shot.
  result: {
    landscape: {
      offset: new THREE.Vector3(1.4, 2.6, -7.6),
      lookAhead: new THREE.Vector3(0, 1.4, 1.2),
      lateralFollow: 0.4,
      drift: 0.03,
    },
    portrait: {
      offset: new THREE.Vector3(0, 2.4, -6.8),
      lookAhead: new THREE.Vector3(0, 1.4, 1.6),
      lateralFollow: 0.3,
      drift: 0.02,
    },
  },
};

/**
 * Chase camera with three staged poses.
 *
 * Moves are damped rather than parented, so a lane change reads as a smooth
 * sweep and a screen change reads as a camera move instead of a page swap.
 * There is deliberately no shake on a wrong answer.
 */
export class CameraSystem {
  private readonly lookTarget = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private mode: CameraMode = 'attract';
  private portrait = false;
  private bobPhase = 0;
  private driftPhase = 0;
  private reducedMotion = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Switches to the portrait framing used on phones held upright. */
  setPortrait(portrait: boolean): void {
    this.portrait = portrait;
  }

  private get pose(): CameraPose {
    const entry = POSES[this.mode];
    return this.portrait ? entry.portrait : entry.landscape;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  get currentMode(): CameraMode {
    return this.mode;
  }

  /** Places the camera at the current pose without easing. */
  snapTo(playerPosition: THREE.Vector3): void {
    this.computeDesired(playerPosition);
    this.camera.position.copy(this.desiredPosition);
    this.updateLookAt(playerPosition);
    this.bobPhase = 0;
    this.driftPhase = 0;
  }

  update(delta: number, playerPosition: THREE.Vector3, worldSpeed: number): void {
    this.computeDesired(playerPosition);

    const pose = this.pose;
    // Screen changes ease over roughly 700 ms; gameplay follows tightly.
    const smoothing = this.mode === 'gameplay' ? 0.0025 : 0.02;

    this.camera.position.x = damp(this.camera.position.x, this.desiredPosition.x, smoothing, delta);
    this.camera.position.y = damp(this.camera.position.y, this.desiredPosition.y, smoothing, delta);

    if (this.mode === 'gameplay') {
      // Forward motion must not lag, or the gates appear to drift sideways.
      this.camera.position.z = this.desiredPosition.z;
      if (!this.reducedMotion) {
        this.bobPhase += delta * worldSpeed * 0.9;
        this.camera.position.y += Math.sin(this.bobPhase) * 0.035;
      }
    } else {
      this.camera.position.z = damp(
        this.camera.position.z,
        this.desiredPosition.z,
        smoothing,
        delta,
      );
      if (!this.reducedMotion && pose.drift > 0) {
        this.driftPhase += delta * 0.35;
        this.camera.position.x += Math.sin(this.driftPhase) * pose.drift * 12;
      }
    }

    this.updateLookAt(playerPosition);
  }

  private computeDesired(playerPosition: THREE.Vector3): void {
    const pose = this.pose;
    this.desiredPosition.set(
      playerPosition.x * pose.lateralFollow + pose.offset.x,
      pose.offset.y,
      playerPosition.z + pose.offset.z,
    );
  }

  private updateLookAt(playerPosition: THREE.Vector3): void {
    const pose = this.pose;
    this.lookTarget.set(
      playerPosition.x * (pose.lateralFollow > 0 ? 0.5 : 0) + pose.lookAhead.x,
      pose.lookAhead.y,
      playerPosition.z + pose.lookAhead.z,
    );
    this.camera.lookAt(this.lookTarget);
  }
}
