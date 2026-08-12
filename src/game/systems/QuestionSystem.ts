import * as THREE from 'three';
import { Gate } from '../entities/Gate.ts';
import { GAME_CONFIG, LANE_POSITIONS_X } from '../game-config.ts';
import type { LaneIndex, Question } from '../../../shared/game-types.ts';
import type { QuestionPacing } from '../../../shared/scoring/run-pacing.ts';

export interface ResolvedAnswer {
  question: Question;
  questionIndex: number;
  selectedLane: LaneIndex;
  correct: boolean;
  /** Time from the question appearing to the player settling on a lane. */
  decisionMs: number;
  /** Time the player had before reaching the gate. */
  windowMs: number;
  /** World position of the gate, used to place the reward burst. */
  gatePosition: THREE.Vector3;
}

export interface QuestionSystemCallbacks {
  onQuestionShown(question: Question, index: number): void;
  onResolved(result: ResolvedAnswer): void;
}

const GATE_POOL_SIZE = 3;

/**
 * Drives the question -> gate -> answer cycle.
 *
 * It knows nothing about arithmetic: a question is a prompt, three answer
 * labels and an index. Any future content pack (spelling, vocabulary) can use
 * this system unchanged.
 */
export class QuestionSystem {
  readonly group = new THREE.Group();

  private readonly gates: Gate[] = [];
  private questions: readonly Question[] = [];
  private pacing: readonly QuestionPacing[] = [];
  private index = -1;
  private activeGate: Gate | null = null;

  private questionShownAt = 0;
  private lastLaneChangeAt = 0;
  private currentWindowMs = 0;
  private previousPlayerZ = 0;
  private showcaseGate: Gate | null = null;
  /** Gameplay clock in milliseconds; excludes paused time. */
  private clockMs = 0;

  private readonly tempPosition = new THREE.Vector3();

  constructor(private readonly callbacks: QuestionSystemCallbacks) {
    this.group.name = 'gates';
    for (let i = 0; i < GATE_POOL_SIZE; i += 1) {
      const gate = new Gate();
      this.gates.push(gate);
      this.group.add(gate.group);
    }
  }

  get activeQuestion(): Question | null {
    return this.questions[this.index] ?? null;
  }

  get questionIndex(): number {
    return this.index;
  }

  get totalQuestions(): number {
    return this.questions.length;
  }

  /** True once every question has been resolved. */
  get isComplete(): boolean {
    return this.index >= this.questions.length - 1 && this.activeGate === null;
  }

  /**
   * Parks a decorative gate on the track for the attract screen.
   * It is never resolved and never scored - it exists so the home screen shows
   * the real game object the player will be running towards.
   */
  showcase(answers: readonly [string, string, string], z: number): void {
    this.recycleAll();
    const gate = this.takeGate();
    if (gate === null) return;
    gate.setQuestion(answers, 1, z);
    gate.lock();
    this.showcaseGate = gate;
  }

  clearShowcase(): void {
    this.showcaseGate?.recycle();
    this.showcaseGate = null;
  }

  /**
   * Begins a run and arms the first gate.
   *
   * `pacing` comes from the shared run-pacing module, which is the same code
   * the server uses when it recomputes the score, so both sides agree on how
   * long the player had for each question.
   */
  start(questions: readonly Question[], pacing: readonly QuestionPacing[], playerZ: number): void {
    this.recycleAll();
    this.questions = questions;
    this.pacing = pacing;
    this.index = -1;
    this.clockMs = 0;
    this.previousPlayerZ = playerZ;
    this.advance(playerZ);
  }

  /**
   * Shows the next question and places its gate.
   * Returns false when there are no questions left.
   */
  advance(playerZ: number): boolean {
    const nextIndex = this.index + 1;
    const question = this.questions[nextIndex];
    const window = this.pacing[nextIndex];
    if (question === undefined || window === undefined) return false;

    const gate = this.takeGate();
    if (gate === null) return false;

    gate.setQuestion(question.answers, question.correctIndex, playerZ - window.distance);

    this.index = nextIndex;
    this.activeGate = gate;
    this.questionShownAt = this.clockMs;
    this.lastLaneChangeAt = this.clockMs;
    this.currentWindowMs = window.windowMs;

    this.callbacks.onQuestionShown(question, nextIndex);
    return true;
  }

  /** World speed while the current question is on screen. */
  get currentSpeed(): number {
    return this.pacing[Math.max(0, this.index)]?.speed ?? 8;
  }

  /** Records that the player moved, which is what the speed bonus measures. */
  notifyLaneChanged(): void {
    this.lastLaneChangeAt = this.clockMs;
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    this.clockMs += delta * 1000;

    const currentZ = playerPosition.z;
    const gate = this.activeGate;

    if (gate !== null) {
      const gateZ = gate.z;
      // Test the movement of this frame, not a single absolute position, so a
      // long frame can never step straight past the gate without triggering.
      const crossedGate = this.previousPlayerZ > gateZ && currentZ <= gateZ;

      if (crossedGate) {
        this.resolveGate(gate, playerPosition);
      } else if (this.previousPlayerZ - gateZ < 8) {
        // Close to the trigger the answer is committed: lock it and light up
        // the lane the runner is standing in.
        gate.lock();
        gate.setHighlight(nearestLane(playerPosition.x));
      }
    }

    this.previousPlayerZ = currentZ;
    this.recycleFinishedGates(currentZ);
  }

  private resolveGate(gate: Gate, playerPosition: THREE.Vector3): void {
    const question = this.questions[this.index];
    if (question === undefined) return;

    const selectedLane = nearestLane(playerPosition.x);
    const correct = selectedLane === question.correctIndex;

    gate.resolve(selectedLane);
    this.activeGate = null;

    this.tempPosition.set(playerPosition.x, 1.5, gate.z);

    this.callbacks.onResolved({
      question,
      questionIndex: this.index,
      selectedLane,
      correct,
      decisionMs: Math.max(0, this.lastLaneChangeAt - this.questionShownAt),
      windowMs: this.currentWindowMs,
      gatePosition: this.tempPosition,
    });
  }

  private takeGate(): Gate | null {
    for (const gate of this.gates) {
      if (gate.currentState === 'idle') return gate;
    }
    return null;
  }

  private recycleFinishedGates(playerZ: number): void {
    for (const gate of this.gates) {
      if (gate.currentState !== 'resolved') continue;
      if (gate.z < playerZ + GAME_CONFIG.recycleBehindDistance) continue;
      gate.recycle();
    }
  }

  private recycleAll(): void {
    for (const gate of this.gates) gate.recycle();
    this.activeGate = null;
    this.showcaseGate = null;
  }

  reset(): void {
    this.recycleAll();
    this.questions = [];
    this.pacing = [];
    this.index = -1;
    this.clockMs = 0;
  }

  dispose(): void {
    for (const gate of this.gates) gate.dispose();
    this.gates.length = 0;
    this.group.clear();
  }
}

/** Picks the lane whose centre is closest to a world X position. */
export function nearestLane(x: number): LaneIndex {
  let best: LaneIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let lane = 0; lane < 3; lane += 1) {
    const laneX = LANE_POSITIONS_X[lane];
    if (laneX === undefined) continue;
    const distance = Math.abs(x - laneX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = lane as LaneIndex;
    }
  }
  return best;
}
