import { AppState } from './app-state.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { AssetLoadError, AssetLoader } from '../scene/AssetLoader.ts';
import { WebGLUnavailableError } from '../scene/create-renderer.ts';
import { detectInitialQuality, prefersReducedMotion } from '../scene/quality.ts';
import { Game } from '../game/Game.ts';
import type { AnswerFeedback } from '../game/Game.ts';
import { GameClock } from '../game/GameClock.ts';
import { GAME_CONFIG } from '../game/game-config.ts';
import type { Grade, LaneIndex, Question, RunResult } from '../../shared/game-types.ts';
import { isGrade } from '../../shared/game-types.ts';
import { InputSystem } from '../game/systems/InputSystem.ts';
import type { LaneDirection } from '../game/systems/InputSystem.ts';
import { GenerationExhaustedError, generateQuestions } from '../../shared/math/question-generator.ts';
import { buildFallbackRun } from '../../shared/content/seed-questions.ts';
import { createRng, createTimeSeed } from '../../shared/math/seeded-rng.ts';
import { GameStorage } from '../storage/GameStorage.ts';
import { UIController } from '../ui/UIController.ts';
import { onClick, requireElement, requireElementOfType } from '../ui/dom.ts';
import { installDebugBridge } from './debug-bridge.ts';
import { ApiClient, ApiRequestError } from '../api/ApiClient.ts';
import { leaderboardApi, runsApi } from '../api/game-api.ts';
import { PlayerSession } from '../player/PlayerSession.ts';
import { PlayerHubScreen } from '../ui/screens/PlayerHubScreen.ts';
import type { PlayerDraft } from '../ui/screens/PlayerHubScreen.ts';
import type { LeaderboardFilters } from '../ui/components/LeaderboardBoard.ts';
import { suggestGradeForAge } from '../../shared/validation/profile.ts';
import type { StartRunResponse, VerifiedRunResult } from '../../shared/contracts/api.ts';

/** Practice mode is opt-in and never reaches the leaderboard. */
const ALLOW_PRACTICE_OFFLINE = import.meta.env.VITE_ALLOW_PRACTICE_OFFLINE === 'true';

/**
 * Wires everything together.
 *
 * `App` is the only place that changes the application phase; the UI raises
 * intents and the game raises results, and this class decides what that means.
 */
export class App {
  private readonly state = new AppState();
  private readonly storage = GameStorage.fromWindow();
  private readonly assets = new AssetLoader();
  private readonly audio: AudioManager;
  private readonly ui: UIController;
  private readonly clock = new GameClock();
  private readonly canvas: HTMLCanvasElement;
  private readonly input: InputSystem;

  private readonly api: ApiClient;
  private readonly session: PlayerSession;
  private readonly hub: PlayerHubScreen;

  private game: Game | null = null;
  private grade: Grade;
  private lastResult: RunResult | null = null;
  private countdownElapsedMs = 0;
  private countdownStep = -1;
  private frameHandle = 0;
  private resizeObserver: ResizeObserver | null = null;
  /** The run session issued by the server; null means practice mode. */
  private activeRun: StartRunResponse | null = null;
  private leaderboardRequestId = 0;

  constructor() {
    this.canvas = requireElementOfType('game-canvas', HTMLCanvasElement);
    // A dev-only ?grade= override makes a specific grade reproducible by hand.
    this.grade = readDevOverrides().grade ?? this.storage.selectedGrade;
    this.audio = new AudioManager(this.storage.muted);

    this.ui = new UIController({
      selectGrade: (grade) => {
        this.selectGrade(grade);
      },
      start: () => {
        this.handleStart();
      },
      tutorialReady: () => {
        this.audio.play('click');
        void this.beginCountdown(true);
      },
      skipTutorial: () => {
        this.audio.play('click');
        void this.beginCountdown(true);
      },
      resume: () => {
        this.resumeGame();
      },
      restart: () => {
        this.restartRun();
      },
      goHome: () => {
        this.returnHome();
      },
      replay: () => {
        this.audio.play('click');
        void this.beginCountdown(false);
      },
      changeGrade: () => {
        this.audio.play('click');
        this.returnHome();
      },
      toggleMute: () => {
        this.toggleMute();
      },
      togglePause: () => {
        this.togglePause();
      },
      retryLoad: () => {
        void this.loadAssets();
      },
      hover: () => {
        this.audio.play('rollover', 400);
      },
    });

    this.input = new InputSystem(this.canvas, {
      onLane: (direction, source) => {
        this.handleLaneInput(direction, source);
      },
      onTogglePause: () => {
        this.togglePause();
      },
      onToggleMute: () => {
        this.toggleMute();
      },
    });

    this.api = new ApiClient({
      onUnauthorized: () => {
        // The token no longer works: drop it and let the player start fresh.
        this.session.signOut();
      },
    });
    this.session = new PlayerSession(this.api);

    this.hub = new PlayerHubScreen({
      onSave: (draft) => {
        void this.saveProfile(draft);
      },
      onEnterRace: () => {
        this.audio.unlock();
        this.audio.play('click');
        this.enterHome();
      },
      onFiltersChanged: (filters) => {
        this.audio.play('switch');
        this.session.storage.setPreferences({ grade: filters.grade, period: filters.period });
        this.grade = filters.grade;
        void this.loadLeaderboard(filters);
      },
      onRefreshLeaderboard: () => {
        void this.loadLeaderboard(this.hub.leaderboard.currentFilters);
      },
      onAvatarPreview: () => {
        this.audio.play('switch');
      },
    });

    onClick(requireElement('btn-mute-hub'), () => {
      this.toggleMute();
    });
    onClick(requireElement('btn-credits-hub'), () => {
      this.ui.openCredits();
    });

    this.ui.setMuted(this.audio.isMuted);
  }

  /* ------------------------------- Boot ------------------------------ */

  async start(): Promise<void> {
    this.registerGlobalListeners();
    this.input.attach();
    this.input.bindPad(this.ui.lanePads.left, -1);
    this.input.bindPad(this.ui.lanePads.right, 1);

    this.ui.showLoading();
    this.ui.setLoadingProgress(0);
    this.state.transition('loading');

    await this.loadAssets();
  }

  private async loadAssets(): Promise<void> {
    if (this.state.phase === 'error') {
      this.state.transition('loading');
    }
    this.ui.showLoading();
    this.ui.setLoadingProgress(0.05);

    this.assets.onProgress((progress) => {
      this.ui.setLoadingProgress(0.05 + progress.ratio * 0.8);
    });

    try {
      // The answer panels are drawn into a canvas, so the game font has to be
      // ready before the first gate is painted or the labels fall back.
      await loadGameFont();
      await this.assets.loadEssential();
      this.audio.loadEffects();

      this.game ??= this.createGame();

      this.ui.setLoadingProgress(1, 'Sẵn sàng!');
      this.startLoop();
      await this.enterPlayerHub();

      // Scenery is not needed for the menu, so it streams in afterwards.
      void this.loadDecorations();
    } catch (error) {
      this.handleFatalError(error);
    }
  }

  private async loadDecorations(): Promise<void> {
    try {
      await this.assets.loadDecorations();
      this.game?.rebuildDecorations(createTimeSeed());
      // The stage props use the decorative models, so refresh the dressing.
      this.game?.setStage(this.state.phase === 'home' ? 'attract' : 'attract');
    } catch {
      // Scenery is optional - the run works without it.
      console.warn('Không tải được cây cối trang trí; đường đua vẫn chơi được.');
    }
  }

  private createGame(): Game {
    const quality = detectInitialQuality();
    const game = new Game(this.canvas, this.assets, quality, {
      onQuestionShown: (question, index, total) => {
        this.ui.setQuestion(question.prompt, index, total);
      },
      onAnswer: (feedback) => {
        this.handleAnswer(feedback);
      },
      onFeedbackEnd: () => {
        this.ui.hideFeedback();
        if (this.state.phase === 'feedback') {
          this.state.transition('running');
        }
      },
      onFinished: (result) => {
        this.handleFinished(result);
      },
      onQualityChanged: (_quality, fps) => {
        console.warn(`Giảm chất lượng đồ hoạ để giữ độ mượt (đo được ${fps.toFixed(0)} FPS).`);
      },
      onLaneChanged: () => {
        if (this.state.phase === 'tutorial') {
          this.ui.markTutorialPractised();
        }
      },
    });

    game.setReducedMotion(prefersReducedMotion());
    this.applyCanvasSize(game);
    return game;
  }

  private handleFatalError(error: unknown): void {
    const message =
      error instanceof WebGLUnavailableError
        ? 'Trình duyệt này chưa hỗ trợ đồ hoạ 3D. Bạn thử mở bằng Chrome, Edge hoặc Safari bản mới nhé!'
        : error instanceof AssetLoadError
          ? 'Có vẻ mạng đang chậm nên chưa tải xong hình ảnh. Bạn thử lại nhé!'
          : 'Đã có lỗi khi chuẩn bị trò chơi. Bạn thử lại nhé!';

    console.error('Không khởi động được trò chơi:', error);
    if (this.state.phase !== 'error') {
      this.state.transition('error');
    }
    this.ui.showError(message);
  }

  /* ---------------------------- Player Hub --------------------------- */

  /**
   * Opens the hub.
   *
   * The leaderboard and the profile load independently: a leaderboard outage
   * must never stop a child from creating a profile and playing.
   */
  private async enterPlayerHub(): Promise<void> {
    if (this.state.phase !== 'player-hub') {
      this.state.transition('player-hub');
    }
    this.input.setEnabled(false);
    this.game?.setStage('attract');

    const prefs = this.session.storage.getPreferences();
    this.grade = prefs.grade;
    this.hub.leaderboard.setFilters({ grade: prefs.grade, period: prefs.period });
    this.ui.screens.show('playerHub');

    void this.loadLeaderboard({ grade: prefs.grade, period: prefs.period });
    await this.restoreProfile();
  }

  private async restoreProfile(): Promise<void> {
    const cached = this.session.player;
    if (cached !== null) {
      this.hub.showReturning(cached);
    } else {
      this.hub.showCreate();
    }

    if (!this.session.isReturning) return;

    try {
      const player = await this.session.restore();
      if (player === null) {
        this.hub.showCreate();
        this.hub.showNotice('Hồ sơ cũ không còn dùng được, bạn tạo tay đua mới nhé!');
        return;
      }
      this.hub.showReturning(player);
      this.hub.setStats(player.age, this.session.allBestScores, this.grade);
      // Refresh so the caller's own row can be highlighted.
      void this.loadLeaderboard(this.hub.leaderboard.currentFilters);
    } catch {
      // Offline with a cached profile: keep showing it, but say so.
      this.hub.showNotice('Chưa kết nối được máy chủ. Dữ liệu có thể chưa mới nhất.');
    }
  }

  private async saveProfile(draft: PlayerDraft): Promise<void> {
    this.audio.unlock();
    this.audio.play('click');
    this.hub.setBusy(true);
    this.hub.clearNotice();

    try {
      const player =
        this.session.player === null
          ? await this.session.create(draft)
          : await this.session.update(draft);

      this.hub.showReturning(player);
      this.hub.setStats(player.age, this.session.allBestScores, this.grade);

      // Age only ever suggests a starting grade; the player still chooses.
      const suggested = suggestGradeForAge(player.age);
      if (!this.storage.tutorialSeen) {
        this.grade = suggested;
        this.storage.setSelectedGrade(suggested);
      }

      void this.loadLeaderboard(this.hub.leaderboard.currentFilters);
      this.enterHome();
    } catch (error) {
      // Stay on the hub and keep what they typed so they can simply retry.
      if (error instanceof ApiRequestError) {
        this.hub.showFieldError(error.field, error.message);
      } else {
        this.hub.showNotice('Chưa lưu được, thử lại nhé!');
      }
    } finally {
      this.hub.setBusy(false);
    }
  }

  private async loadLeaderboard(filters: LeaderboardFilters): Promise<void> {
    const requestId = ++this.leaderboardRequestId;
    this.hub.leaderboard.showLoading();

    try {
      const response = await leaderboardApi.get(this.api, filters);
      // A slower earlier request must not overwrite a newer one.
      if (requestId !== this.leaderboardRequestId) return;
      this.hub.renderLeaderboard(response);
    } catch {
      if (requestId !== this.leaderboardRequestId) return;
      this.hub.leaderboard.showError();
    }
  }

  /* ------------------------------ Screens ---------------------------- */

  private enterHome(): void {
    if (this.state.phase !== 'home' && this.state.canTransition('home')) {
      this.state.transition('home');
    }
    this.input.setEnabled(false);
    this.game?.setStage('attract');
    this.ui.showHome(this.grade, this.storage.bestScore(this.grade));
  }

  private selectGrade(grade: Grade): void {
    this.audio.unlock();
    this.audio.play('switch');
    this.grade = grade;
    this.storage.setSelectedGrade(grade);
    this.ui.setSelectedGrade(grade, this.storage.bestScore(grade));
  }

  private handleStart(): void {
    // The first button press is the gesture that lets audio play at all.
    this.audio.unlock();
    this.audio.play('click');
    this.audio.playMusic();
    this.ui.clearHomeNotice();

    if (this.storage.tutorialSeen) {
      void this.beginCountdown(false);
      return;
    }

    this.state.transition('tutorial');
    this.game?.prepareTutorial(this.grade);
    this.game?.setStage('tutorial');
    this.input.setEnabled(true);
    this.ui.showTutorial(true);
  }

  /**
   * Opens a run session on the server, then starts the countdown.
   *
   * The seed always comes from the server for a ranked run, so a client cannot
   * pick a set of questions it has already seen.
   */
  private async beginCountdown(fromTutorial: boolean): Promise<void> {
    if (fromTutorial) {
      this.storage.markTutorialSeen();
    }

    const game = this.game;
    if (game === null) return;

    const session = await this.openRunSession();
    if (session === 'blocked') return;

    this.activeRun = session;
    const seed = session?.seed ?? readDevOverrides().seed ?? createTimeSeed();
    const questions = this.buildQuestions(this.grade, seed);

    game.prepareRun(this.grade, seed, questions);

    this.ui.setScore(0);
    this.ui.setStreak(0);
    this.ui.hideFeedback();
    this.ui.setPracticeMode(session === null);

    this.countdownElapsedMs = 0;
    this.countdownStep = -1;
    if (this.state.canTransition('countdown')) {
      this.state.transition('countdown');
    }
    game.setStage('countdown');
    this.input.setEnabled(true);
    this.audio.duckMusic(false);
    this.audio.resumeMusic();
  }

  /**
   * Asks the server for a run session.
   *
   * Returns the session, `null` for an explicitly enabled unranked practice
   * run, or `'blocked'` when the run must not start at all.
   */
  private async openRunSession(): Promise<StartRunResponse | null | 'blocked'> {
    if (this.session.player === null) {
      // No profile yet: only practice is possible, and only if enabled.
      return ALLOW_PRACTICE_OFFLINE ? null : this.blockRun('Bạn cần tạo tay đua trước nhé!');
    }

    this.ui.setStartBusy(true);
    try {
      return await runsApi.start(this.api, this.grade);
    } catch (error) {
      if (ALLOW_PRACTICE_OFFLINE) return null;
      const message =
        error instanceof ApiRequestError
          ? error.message
          : 'Chưa bắt đầu được lượt chơi, bạn thử lại nhé!';
      return this.blockRun(message);
    } finally {
      this.ui.setStartBusy(false);
    }
  }

  private blockRun(message: string): 'blocked' {
    this.ui.showHomeNotice(message);
    if (this.state.phase !== 'home') {
      this.enterHome();
    }
    return 'blocked';
  }

  /**
   * Builds the questions for one run from a seed.
   *
   * The generator is shared with the server, so the same seed produces the
   * same questions on both sides.
   */
  private buildQuestions(grade: Grade, seed: number): Question[] {
    try {
      return generateQuestions({ grade, seed, count: GAME_CONFIG.questionsPerRun });
    } catch (error) {
      if (!(error instanceof GenerationExhaustedError)) throw error;
      // Never ship a broken run: fall back to the handcrafted question bank.
      console.warn('Bộ sinh câu hỏi không đủ câu hợp lệ, dùng bộ câu hỏi mẫu.', error);
      return buildFallbackRun(grade, GAME_CONFIG.questionsPerRun, createRng(seed));
    }
  }

  /* ----------------------------- Gameplay ---------------------------- */

  private handleLaneInput(direction: LaneDirection, source: 'keyboard' | 'pointer'): void {
    this.ui.setKeyboardMode(source === 'keyboard');

    const phase = this.state.phase;
    if (phase !== 'running' && phase !== 'feedback' && phase !== 'tutorial') return;
    if (this.game?.moveLane(direction) === true) {
      this.audio.play('switch', 60);
    }
  }

  private handleAnswer(feedback: AnswerFeedback): void {
    this.ui.setScore(feedback.score);
    this.ui.setStreak(feedback.streak);

    if (feedback.correct) {
      this.audio.play('correct');
      this.ui.showFeedback('correct', 'CHÍNH XÁC!', `+${String(feedback.gainedScore)} điểm`);
    } else {
      this.audio.play('wrong');
      const answer = feedback.question.answers[feedback.question.correctIndex] ?? '';
      this.ui.showFeedback('wrong', 'GẦN ĐÚNG RỒI!', `Đáp án: ${answer}`);
    }

    if (this.state.phase === 'running') {
      this.state.transition('feedback');
    }
  }

  /**
   * The run is over locally; the server has the final say on the score.
   *
   * The local tally is shown immediately so the celebration is not delayed,
   * then replaced by the verified result as soon as the server answers.
   */
  private handleFinished(result: Omit<RunResult, 'isNewBest'>): void {
    this.input.setEnabled(false);
    if (this.state.phase === 'running' || this.state.phase === 'feedback') {
      this.state.transition('finished');
    }
    this.game?.setStage('result');
    this.audio.duckMusic(true);

    const run = this.activeRun;
    if (run === null) {
      // Practice run: scored locally and never sent to the leaderboard.
      const isNewBest = this.storage.submitScore(result.grade, result.score);
      this.lastResult = { ...result, isNewBest };
      this.audio.play(isNewBest ? 'newRecord' : 'finish');
      this.ui.showResult(this.lastResult, this.storage.bestScore(result.grade));
      return;
    }

    const preview: RunResult = { ...result, isNewBest: false };
    this.lastResult = preview;
    this.ui.showResult(preview, this.session.bestScore(result.grade));
    void this.submitRun(run, result);
  }

  private async submitRun(
    run: StartRunResponse,
    local: Omit<RunResult, 'isNewBest'>,
  ): Promise<void> {
    const game = this.game;
    if (game === null) return;

    try {
      const response = await runsApi.finish(this.api, run.runId, {
        clientDurationMs: game.elapsedMs,
        answers: game.answers,
      });
      this.applyVerifiedResult(response.result, local);
    } catch (error) {
      // The run cannot be ranked, but the child still finished it: show the
      // local tally and say plainly that it was not recorded.
      const message =
        error instanceof ApiRequestError && !error.isOffline
          ? error.message
          : 'Chưa gửi được kết quả lên bảng thành tích.';
      this.audio.play('finish');
      this.ui.showResultNotice(message);
    } finally {
      this.activeRun = null;
    }
  }

  private applyVerifiedResult(
    verified: VerifiedRunResult,
    local: Omit<RunResult, 'isNewBest'>,
  ): void {
    const full: RunResult = {
      ...local,
      score: verified.score,
      correctAnswers: verified.correctAnswers,
      bestStreak: verified.bestStreak,
      stars: verified.stars,
      durationMs: verified.durationMs,
      isNewBest: verified.isNewBest,
    };
    this.lastResult = full;

    this.session.noteBestScore(verified.grade, verified.score);
    this.audio.play(verified.isNewBest ? 'newRecord' : 'finish');
    this.ui.showResult(full, this.session.bestScore(verified.grade));
    if (verified.rank !== null) {
      this.ui.showResultRank(verified.rank);
    }

    // The standings changed, so the hub must not show a stale board.
    void this.loadLeaderboard(this.hub.leaderboard.currentFilters);
  }

  /* ------------------------- Pause and resume ------------------------ */

  private togglePause(): void {
    if (this.state.phase === 'paused') {
      this.resumeGame();
      return;
    }
    this.pauseGame();
  }

  private pauseGame(): void {
    if (!this.state.canPause()) return;
    this.state.pause();
    this.input.setEnabled(false);
    this.audio.play('click');
    this.audio.pauseMusic();
    this.game?.setIdleAnimation();
    this.ui.showPause();
  }

  private resumeGame(): void {
    if (this.state.phase !== 'paused') return;
    const target = this.state.resume();
    if (target === null) return;

    this.input.setEnabled(true);
    this.audio.play('click');
    this.audio.resumeMusic();
    if (target === 'running' || target === 'feedback') {
      this.game?.setStage('running');
      this.game?.beginRunning();
    }
    this.ui.showHud();
  }

  private restartRun(): void {
    if (this.state.phase !== 'paused') return;
    this.state.resume();
    void this.beginCountdown(false);
  }

  private returnHome(): void {
    this.audio.play('click');
    this.audio.duckMusic(false);
    this.input.setEnabled(false);

    if (this.state.phase === 'paused') {
      this.state.resume();
    }
    if (this.state.phase !== 'home') {
      this.state.transition('home');
    }
    this.game?.setStage('attract');
    this.ui.showHome(this.grade, this.storage.bestScore(this.grade));
  }

  private toggleMute(): void {
    const muted = !this.audio.isMuted;
    this.audio.setMuted(muted);
    this.storage.setMuted(muted);
    this.ui.setMuted(muted);
    if (!muted) {
      this.audio.unlock();
      this.audio.play('click');
    }
  }

  /* ------------------------------- Loop ------------------------------ */

  private startLoop(): void {
    if (this.frameHandle !== 0) return;
    this.clock.start(performance.now());
    const frame = (now: number): void => {
      this.frameHandle = requestAnimationFrame(frame);
      this.tick(now);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  private tick(now: number): void {
    const delta = this.clock.tick(now);
    const game = this.game;
    if (game === null) return;

    if (this.state.phase === 'countdown') {
      this.updateCountdown(delta);
    }

    game.update(delta, this.state.phase === 'paused');
    game.render();
  }

  private updateCountdown(delta: number): void {
    this.countdownElapsedMs += delta * 1000;
    const step = Math.floor(this.countdownElapsedMs / GAME_CONFIG.countdownStepMs);

    if (step >= GAME_CONFIG.countdownSteps.length) {
      this.state.transition('running');
      this.game?.setStage('running');
      this.game?.beginRunning();
      this.ui.showHud();
      return;
    }

    if (step !== this.countdownStep) {
      this.countdownStep = step;
      const label = GAME_CONFIG.countdownSteps[step];
      if (label !== undefined) {
        this.ui.showCountdown(label);
        this.audio.play('click', 200);
      }
    }
  }

  /* ---------------------------- Lifecycle ---------------------------- */

  private registerGlobalListeners(): void {
    window.addEventListener('resize', () => {
      this.handleResize();
    });
    window.addEventListener('orientationchange', () => {
      this.handleResize();
    });

    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.canvas);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseGame();
    });
    window.addEventListener('blur', () => {
      this.pauseGame();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.ui.isCreditsOpen) {
        this.ui.closeCredits();
      }
    });

    const media = matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', (event) => {
      this.game?.setReducedMotion(event.matches);
    });
  }

  private handleResize(): void {
    if (this.game === null) return;
    this.applyCanvasSize(this.game);
  }

  private applyCanvasSize(game: Game): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    game.resize(width, height);
  }

  /** Read-only view used by the end-to-end tests. */
  installDebug(): void {
    installDebugBridge({
      getPhase: () => this.state.phase,
      getSnapshot: () => this.game?.snapshot() ?? null,
      moveToLane: (lane: LaneIndex) => {
        const phase = this.state.phase;
        if (phase !== 'running' && phase !== 'feedback' && phase !== 'tutorial') return;
        this.game?.setLane(lane);
      },
      setTimeScale: (scale: number) => {
        this.clock.setTimeScale(scale);
      },
      getLastResult: () => this.lastResult,
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.resizeObserver?.disconnect();
    this.input.dispose();
    this.ui.dispose();
    this.audio.dispose();
    this.game?.dispose();
    this.assets.dispose();
  }
}

interface DevOverrides {
  seed: number | null;
  grade: Grade | null;
}

/** `?seed=12345&grade=2` is honoured in development builds only. */
function readDevOverrides(): DevOverrides {
  if (!import.meta.env.DEV) return { seed: null, grade: null };

  const params = new URLSearchParams(window.location.search);
  const rawSeed = params.get('seed');
  const rawGrade = params.get('grade');

  const seed = rawSeed === null ? null : Number.parseInt(rawSeed, 10);
  const grade = rawGrade === null ? null : Number.parseInt(rawGrade, 10);

  return {
    seed: seed !== null && Number.isFinite(seed) ? seed >>> 0 : null,
    grade: isGrade(grade) ? grade : null,
  };
}

/**
 * Waits for the self-hosted game font, but never blocks the game on it.
 * If the font is slow or unavailable the fallback stack is used instead.
 */
async function loadGameFont(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.race([
      document.fonts.load('800 100px "Baloo 2"'),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Fallback font it is.
  }
}
