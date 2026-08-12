import type { Grade, RunResult } from '../../shared/game-types.ts';
import { formatScore } from '../../shared/math/format-number.ts';
import type { MapId } from '../../shared/maps/map-manifest.ts';
import { getMapDefinition } from '../../shared/maps/map-manifest.ts';
import { GAME_CONFIG } from '../game/game-config.ts';
import type { MapSelectionMode } from '../player/map-preference.ts';
import { resolveAssetUrl } from '../utils/asset-url.ts';
import { GradeMedals } from './components/GradeMedals.ts';
import { MapSelector } from './components/MapSelector.ts';
import { SpeedMeter } from './components/SpeedMeter.ts';
import {
  createIcon,
  onClick,
  requireElement,
  requireElementOfType,
  setHidden,
  setIcon,
  setText,
} from './dom.ts';
import { ScreenManager } from './screens/ScreenManager.ts';

export interface UIIntents {
  selectGrade(grade: Grade): void;
  start(): void;
  tutorialReady(): void;
  skipTutorial(): void;
  resume(): void;
  restart(): void;
  goHome(): void;
  replay(): void;
  changeGrade(): void;
  toggleMute(): void;
  togglePause(): void;
  retryLoad(): void;
  hover(): void;
  /** The player changed the previewed map or switched the roulette. */
  selectMap(selection: { mode: MapSelectionMode; mapId: MapId }): void;
  /** Retry after a map or run session failed to start. */
  retryMap(): void;
}

export type FeedbackKind = 'correct' | 'wrong';

const STAR_LABELS: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'Bạn nhận 1 ngôi sao. Chạy thêm một vòng nữa nhé!',
  2: 'Bạn nhận 2 ngôi sao. Giỏi lắm!',
  3: 'Bạn nhận 3 ngôi sao. Tuyệt vời!',
};

/** Loading lines rotate purely for fun; the bar itself is real progress. */
const LOADING_MESSAGES = [
  'Đang mở đường đua...',
  'Đang gọi bạn đồng hành...',
  'Đang xếp các cánh cổng...',
] as const;

/**
 * Everything DOM.
 *
 * The controller only raises intents and renders what it is told; it never
 * changes the game phase itself, so every legal transition stays in `AppState`.
 */
export class UIController {
  readonly screens = new ScreenManager();
  readonly maps: MapSelector;
  readonly speedMeter = new SpeedMeter();

  private readonly medals: GradeMedals;

  private readonly loadingFill = requireElement('loading-fill');
  private readonly loadingCoin = requireElement('loading-coin');
  private readonly loadingBar = requireElement('loading-progressbar');
  private readonly loadingStatus = requireElement('loading-status');
  private readonly errorMessage = requireElement('error-message');

  private readonly homeBestText = requireElement('home-best-text');
  private readonly homeNotice = requireElement('home-notice');
  private readonly startButton = requireElement('btn-start');
  private readonly practiceChip = requireElement('hud-practice');

  private readonly tutorialHint = requireElement('tutorial-hint');
  private readonly readyButton = requireElementOfType('btn-ready', HTMLButtonElement);
  private readonly skipTutorialButton = requireElement('btn-skip-tutorial');

  private readonly countdownValue = requireElement('countdown-value');

  private readonly hudProgress = requireElement('hud-progress');
  private readonly hudProgressFill = requireElement('hud-progress-fill');
  private readonly hudQuestion = requireElement('hud-question');
  private readonly hudScore = requireElement('hud-score');
  private readonly hudStreak = requireElement('hud-streak');
  private readonly hudStreakText = requireElement('hud-streak-text');

  private readonly feedback = requireElement('hud-feedback');
  private readonly feedbackIcon = requireElement('feedback-icon');
  private readonly feedbackTitleText = requireElement('feedback-title-text');
  private readonly feedbackDetail = requireElement('feedback-detail');

  private readonly restartConfirm = requireElement('restart-confirm');

  private readonly resultStars = requireElement('result-stars');
  private readonly resultHeadline = requireElement('result-headline');
  private readonly resultScore = requireElement('result-score');
  private readonly resultStreak = requireElement('result-streak');
  private readonly resultBest = requireElement('result-best');
  private readonly resultRecord = requireElement('result-record');
  private readonly resultRank = requireElement('result-rank');
  private readonly resultRankText = requireElement('result-rank-text');
  private readonly resultNotice = requireElement('result-notice');

  private readonly muteIcons = [requireElement('mute-icon-home'), requireElement('mute-icon-hud')];

  private readonly speedUpBanner = requireElement('speed-up-banner');
  private readonly mapLoadingThumb = requireElementOfType('map-loading-thumb', HTMLImageElement);
  private readonly mapLoadingName = requireElement('map-loading-name');
  private readonly mapLoadingStatus = requireElement('map-loading-status');
  private readonly mapRetryButton = requireElement('btn-map-retry');

  private readonly disposers: (() => void)[] = [];
  private loadingMessageIndex = -1;
  private speedUpTimer = 0;

  constructor(private readonly intents: UIIntents) {
    this.medals = new GradeMedals(requireElement('grade-medals'), (grade) => {
      this.intents.selectGrade(grade);
    });
    this.maps = new MapSelector({
      onChange: (selection) => {
        this.intents.selectMap(selection);
      },
      onPreview: () => {
        this.intents.hover();
      },
    });
    this.bind();
  }

  private bind(): void {
    const bindings: readonly (readonly [string, () => void])[] = [
      [
        'btn-start',
        () => {
          this.intents.start();
        },
      ],
      [
        'btn-ready',
        () => {
          this.intents.tutorialReady();
        },
      ],
      [
        'btn-skip-tutorial',
        () => {
          this.intents.skipTutorial();
        },
      ],
      [
        'btn-resume',
        () => {
          this.intents.resume();
        },
      ],
      [
        'btn-home',
        () => {
          this.intents.goHome();
        },
      ],
      [
        'btn-replay',
        () => {
          this.intents.replay();
        },
      ],
      [
        'btn-change-grade',
        () => {
          this.intents.changeGrade();
        },
      ],
      [
        'btn-mute-home',
        () => {
          this.intents.toggleMute();
        },
      ],
      [
        'btn-mute-hud',
        () => {
          this.intents.toggleMute();
        },
      ],
      [
        'btn-pause',
        () => {
          this.intents.togglePause();
        },
      ],
      [
        'btn-retry',
        () => {
          this.intents.retryLoad();
        },
      ],
      [
        'btn-map-retry',
        () => {
          this.intents.retryMap();
        },
      ],
      [
        'btn-credits',
        () => {
          this.openCredits();
        },
      ],
      [
        'btn-credits-close',
        () => {
          this.closeCredits();
        },
      ],
      [
        'btn-restart',
        () => {
          this.setRestartConfirmVisible(true);
        },
      ],
      [
        'btn-restart-no',
        () => {
          this.setRestartConfirmVisible(false);
        },
      ],
      [
        'btn-restart-yes',
        () => {
          this.setRestartConfirmVisible(false);
          this.intents.restart();
        },
      ],
    ];

    for (const [id, handler] of bindings) {
      this.disposers.push(onClick(requireElement(id), handler));
    }

    // A short hover blip on pointer devices only; touch devices skip it.
    for (const id of ['btn-start', 'btn-replay', 'btn-resume']) {
      const element = requireElement(id);
      const listener = (event: PointerEvent): void => {
        if (event.pointerType !== 'mouse') return;
        this.intents.hover();
      };
      element.addEventListener('pointerenter', listener);
      this.disposers.push(() => {
        element.removeEventListener('pointerenter', listener);
      });
    }
  }

  /** Lane pads are wired by `InputSystem` so debouncing stays in one place. */
  get lanePads(): { left: HTMLElement; right: HTMLElement } {
    return { left: requireElement('btn-left'), right: requireElement('btn-right') };
  }

  /* ----------------------------- Loading ----------------------------- */

  setLoadingProgress(ratio: number, forceMessage?: string): void {
    const clamped = Math.min(1, Math.max(0, ratio));
    const percent = Math.round(clamped * 100);
    this.loadingFill.style.width = `${String(percent)}%`;
    this.loadingCoin.style.left = `${String(percent)}%`;
    this.loadingBar.setAttribute('aria-valuenow', String(percent));

    if (forceMessage !== undefined) {
      setText(this.loadingStatus, forceMessage);
      return;
    }

    // Step through the flavour lines as real progress passes each third.
    const index = Math.min(
      LOADING_MESSAGES.length - 1,
      Math.floor(clamped * LOADING_MESSAGES.length),
    );
    if (index !== this.loadingMessageIndex) {
      this.loadingMessageIndex = index;
      setText(this.loadingStatus, LOADING_MESSAGES[index] ?? LOADING_MESSAGES[0]);
    }
  }

  showLoading(): void {
    this.screens.show('loading');
  }

  showError(message: string): void {
    setText(this.errorMessage, message);
    this.screens.show('error');
  }

  /* ------------------------------- Home ------------------------------ */

  showHome(grade: Grade, bestScore: number): void {
    this.setSelectedGrade(grade, bestScore);
    this.closeCredits();
    this.startButton.classList.add('breathing');
    this.screens.show('home');
  }

  /** A short problem message on the home screen, e.g. the server is down. */
  showHomeNotice(message: string): void {
    setText(this.homeNotice, message);
    setHidden(this.homeNotice, false);
  }

  clearHomeNotice(): void {
    setHidden(this.homeNotice, true);
  }

  /** Labels an unranked practice run so the player is never misled. */
  setPracticeMode(active: boolean): void {
    setHidden(this.practiceChip, !active);
  }

  setStartBusy(busy: boolean): void {
    requireElementOfType('btn-start', HTMLButtonElement).disabled = busy;
  }

  setSelectedGrade(grade: Grade, bestScore: number): void {
    this.medals.setSelected(grade);
    setText(
      this.homeBestText,
      bestScore > 0 ? `Kỷ lục lớp này: ${formatScore(bestScore)}` : 'Cùng lập kỷ lục đầu tiên nào!',
    );
  }

  /* ----------------------------- Tutorial ---------------------------- */

  showTutorial(canSkip: boolean): void {
    setHidden(this.readyButton, true);
    setHidden(this.skipTutorialButton, !canSkip);
    setText(this.tutorialHint, 'Thử đổi làn một lần nhé!');
    this.screens.show('hud', 'tutorial');
  }

  /** Called once the player has actually changed lane in the world. */
  markTutorialPractised(): void {
    if (!this.readyButton.classList.contains('is-hidden')) return;
    setHidden(this.readyButton, false);
    setHidden(this.skipTutorialButton, true);
    setText(this.tutorialHint, 'Tuyệt vời! Cổng đã mở.');
    this.readyButton.focus();
  }

  /* ------------------------------- Maps ------------------------------ */

  /** Shows the "getting the track ready" board while a map loads. */
  showMapLoading(mapId: MapId): void {
    const definition = getMapDefinition(mapId);
    this.mapLoadingThumb.src = resolveAssetUrl(definition.thumbnailUrl);
    this.mapLoadingThumb.alt = '';
    setText(this.mapLoadingName, definition.displayName);
    setText(this.mapLoadingStatus, 'Đang chuẩn bị đường đua...');
    setHidden(this.mapRetryButton, true);
    this.screens.show('mapLoading');
  }

  /**
   * Turns the loading board into an error board.
   * The run has not started, so the only way on is to try again.
   */
  showMapLoadFailed(message: string): void {
    setText(this.mapLoadingStatus, message);
    setHidden(this.mapRetryButton, false);
    this.screens.show('mapLoading');
  }

  /** Says, kindly, that the scenery fell back to the spare road. */
  showFallbackNotice(): void {
    this.showHomeNotice(
      'Bản đồ đang được sửa đường một chút! Mình sẽ chạy trên đường dự phòng nhé.',
    );
  }

  /* ---------------------------- Countdown ---------------------------- */

  showCountdown(value: string): void {
    setText(this.countdownValue, value);
    this.countdownValue.classList.toggle('countdown--go', value.endsWith('!'));
    // Re-trigger the pop animation for each step.
    this.countdownValue.style.animation = 'none';
    void this.countdownValue.offsetWidth;
    this.countdownValue.style.animation = '';
    this.screens.show('hud', 'countdown');
  }

  /* ------------------------------- HUD ------------------------------- */

  showHud(): void {
    this.screens.show('hud');
  }

  setQuestion(prompt: string, index: number, total: number): void {
    setText(this.hudQuestion, prompt);
    setText(this.hudProgress, `${String(index + 1)}/${String(total)}`);
    const ratio = total > 0 ? index / total : 0;
    this.hudProgressFill.style.width = `${String(Math.round(ratio * 100))}%`;
  }

  setScore(score: number): void {
    setText(this.hudScore, formatScore(score));
  }

  setStreak(streak: number): void {
    const visible = streak >= 2;
    setHidden(this.hudStreak, !visible);
    if (!visible) return;

    setText(this.hudStreakText, `Chuỗi ×${String(streak)}`);
    this.hudStreak.classList.remove('streak-chip--bump');
    void this.hudStreak.offsetWidth;
    this.hudStreak.classList.add('streak-chip--bump');
  }

  /**
   * Celebrates crossing a speed threshold.
   *
   * The top tier gets its own wording, once per run, so reaching maximum speed
   * feels like an achievement rather than another step.
   */
  showSpeedUp(tier: number, reachedMax: boolean): void {
    this.speedMeter.setTier(tier);
    setText(this.speedUpBanner, reachedMax ? 'TỐC ĐỘ TỐI ĐA!' : 'TĂNG TỐC!');
    setHidden(this.speedUpBanner, false);
    this.speedUpBanner.classList.remove('speed-up--pop');
    void this.speedUpBanner.offsetWidth;
    this.speedUpBanner.classList.add('speed-up--pop');

    window.clearTimeout(this.speedUpTimer);
    this.speedUpTimer = window.setTimeout(() => {
      setHidden(this.speedUpBanner, true);
    }, GAME_CONFIG.speedUpBannerMs);
  }

  resetSpeedMeter(): void {
    this.speedMeter.reset();
    window.clearTimeout(this.speedUpTimer);
    setHidden(this.speedUpBanner, true);
  }

  showFeedback(kind: FeedbackKind, title: string, detail?: string): void {
    this.feedback.classList.remove('feedback--correct', 'feedback--wrong');
    this.feedback.classList.add(`feedback--${kind}`);
    setIcon(this.feedbackIcon, kind === 'correct' ? 'icon-check' : 'icon-cross');
    setText(this.feedbackTitleText, title);

    if (detail === undefined) {
      setHidden(this.feedbackDetail, true);
    } else {
      setText(this.feedbackDetail, detail);
      setHidden(this.feedbackDetail, false);
    }

    setHidden(this.feedback, false);
    // Let the gate take the focus while feedback is on screen.
    this.hudQuestion.classList.add('question-board--recessed');
  }

  hideFeedback(): void {
    setHidden(this.feedback, true);
    this.hudQuestion.classList.remove('question-board--recessed');
  }

  /* ------------------------------ Pause ------------------------------ */

  showPause(): void {
    this.setRestartConfirmVisible(false);
    this.screens.show('hud', 'pause');
  }

  private setRestartConfirmVisible(visible: boolean): void {
    setHidden(this.restartConfirm, !visible);
  }

  /* ------------------------------ Result ----------------------------- */

  showResult(result: RunResult, bestScore: number): void {
    this.renderStars(result.stars);
    setText(
      this.resultHeadline,
      `Bạn chinh phục ${String(result.correctAnswers)}/${String(result.totalQuestions)} cánh cổng!`,
    );
    this.resultHeadline.setAttribute(
      'aria-label',
      `${STAR_LABELS[result.stars]} Bạn chinh phục ${String(result.correctAnswers)} trên ${String(result.totalQuestions)} cánh cổng.`,
    );
    setText(this.resultScore, formatScore(result.score));
    setText(this.resultStreak, `Chuỗi dài nhất ${String(result.bestStreak)}`);
    setText(this.resultBest, `Kỷ lục ${formatScore(bestScore)}`);
    setHidden(this.resultRecord, !result.isNewBest);
    setHidden(this.resultRank, true);
    setHidden(this.resultNotice, true);
    this.hideFeedback();
    this.setPracticeMode(false);
    this.screens.show('result');
  }

  /** Shows the verified position on the weekly board for this grade. */
  showResultRank(rank: number): void {
    setText(this.resultRankText, `Hạng ${String(rank)} tuần này`);
    setHidden(this.resultRank, false);
  }

  /** Explains that a finished run could not be recorded on the leaderboard. */
  showResultNotice(message: string): void {
    setText(this.resultNotice, message);
    setHidden(this.resultNotice, false);
  }

  private renderStars(stars: 1 | 2 | 3): void {
    this.resultStars.replaceChildren();
    for (let i = 1; i <= 3; i += 1) {
      const earned = i <= stars;
      const star = createIcon(
        'icon-star',
        earned ? 'result__star' : 'result__star result__star--empty',
      );
      this.resultStars.append(star);
    }
    this.resultStars.setAttribute('aria-label', STAR_LABELS[stars]);
    this.resultStars.setAttribute('role', 'img');
  }

  /* ------------------------------ Shared ----------------------------- */

  setMuted(muted: boolean): void {
    for (const icon of this.muteIcons) {
      setIcon(icon, muted ? 'icon-sound-off' : 'icon-sound-on');
    }
    for (const id of ['btn-mute-home', 'btn-mute-hud']) {
      requireElement(id).setAttribute('aria-label', muted ? 'Bật âm thanh' : 'Tắt âm thanh');
    }
  }

  /** Dims the lane pads while the player is clearly using a keyboard. */
  setKeyboardMode(active: boolean): void {
    document.body.classList.toggle('app--keyboard', active);
  }

  openCredits(): void {
    this.screens.setCreditsOpen(true);
    requireElement('btn-credits-close').focus();
  }

  closeCredits(): void {
    this.screens.setCreditsOpen(false);
  }

  get isCreditsOpen(): boolean {
    return this.screens.isCreditsOpen;
  }

  dispose(): void {
    window.clearTimeout(this.speedUpTimer);
    this.maps.dispose();
    for (const disposer of this.disposers) disposer();
    this.disposers.length = 0;
  }
}
