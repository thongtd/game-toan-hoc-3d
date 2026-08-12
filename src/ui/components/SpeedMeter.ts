import { SPEED_TIER_COUNT } from '../../../shared/scoring/speed-config.ts';
import { requireElement, setHidden } from '../dom.ts';

/**
 * Six sweets that light up as the run speeds up.
 *
 * Children do not need to know the world moves at 11.25 units per second; they
 * need to see that it just got faster. The numbers stay in the code.
 */
export class SpeedMeter {
  private readonly root = requireElement('speed-meter');
  private readonly notches = requireElement('speed-notches');
  private readonly maxLabel = requireElement('speed-max');

  private tier = -1;

  constructor() {
    this.notches.replaceChildren();
    for (let i = 0; i < SPEED_TIER_COUNT; i += 1) {
      const notch = document.createElement('span');
      notch.className = 'speed-meter__notch';
      notch.dataset.testid = `speed-notch-${String(i)}`;
      this.notches.append(notch);
    }
    this.setTier(0);
  }

  /** Lights up notches 0..tier. */
  setTier(tier: number): void {
    const clamped = Math.min(Math.max(0, Math.round(tier)), SPEED_TIER_COUNT - 1);
    if (clamped === this.tier) return;
    this.tier = clamped;

    [...this.notches.children].forEach((notch, index) => {
      notch.classList.toggle('speed-meter__notch--on', index <= clamped);
    });

    const atMax = clamped >= SPEED_TIER_COUNT - 1;
    setHidden(this.maxLabel, !atMax);
    this.root.classList.toggle('speed-meter--max', atMax);
    this.root.setAttribute(
      'aria-label',
      atMax
        ? `Tốc độ tối đa, bậc ${String(SPEED_TIER_COUNT)} trên ${String(SPEED_TIER_COUNT)}`
        : `Tốc độ bậc ${String(clamped + 1)} trên ${String(SPEED_TIER_COUNT)}`,
    );

    this.root.classList.remove('speed-meter--bump');
    void this.root.offsetWidth;
    this.root.classList.add('speed-meter--bump');
  }

  reset(): void {
    this.tier = -1;
    this.setTier(0);
  }
}
