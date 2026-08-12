import * as THREE from 'three';
import type { ParticlePresetId } from '../../../shared/maps/map-manifest.ts';
import type { Rng } from '../../../shared/math/seeded-rng.ts';
import type { QualitySettings } from '../../scene/quality.ts';

interface ParticlePreset {
  color: string;
  size: number;
  /** How many are visible at once on a desktop at high quality. */
  count: number;
  /** Drift speed in world units per second. */
  drift: number;
  opacity: number;
}

/**
 * Budgets come straight from the map specification: at most 40 decorative
 * particles on mobile and 100 on desktop, per map.
 */
const PRESETS: Readonly<Record<ParticlePresetId, ParticlePreset>> = {
  'soft-stars': { color: '#FFF6C9', size: 0.5, count: 70, drift: 0.6, opacity: 0.85 },
  'pollen-light': { color: '#FFF3B0', size: 0.32, count: 60, drift: 0.4, opacity: 0.7 },
  'slow-stars': { color: '#CFE4FF', size: 0.42, count: 90, drift: 0.25, opacity: 0.9 },
  fireflies: { color: '#FFE58A', size: 0.4, count: 55, drift: 0.5, opacity: 0.95 },
  'confetti-sparse': { color: '#FFD1E8', size: 0.45, count: 50, drift: 0.7, opacity: 0.8 },
};

const AREA = { width: 46, height: 16, depth: 150 };

/**
 * The gentle ambient sparkle of a map.
 *
 * One `Points` object, one draw call, no per-frame allocation. It is switched
 * off entirely for players who asked for reduced motion, and thinned out on low
 * quality, because it is decoration and never information.
 */
export class MapParticles {
  readonly points: THREE.Points;

  private readonly preset: ParticlePreset;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly maxCount: number;
  private reducedMotion = false;
  private phase = 0;

  constructor(presetId: ParticlePresetId, rng: Rng, quality: QualitySettings) {
    this.preset = PRESETS[presetId];

    const budget = quality.level === 'low' ? 0.4 : quality.level === 'medium' ? 0.7 : 1;
    this.maxCount = Math.max(12, Math.round(this.preset.count * budget));

    this.positions = new Float32Array(this.maxCount * 3);
    this.speeds = new Float32Array(this.maxCount);

    for (let i = 0; i < this.maxCount; i += 1) {
      this.positions[i * 3] = (rng.next() - 0.5) * AREA.width;
      this.positions[i * 3 + 1] = 1 + rng.next() * AREA.height;
      this.positions[i * 3 + 2] = -rng.next() * AREA.depth;
      this.speeds[i] = 0.5 + rng.next();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(this.preset.color),
      size: this.preset.size,
      transparent: true,
      opacity: this.preset.opacity,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = 'map-particles';
    this.points.frustumCulled = false;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.points.visible = !reduced;
  }

  setQuality(quality: QualitySettings): void {
    this.points.visible = quality.level !== 'low' && !this.reducedMotion;
  }

  /** Keeps the cloud of particles centred on the player. */
  update(delta: number, playerZ: number): void {
    if (this.reducedMotion || !this.points.visible) return;

    this.phase += delta;
    const attribute = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < this.maxCount; i += 1) {
      const base = i * 3;
      const y = this.positions[base + 1] ?? 0;
      const speed = this.speeds[i] ?? 1;
      this.positions[base + 1] = y + Math.sin(this.phase * speed) * this.preset.drift * delta;

      // Wrap around the player so the field never runs out ahead or behind.
      const z = this.positions[base + 2] ?? 0;
      const relative = z - playerZ;
      if (relative > 20) {
        this.positions[base + 2] = playerZ - AREA.depth;
      } else if (relative < -AREA.depth) {
        this.positions[base + 2] = playerZ + 20;
      }
    }

    attribute.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    const material = this.points.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material.dispose();
    }
  }
}
