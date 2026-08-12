import * as THREE from 'three';
import { COLORS, CSS_COLORS, LANE_GATE_COLORS, LANE_POSITIONS_X } from '../game-config.ts';
import type { LaneIndex } from '../../../shared/game-types.ts';

export type GateState = 'idle' | 'approaching' | 'locked' | 'resolved';

export type PanelState = 'neutral' | 'correct' | 'wrong';

const PANEL_TEXTURE_WIDTH = 1024;
const PANEL_TEXTURE_HEIGHT = 512;
const PANEL_WIDTH = 2.15;
const PANEL_HEIGHT = 1.075;
const POST_HEIGHT = 3.4;

/**
 * One answer board.
 *
 * The label is drawn into a canvas and uploaded as a texture rather than being
 * a DOM overlay: a CSS2D label drifts out of place when the browser is zoomed,
 * while a texture stays welded to the geometry and scales with perspective.
 */
class AnswerPanel {
  readonly mesh: THREE.Mesh;

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly texture: THREE.CanvasTexture;
  private text = '';
  private state: PanelState = 'neutral';

  constructor(geometry: THREE.PlaneGeometry) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PANEL_TEXTURE_WIDTH;
    this.canvas.height = PANEL_TEXTURE_HEIGHT;

    const context = this.canvas.getContext('2d');
    if (context === null) {
      throw new Error('2D canvas context is unavailable for answer panels');
    }
    this.context = context;

    // One texture per panel for the whole session: the canvas is redrawn in
    // place, so changing question never allocates or leaks a GPU texture.
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  get currentText(): string {
    return this.text;
  }

  setContent(text: string, state: PanelState): void {
    if (this.text === text && this.state === state) return;
    this.text = text;
    this.state = state;
    this.draw();
  }

  private draw(): void {
    const ctx = this.context;
    const width = PANEL_TEXTURE_WIDTH;
    const height = PANEL_TEXTURE_HEIGHT;

    ctx.clearRect(0, 0, width, height);

    const background =
      this.state === 'correct'
        ? CSS_COLORS.panelCorrect
        : this.state === 'wrong'
          ? CSS_COLORS.panelWrong
          : CSS_COLORS.panelBackground;
    const foreground = this.state === 'neutral' ? CSS_COLORS.panelText : '#ffffff';

    roundedRect(ctx, 16, 16, width - 32, height - 32, 54);
    ctx.fillStyle = background;
    ctx.fill();
    ctx.lineWidth = 20;
    ctx.strokeStyle = CSS_COLORS.panelBorder;
    ctx.stroke();

    // A symbol as well as a colour, so the outcome is never colour-only.
    const symbol = this.state === 'correct' ? '✓' : this.state === 'wrong' ? '✕' : '';
    const label = symbol === '' ? this.text : `${symbol} ${this.text}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = 250;
    const maxWidth = width - 130;
    do {
      ctx.font = `800 ${String(fontSize)}px "Baloo 2", ui-rounded, "Segoe UI", Arial, sans-serif`;
      if (ctx.measureText(label).width <= maxWidth) break;
      fontSize -= 12;
    } while (fontSize > 60);

    // Dark stroke behind the glyphs keeps them readable from a distance.
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(10, fontSize * 0.09);
    ctx.strokeStyle = CSS_COLORS.panelBorder;
    ctx.strokeText(label, width / 2, height / 2 + 10);
    ctx.fillStyle = foreground;
    ctx.fillText(label, width / 2, height / 2 + 10);

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}

/**
 * A three-lane answer gate.
 *
 * Gates are pooled: `setQuestion` reuses the same meshes for every question,
 * so nothing is allocated during a run.
 */
export class Gate {
  readonly group = new THREE.Group();

  private readonly panels: AnswerPanel[] = [];
  private readonly frameMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly ringMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly rings: THREE.Mesh[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];

  private state: GateState = 'idle';
  private correctLane: LaneIndex = 0;
  private highlighted: LaneIndex | null = null;

  constructor() {
    this.group.name = 'gate';
    this.group.visible = false;

    const postGeometry = new THREE.BoxGeometry(0.3, POST_HEIGHT, 0.3);
    const beamGeometry = new THREE.BoxGeometry(2.5, 0.38, 0.34);
    const panelGeometry = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT);
    const ringGeometry = new THREE.RingGeometry(0.85, 1.15, 28);
    this.ownedGeometries.push(postGeometry, beamGeometry, panelGeometry, ringGeometry);

    for (let lane = 0; lane < 3; lane += 1) {
      const laneGroup = new THREE.Group();
      laneGroup.position.x = LANE_POSITIONS_X[lane] ?? 0;

      const material = new THREE.MeshStandardMaterial({
        color: LANE_GATE_COLORS[lane] ?? COLORS.secondary,
        roughness: 0.55,
        metalness: 0,
      });
      this.frameMaterials.push(material);

      for (const side of [-1, 1] as const) {
        const post = new THREE.Mesh(postGeometry, material);
        post.position.set(side * 1.18, POST_HEIGHT / 2, 0);
        post.castShadow = true;
        laneGroup.add(post);
      }

      const beam = new THREE.Mesh(beamGeometry, material);
      beam.position.set(0, POST_HEIGHT - 0.19, 0);
      beam.castShadow = true;
      laneGroup.add(beam);

      const panel = new AnswerPanel(panelGeometry);
      panel.mesh.position.set(0, POST_HEIGHT - 1.15, 0.08);
      this.panels.push(panel);
      laneGroup.add(panel.mesh);

      // Glow ring at the foot of the lane, shown once the answer is locked in.
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.coin,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      this.ringMaterials.push(ringMaterial);

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      ring.visible = false;
      this.rings.push(ring);
      laneGroup.add(ring);

      this.group.add(laneGroup);
    }
  }

  get z(): number {
    return this.group.position.z;
  }

  get currentState(): GateState {
    return this.state;
  }

  /** Arms the gate at a world Z with a new set of answers. */
  setQuestion(
    answers: readonly [string, string, string],
    correctIndex: LaneIndex,
    z: number,
  ): void {
    this.correctLane = correctIndex;
    this.group.position.z = z;
    this.group.visible = true;
    this.state = 'approaching';
    this.setHighlight(null);

    for (let lane = 0; lane < 3; lane += 1) {
      const panel = this.panels[lane];
      const text = answers[lane];
      if (panel === undefined || text === undefined) continue;
      panel.setContent(text, 'neutral');
      this.frameMaterials[lane]?.color.setHex(LANE_GATE_COLORS[lane] ?? COLORS.secondary);
    }
  }

  /** Locks the answer in; no further input can change it. */
  lock(): void {
    if (this.state === 'approaching') {
      this.state = 'locked';
    }
  }

  /** Shows the glow ring under the lane the runner is currently committed to. */
  setHighlight(lane: LaneIndex | null): void {
    if (this.highlighted === lane) return;
    this.highlighted = lane;
    this.rings.forEach((ring, index) => {
      ring.visible = lane === index && this.state !== 'resolved';
    });
  }

  /** Paints the outcome: chosen lane and, when wrong, the correct one too. */
  resolve(selectedLane: LaneIndex): void {
    this.state = 'resolved';
    for (const ring of this.rings) ring.visible = false;
    this.highlighted = null;

    const wasCorrect = selectedLane === this.correctLane;

    const selectedPanel = this.panels[selectedLane];
    if (selectedPanel !== undefined) {
      selectedPanel.setContent(selectedPanel.currentText, wasCorrect ? 'correct' : 'wrong');
    }
    this.frameMaterials[selectedLane]?.color.setHex(wasCorrect ? COLORS.correct : COLORS.wrong);

    if (!wasCorrect) {
      const correctPanel = this.panels[this.correctLane];
      if (correctPanel !== undefined) {
        correctPanel.setContent(correctPanel.currentText, 'correct');
      }
      this.frameMaterials[this.correctLane]?.color.setHex(COLORS.correct);
    }
  }

  /** Returns the gate to the pool. */
  recycle(): void {
    this.state = 'idle';
    this.group.visible = false;
    this.group.position.z = 0;
    for (const ring of this.rings) ring.visible = false;
    this.highlighted = null;
  }

  dispose(): void {
    for (const panel of this.panels) panel.dispose();
    for (const material of this.frameMaterials) material.dispose();
    for (const material of this.ringMaterials) material.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    this.panels.length = 0;
    this.frameMaterials.length = 0;
    this.ringMaterials.length = 0;
    this.rings.length = 0;
    this.ownedGeometries.length = 0;
    this.group.clear();
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
