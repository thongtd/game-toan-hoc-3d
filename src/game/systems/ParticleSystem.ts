import * as THREE from 'three';
import { GAME_CONFIG } from '../game-config.ts';
import type { AssetLoader } from '../../scene/AssetLoader.ts';

interface Particle {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const GRAVITY = -9.5;

/**
 * Pooled coin burst played on a correct answer.
 *
 * Every particle is allocated once at start-up and reused; the pool is capped
 * so a fast streak can never flood the scene.
 */
export class ParticleSystem {
  readonly group = new THREE.Group();

  private readonly pool: Particle[] = [];
  private reducedMotion = false;

  constructor(assets: AssetLoader) {
    this.group.name = 'particles';

    const template = assets.cloneStatic('coin');
    template.scale.setScalar(0.34);

    for (let i = 0; i < GAME_CONFIG.maxParticles; i += 1) {
      // clone() shares geometry and material with the cached model, so the
      // whole pool costs one draw-call setup rather than 80 uploads.
      const mesh = template.clone(true);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);

      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
      });
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Emits a burst at a world position. */
  burst(origin: THREE.Vector3, count: number = GAME_CONFIG.particlesPerBurst): void {
    const wanted = this.reducedMotion ? Math.min(4, count) : count;
    let spawned = 0;

    for (const particle of this.pool) {
      if (spawned >= wanted) break;
      if (particle.active) continue;

      particle.active = true;
      particle.life = 0;
      particle.maxLife = 0.75 + Math.random() * 0.35;
      particle.mesh.visible = true;
      particle.mesh.position.copy(origin);
      particle.mesh.rotation.set(0, 0, 0);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.4 + Math.random() * 2.2;
      particle.velocity.set(
        Math.cos(angle) * speed * 0.55,
        4.2 + Math.random() * 2.4,
        Math.sin(angle) * speed * 0.55 - 1.5,
      );
      particle.spin.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8,
      );

      spawned += 1;
    }
  }

  update(delta: number): void {
    for (const particle of this.pool) {
      if (!particle.active) continue;

      particle.life += delta;
      if (particle.life >= particle.maxLife) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }

      particle.velocity.y += GRAVITY * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;

      const fade = 1 - particle.life / particle.maxLife;
      particle.mesh.scale.setScalar(0.34 * Math.max(0.2, fade));
    }
  }

  /** Hides everything; used when a run ends or restarts. */
  clear(): void {
    for (const particle of this.pool) {
      particle.active = false;
      particle.mesh.visible = false;
    }
  }

  dispose(): void {
    this.clear();
    this.group.clear();
    this.pool.length = 0;
  }
}
