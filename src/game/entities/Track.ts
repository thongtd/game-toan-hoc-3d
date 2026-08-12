import * as THREE from 'three';
import { COLORS, GAME_CONFIG, LANE_POSITIONS_X } from '../game-config.ts';

/**
 * The endless road.
 *
 * A fixed ring of segments is recycled in front of the player: nothing is
 * created or destroyed while running. Geometry and materials are built once
 * and shared by every segment.
 */
export interface TrackPalette {
  /** Road surface colour. */
  road: string;
  /** Kerb colour; the map's accent runs along both edges of the road. */
  edge: string;
  /** Colour of the ground the road sits on. */
  ground: string;
  /** False for maps whose road floats in the sky or in orbit. */
  groundVisible: boolean;
}

export class Track {
  readonly group = new THREE.Group();

  private readonly segments: THREE.Group[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly groundMeshes: THREE.Mesh[] = [];
  private readonly roadMaterial: THREE.MeshStandardMaterial;
  private readonly grassMaterial: THREE.MeshStandardMaterial;
  private readonly kerbMaterial: THREE.MeshStandardMaterial;

  private readonly segmentLength = GAME_CONFIG.trackSegmentLength;

  constructor() {
    this.group.name = 'track';

    const roadGeometry = new THREE.BoxGeometry(GAME_CONFIG.trackWidth, 0.6, this.segmentLength);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.road,
      roughness: 0.95,
      metalness: 0,
    });

    const grassGeometry = new THREE.BoxGeometry(60, 0.5, this.segmentLength);
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.grass,
      roughness: 1,
      metalness: 0,
    });

    const dashGeometry = new THREE.BoxGeometry(0.16, 0.02, 2.6);
    const dashMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.roadLine,
      roughness: 0.7,
      metalness: 0,
      emissive: new THREE.Color(COLORS.roadLine),
      emissiveIntensity: 0.12,
    });

    const kerbGeometry = new THREE.BoxGeometry(0.5, 0.34, this.segmentLength);
    const kerbMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9eef5,
      roughness: 0.8,
      metalness: 0,
    });

    this.ownedGeometries.push(roadGeometry, grassGeometry, dashGeometry, kerbGeometry);
    this.ownedMaterials.push(roadMaterial, grassMaterial, dashMaterial, kerbMaterial);
    this.roadMaterial = roadMaterial;
    this.grassMaterial = grassMaterial;
    this.kerbMaterial = kerbMaterial;

    for (let i = 0; i < GAME_CONFIG.trackSegmentCount; i += 1) {
      const segment = new THREE.Group();

      const grass = new THREE.Mesh(grassGeometry, grassMaterial);
      grass.position.y = -0.3;
      grass.receiveShadow = true;
      segment.add(grass);
      this.groundMeshes.push(grass);

      const road = new THREE.Mesh(roadGeometry, roadMaterial);
      road.position.y = -0.05;
      road.receiveShadow = true;
      segment.add(road);

      for (const side of [-1, 1] as const) {
        const kerb = new THREE.Mesh(kerbGeometry, kerbMaterial);
        kerb.position.set((side * GAME_CONFIG.trackWidth) / 2, 0.06, 0);
        kerb.receiveShadow = true;
        segment.add(kerb);
      }

      // Dashed lane dividers, halfway between neighbouring lanes.
      const dividerX = [
        (LANE_POSITIONS_X[0] + LANE_POSITIONS_X[1]) / 2,
        (LANE_POSITIONS_X[1] + LANE_POSITIONS_X[2]) / 2,
      ];
      for (const x of dividerX) {
        for (let d = 0; d < 4; d += 1) {
          const dash = new THREE.Mesh(dashGeometry, dashMaterial);
          dash.position.set(x, 0.26, -this.segmentLength / 2 + 2.5 + d * 5);
          segment.add(dash);
        }
      }

      segment.position.z = -i * this.segmentLength;
      this.segments.push(segment);
      this.group.add(segment);
    }
  }

  /**
   * Recolours the road for the active map.
   *
   * The geometry never changes - every map runs on exactly the same three
   * lanes - so a map can only ever alter the colours and whether the ground
   * beneath the road is drawn at all.
   */
  setPalette(palette: TrackPalette): void {
    this.roadMaterial.color.set(palette.road);
    this.kerbMaterial.color.set(palette.edge);
    this.grassMaterial.color.set(palette.ground);
    for (const ground of this.groundMeshes) {
      ground.visible = palette.groundVisible;
    }
  }

  /** Recycles any segment that has fallen behind the camera. */
  update(playerZ: number): void {
    const behindLimit = playerZ + GAME_CONFIG.recycleBehindDistance;

    for (const segment of this.segments) {
      if (segment.position.z <= behindLimit) continue;
      const furthest = this.furthestZ();
      segment.position.z = furthest - this.segmentLength;
    }
  }

  private furthestZ(): number {
    let furthest = Number.POSITIVE_INFINITY;
    for (const segment of this.segments) {
      furthest = Math.min(furthest, segment.position.z);
    }
    return furthest;
  }

  /** Puts every segment back to its starting layout. */
  reset(): void {
    this.segments.forEach((segment, index) => {
      segment.position.z = -index * this.segmentLength;
    });
  }

  dispose(): void {
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.group.clear();
    this.segments.length = 0;
    this.groundMeshes.length = 0;
  }
}
