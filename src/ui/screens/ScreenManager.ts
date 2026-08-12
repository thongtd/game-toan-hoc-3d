import { requireElement, setHidden } from '../dom.ts';

export type ScreenName =
  | 'loading'
  | 'error'
  | 'playerHub'
  | 'home'
  | 'tutorial'
  | 'countdown'
  | 'hud'
  | 'pause'
  | 'result'
  | 'credits';

const SCREEN_IDS: Readonly<Record<ScreenName, string>> = {
  loading: 'screen-loading',
  error: 'screen-error',
  playerHub: 'screen-player-hub',
  home: 'screen-home',
  tutorial: 'screen-tutorial',
  countdown: 'screen-countdown',
  hud: 'screen-hud',
  pause: 'screen-pause',
  result: 'screen-result',
  credits: 'screen-credits',
};

/**
 * Shows and hides the overlay layers.
 *
 * Several layers are visible together - the HUD stays behind the pause board,
 * and the 3D world is behind all of them - so visibility is a set rather than
 * a single "current screen".
 */
export class ScreenManager {
  private readonly elements: Record<ScreenName, HTMLElement>;
  private creditsOpen = false;

  constructor() {
    this.elements = {
      loading: requireElement(SCREEN_IDS.loading),
      error: requireElement(SCREEN_IDS.error),
      playerHub: requireElement(SCREEN_IDS.playerHub),
      home: requireElement(SCREEN_IDS.home),
      tutorial: requireElement(SCREEN_IDS.tutorial),
      countdown: requireElement(SCREEN_IDS.countdown),
      hud: requireElement(SCREEN_IDS.hud),
      pause: requireElement(SCREEN_IDS.pause),
      result: requireElement(SCREEN_IDS.result),
      credits: requireElement(SCREEN_IDS.credits),
    };
  }

  /** Makes exactly the named screens visible; credits stack on top. */
  show(...visible: readonly ScreenName[]): void {
    for (const name of Object.keys(this.elements) as ScreenName[]) {
      if (name === 'credits') continue;
      setHidden(this.elements[name], !visible.includes(name));
    }
  }

  setCreditsOpen(open: boolean): void {
    this.creditsOpen = open;
    setHidden(this.elements.credits, !open);
  }

  get isCreditsOpen(): boolean {
    return this.creditsOpen;
  }

  isVisible(name: ScreenName): boolean {
    return !this.elements[name].classList.contains('is-hidden');
  }
}
