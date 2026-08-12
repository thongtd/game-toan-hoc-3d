import { TypedEmitter } from '../utils/event-emitter.ts';

export type AppPhase =
  | 'boot'
  | 'loading'
  | 'player-hub'
  | 'home'
  | 'tutorial'
  | 'countdown'
  | 'running'
  | 'feedback'
  | 'paused'
  | 'finished'
  | 'error';

/**
 * Allowed transitions.
 *
 * `paused` is special: it can be entered from any active gameplay phase and
 * always returns to whichever phase it interrupted, so it is handled by
 * `pause()`/`resume()` rather than by listing every pair here.
 */
const TRANSITIONS: Readonly<Record<AppPhase, readonly AppPhase[]>> = {
  boot: ['loading', 'error'],
  loading: ['player-hub', 'home', 'error'],
  'player-hub': ['home', 'error'],
  home: ['tutorial', 'countdown', 'player-hub', 'error'],
  tutorial: ['countdown', 'home'],
  countdown: ['running', 'paused', 'home'],
  running: ['feedback', 'finished', 'paused', 'home'],
  feedback: ['running', 'finished', 'paused', 'home'],
  paused: ['countdown', 'running', 'feedback', 'home'],
  finished: ['countdown', 'home', 'player-hub'],
  error: ['loading', 'player-hub', 'home'],
};

const PAUSABLE_PHASES: readonly AppPhase[] = ['countdown', 'running', 'feedback'];

export interface PhaseChange {
  from: AppPhase;
  to: AppPhase;
}

interface AppStateEvents extends Record<string, unknown> {
  change: PhaseChange;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: AppPhase,
    readonly to: AppPhase,
  ) {
    super(`Invalid phase transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Owns the application phase.
 *
 * The UI never assigns a phase directly - it dispatches an intent and the app
 * controller asks this object to transition, which keeps every illegal jump in
 * one place.
 */
export class AppState {
  private current: AppPhase = 'boot';
  private interrupted: AppPhase | null = null;
  private readonly emitter = new TypedEmitter<AppStateEvents>();

  get phase(): AppPhase {
    return this.current;
  }

  /** Phase that `paused` will return to, when paused. */
  get pausedFrom(): AppPhase | null {
    return this.interrupted;
  }

  onChange(listener: (change: PhaseChange) => void): () => void {
    return this.emitter.on('change', listener);
  }

  canTransition(to: AppPhase): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  transition(to: AppPhase): PhaseChange {
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(this.current, to);
    }
    const from = this.current;
    this.current = to;
    if (to !== 'paused') {
      this.interrupted = null;
    }
    const change: PhaseChange = { from, to };
    this.emitter.emit('change', change);
    return change;
  }

  canPause(): boolean {
    return PAUSABLE_PHASES.includes(this.current);
  }

  /** Enters `paused`, remembering the phase to come back to. */
  pause(): boolean {
    if (!this.canPause()) return false;
    const from = this.current;
    this.interrupted = from;
    this.current = 'paused';
    this.emitter.emit('change', { from, to: 'paused' });
    return true;
  }

  /** Returns to the phase that was interrupted by `pause()`. */
  resume(): AppPhase | null {
    if (this.current !== 'paused' || this.interrupted === null) return null;
    const target = this.interrupted;
    this.interrupted = null;
    this.current = target;
    this.emitter.emit('change', { from: 'paused', to: target });
    return target;
  }

  /** True while the simulation should advance. */
  isGameplayActive(): boolean {
    return this.current === 'running' || this.current === 'feedback';
  }

  /** True while the 3D scene should be rendered at all. */
  isSceneVisible(): boolean {
    return (
      this.current === 'countdown' ||
      this.current === 'running' ||
      this.current === 'feedback' ||
      this.current === 'paused' ||
      this.current === 'finished'
    );
  }
}
