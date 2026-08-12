import * as THREE from 'three';
import type { AssetLoader } from '../scene/AssetLoader.ts';
import { applyQuality, createRenderer, resizeRenderer } from '../scene/create-renderer.ts';
import { applyLightQuality, createLights, followLights } from '../scene/create-lights.ts';
import type { SceneLights } from '../scene/create-lights.ts';
import { createClouds, createScene } from '../scene/create-scene.ts';
import type { QualitySettings } from '../scene/quality.ts';
import { FpsProbe, QUALITY_PRESETS, prefersReducedMotion } from '../scene/quality.ts';
import { Player } from './entities/Player.ts';
import { Track } from './entities/Track.ts';
import { CameraSystem } from './systems/CameraSystem.ts';
import { FeedbackSystem } from './systems/FeedbackSystem.ts';
import { ParticleSystem } from './systems/ParticleSystem.ts';
import { QuestionSystem, nearestLane } from './systems/QuestionSystem.ts';
import type { ResolvedAnswer } from './systems/QuestionSystem.ts';
import { StageSystem } from './systems/StageSystem.ts';
import type { StageMode } from './systems/StageSystem.ts';
import { WorldRecycleSystem } from './systems/WorldRecycleSystem.ts';
import { ScoreTracker, computeStars } from '../../shared/scoring/scoring.ts';
import { computeRunPacing } from '../../shared/scoring/run-pacing.ts';
import { GAME_CONFIG } from './game-config.ts';
import type { Grade, LaneIndex, Question, RunResult } from '../../shared/game-types.ts';
import type { RunAnswerInput } from '../../shared/contracts/api.ts';
import { getGradeConfig } from '../../shared/content/grade-config.ts';
import type { LaneDirection } from './systems/InputSystem.ts';

export interface AnswerFeedback {
  question: Question;
  questionIndex: number;
  selectedLane: LaneIndex;
  correct: boolean;
  gainedScore: number;
  score: number;
  streak: number;
}

export interface GameCallbacks {
  onQuestionShown(question: Question, index: number, total: number): void;
  onAnswer(feedback: AnswerFeedback): void;
  onFeedbackEnd(): void;
  onFinished(result: Omit<RunResult, 'isNewBest'>): void;
  onQualityChanged(quality: QualitySettings, measuredFps: number): void;
  onLaneChanged(lane: LaneIndex): void;
}

export interface GameSnapshot {
  lane: LaneIndex;
  score: number;
  streak: number;
  questionIndex: number;
  activeQuestion: Question | null;
  speed: number;
  /** World X of the runner; used by tests to verify lane alignment. */
  playerX: number;
}

/** Sample answers shown on the attract-mode gate; never scored. */
const SHOWCASE_ANSWERS: [string, string, string] = ['7', '12', '9'];

/**
 * The 3D runner.
 *
 * Owns the renderer, the world and the run state. Every screen shares this one
 * scene: `setStage` swaps the camera pose and the set dressing rather than
 * handing over to a separate HTML page.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly lights: SceneLights;
  private readonly track: Track;
  private readonly player: Player;
  private readonly particles: ParticleSystem;
  private decorations: WorldRecycleSystem;
  private readonly questionSystem: QuestionSystem;
  private readonly stage: StageSystem;
  private readonly feedback = new FeedbackSystem();
  private readonly cameraSystem: CameraSystem;
  private readonly score = new ScoreTracker();
  private readonly fpsProbe = new FpsProbe(5);
  private readonly tempVector = new THREE.Vector3();

  private quality: QualitySettings;
  private reducedMotion = prefersReducedMotion();

  private stageMode: StageMode = 'attract';
  private grade: Grade = 1;
  private seed = 0;
  private currentSpeed = 8;
  private runDurationMs = 0;
  /** What the player chose, in the shape the server verifies. */
  private readonly runAnswers: RunAnswerInput[] = [];
  private pendingFinish = false;
  private runActive = false;
  private measureFps = false;
  private celebrationTimer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly assets: AssetLoader,
    quality: QualitySettings,
    private readonly callbacks: GameCallbacks,
  ) {
    this.quality = quality;
    this.renderer = createRenderer(canvas, quality);

    const bundle = createScene(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.scene = bundle.scene;
    this.camera = bundle.camera;

    this.lights = createLights(quality);
    this.scene.add(this.lights.hemisphere, this.lights.sun, this.lights.sunTarget);
    this.scene.add(createClouds());

    this.track = new Track();
    this.scene.add(this.track.group);

    this.player = new Player(assets);
    this.player.setReducedMotion(this.reducedMotion);
    this.scene.add(this.player.group);

    this.particles = new ParticleSystem(assets);
    this.particles.setReducedMotion(this.reducedMotion);
    this.scene.add(this.particles.group);

    this.decorations = new WorldRecycleSystem(assets, 1, quality.decorationScale);
    this.scene.add(this.decorations.group);

    this.stage = new StageSystem(assets);
    this.scene.add(this.stage.group);

    this.questionSystem = new QuestionSystem({
      onQuestionShown: (question, index) => {
        this.callbacks.onQuestionShown(question, index, this.questionSystem.totalQuestions);
      },
      onResolved: (result) => {
        this.handleResolved(result);
      },
    });
    this.scene.add(this.questionSystem.group);

    this.cameraSystem = new CameraSystem(this.camera);
    this.cameraSystem.setReducedMotion(this.reducedMotion);
    this.setStage('attract');
    this.cameraSystem.snapTo(this.player.position);
  }

  /* ---------------------------- Presentation ---------------------------- */

  /**
   * Switches which screen the world is dressed for. The camera eases between
   * poses, so screens change by moving the camera, never by blanking out.
   */
  setStage(mode: StageMode): void {
    this.stageMode = mode;
    this.stage.setMode(mode, this.player.position.z);

    switch (mode) {
      case 'attract':
        this.cameraSystem.setMode('attract');
        this.player.playAnimation('idle');
        this.questionSystem.showcase(SHOWCASE_ANSWERS, this.player.position.z - 34);
        break;
      case 'tutorial':
        this.cameraSystem.setMode('gameplay');
        this.player.playAnimation('sprint');
        this.questionSystem.clearShowcase();
        this.stage.setActiveLane(this.player.targetLane);
        break;
      case 'countdown':
        // Running on the spot: the animation plays while the world holds still.
        this.cameraSystem.setMode('gameplay');
        this.player.playAnimation('sprint');
        break;
      case 'running':
        this.cameraSystem.setMode('gameplay');
        this.player.playAnimation('sprint');
        break;
      case 'result':
        this.cameraSystem.setMode('result');
        this.player.playAnimation('idle');
        this.player.playEmote('emote-yes');
        this.celebrationTimer = 0;
        break;
    }
  }

  /** Rebuilds the roadside pool once models load or the quality level drops. */
  rebuildDecorations(seed: number): void {
    this.scene.remove(this.decorations.group);
    this.decorations.dispose();
    this.decorations = new WorldRecycleSystem(this.assets, seed, this.quality.decorationScale);
    this.scene.add(this.decorations.group);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.player.setReducedMotion(reduced);
    this.particles.setReducedMotion(reduced);
    this.cameraSystem.setReducedMotion(reduced);
  }

  /* ------------------------------ Run state ----------------------------- */

  /** Prepares a fresh run. The countdown runs before `beginRunning()`. */
  prepareRun(grade: Grade, seed: number, questions: readonly Question[]): void {
    this.grade = grade;
    this.seed = seed;
    this.currentSpeed = getGradeConfig(grade).baseSpeed;
    this.runDurationMs = 0;
    this.runAnswers.length = 0;
    this.pendingFinish = false;
    this.runActive = false;

    this.score.reset();
    this.feedback.reset();
    this.particles.clear();
    this.track.reset();
    this.player.reset();
    this.decorations.reset(seed ^ 0x1f2e3d4c);

    // The pacing table is shared with the server, so the gate spacing the
    // player sees is exactly the timing their score is judged against.
    const pacing = computeRunPacing(grade, seed, questions.length);
    this.questionSystem.start(questions, pacing, this.player.position.z);
    this.currentSpeed = this.questionSystem.currentSpeed;
    this.fpsProbe.reset();
    this.measureFps = false;
  }

  /** Runs the world for the tutorial without any questions in play. */
  prepareTutorial(grade: Grade): void {
    // A gentle jog: fast enough to feel like the real thing, slow enough to
    // practise a lane change without pressure.
    this.currentSpeed = getGradeConfig(grade).baseSpeed * 0.7;
    this.player.reset();
    this.track.reset();
    this.questionSystem.reset();
    this.runActive = true;
  }

  /** Called when the countdown finishes. */
  beginRunning(): void {
    this.runActive = true;
    this.measureFps = true;
    this.player.playAnimation('sprint');
  }

  setIdleAnimation(): void {
    this.player.playAnimation('idle');
  }

  moveLane(direction: LaneDirection): boolean {
    if (!this.runActive) return false;
    const moved = this.player.moveLane(direction);
    if (moved) {
      this.afterLaneChange();
    }
    return moved;
  }

  /** Used by the debug bridge in tests; jumps straight to a lane. */
  setLane(lane: LaneIndex): boolean {
    const moved = this.player.setLane(lane);
    if (moved) {
      this.afterLaneChange();
    }
    return moved;
  }

  private afterLaneChange(): void {
    this.questionSystem.notifyLaneChanged();
    this.stage.setActiveLane(this.player.targetLane);
    this.callbacks.onLaneChanged(this.player.targetLane);
  }

  get currentLane(): LaneIndex {
    return this.player.targetLane;
  }

  snapshot(): GameSnapshot {
    return {
      lane: this.player.targetLane,
      score: this.score.score,
      streak: this.score.streak,
      questionIndex: this.questionSystem.questionIndex,
      activeQuestion: this.questionSystem.activeQuestion,
      speed: this.currentSpeed,
      playerX: this.player.position.x,
    };
  }

  /* -------------------------------- Loop -------------------------------- */

  /**
   * Advances the world. `paused` freezes the simulation but still lets the
   * camera and idle animations settle so the scene never looks dead.
   */
  update(delta: number, paused: boolean): void {
    const worldMoving =
      !paused && this.runActive && (this.stageMode === 'running' || this.stageMode === 'tutorial');

    if (worldMoving) {
      const speed = this.currentSpeed * this.feedback.speedMultiplier;
      this.player.update(delta, speed);
      this.track.update(this.player.position.z);
      this.decorations.update(this.player.position.z);

      if (this.stageMode === 'running') {
        this.runDurationMs += delta * 1000;
        this.questionSystem.update(delta, this.player.position);
        this.feedback.update(delta);
        this.probeFps(delta);
      }

      this.cameraSystem.update(delta, this.player.position, speed);
    } else {
      // The world holds still, but the character keeps animating and the
      // camera keeps easing towards its pose - the scene is never frozen.
      this.player.update(delta, 0);
      this.cameraSystem.update(delta, this.player.position, 0);
    }

    this.particles.update(delta);
    this.stage.update(delta, this.player.position.z);
    followLights(this.lights, this.player.position.z);

    if (this.stageMode === 'result' && !paused) {
      this.updateCelebration(delta);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    resizeRenderer(this.renderer, this.camera, width, height);

    // A tall, narrow viewport needs a wider vertical field of view and a
    // pulled-back camera, otherwise the runner fills the screen and the gates
    // are cropped off the sides.
    const portrait = width / Math.max(1, height) < 0.85;
    this.camera.fov = portrait ? GAME_CONFIG.cameraFovPortrait : GAME_CONFIG.cameraFov;
    this.camera.updateProjectionMatrix();
    this.cameraSystem.setPortrait(portrait);
  }

  /** Coins keep popping out of the chest for a couple of seconds. */
  private updateCelebration(delta: number): void {
    if (this.celebrationTimer >= 2.2) return;
    const previous = this.celebrationTimer;
    this.celebrationTimer += delta;
    if (Math.floor(previous / 0.55) === Math.floor(this.celebrationTimer / 0.55)) return;
    this.stage.celebrationOrigin(this.tempVector);
    this.particles.burst(this.tempVector, 6);
  }

  private probeFps(delta: number): void {
    if (!this.measureFps) return;
    const fps = this.fpsProbe.sample(delta);
    if (fps === null) return;

    this.measureFps = false;
    if (fps >= 45 || this.quality.level === 'low') return;

    this.quality = QUALITY_PRESETS.low;
    applyQuality(this.renderer, this.quality);
    applyLightQuality(this.lights, this.quality);
    this.rebuildDecorations(this.seed ^ 0x1f2e3d4c);
    this.callbacks.onQualityChanged(this.quality, fps);
  }

  private handleResolved(result: ResolvedAnswer): void {
    // Recorded for the server to verify. No score is ever sent - only what the
    // player picked and how long they took to decide.
    this.runAnswers.push({
      questionIndex: result.questionIndex,
      selectedIndex: result.selectedLane,
      responseMs: Math.round(result.decisionMs),
    });

    const gained = this.score.register({
      correct: result.correct,
      decisionMs: result.decisionMs,
      windowMs: result.windowMs,
    });

    if (result.correct) {
      this.particles.burst(result.gatePosition);
      this.player.playEmote('emote-yes');
    } else {
      this.player.playEmote('emote-no');
    }

    this.callbacks.onAnswer({
      question: result.question,
      questionIndex: result.questionIndex,
      selectedLane: result.selectedLane,
      correct: result.correct,
      gainedScore: gained,
      score: this.score.score,
      streak: this.score.streak,
    });

    // Show the next question immediately so the player gets its full reading
    // window while the feedback ribbon is still on screen.
    const hasNext = this.questionSystem.advance(this.player.position.z);
    this.currentSpeed = this.questionSystem.currentSpeed;
    this.pendingFinish = !hasNext;

    this.feedback.begin(result.correct, () => {
      if (this.pendingFinish) {
        this.finishRun();
      } else {
        this.callbacks.onFeedbackEnd();
      }
    });
  }

  private finishRun(): void {
    this.runActive = false;
    this.pendingFinish = false;

    this.callbacks.onFinished({
      grade: this.grade,
      seed: this.seed,
      totalQuestions: this.questionSystem.totalQuestions,
      correctAnswers: this.score.correctAnswers,
      score: this.score.score,
      bestStreak: this.score.bestStreak,
      stars: computeStars(this.score.correctAnswers, this.questionSystem.totalQuestions),
      durationMs: Math.round(this.runDurationMs),
    });
  }

  /** Lane the runner would pick right now; drives the gate glow ring. */
  get committedLane(): LaneIndex {
    return nearestLane(this.player.position.x);
  }

  /** The run's answers, ready to be submitted for server verification. */
  get answers(): RunAnswerInput[] {
    return [...this.runAnswers];
  }

  get elapsedMs(): number {
    return Math.round(this.runDurationMs);
  }

  dispose(): void {
    this.questionSystem.dispose();
    this.particles.dispose();
    this.decorations.dispose();
    this.stage.dispose();
    this.track.dispose();
    this.player.dispose();
    this.scene.clear();
    // dispose() alone leaves the WebGL context alive. Without an explicit
    // release, a reload can hit Chrome's "context loss was blocked" guard and
    // the next page load gets no context at all.
    this.renderer.forceContextLoss();
    this.renderer.dispose();
  }
}
