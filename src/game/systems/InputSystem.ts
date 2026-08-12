import { GAME_CONFIG } from '../game-config.ts';

export type LaneDirection = -1 | 1;

export type InputSource = 'keyboard' | 'pointer';

export interface InputHandlers {
  onLane(direction: LaneDirection, source: InputSource): void;
  onTogglePause(): void;
  onToggleMute(): void;
}

const SWIPE_MIN_DISTANCE_PX = 35;

/**
 * Keyboard, pointer and touch input.
 *
 * Every control has at least two ways in: the on-screen arrow buttons work
 * with a mouse and with touch, so the game is never keyboard-only or
 * swipe-only.
 */
export class InputSystem {
  private lastLaneInputAt = -Infinity;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchHandled = false;
  private enabled = false;
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly surface: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {}

  attach(): void {
    this.addListener(window, 'keydown', this.handleKeyDown);
    this.addListener(this.surface, 'touchstart', this.handleTouchStart, { passive: true });
    this.addListener(this.surface, 'touchmove', this.handleTouchMove, { passive: true });
    this.addListener(this.surface, 'touchend', this.handleTouchEnd, { passive: true });
  }

  /** Wires an on-screen arcade pad. */
  bindPad(button: HTMLElement, direction: LaneDirection): void {
    const onPointerDown = (event: Event): void => {
      event.preventDefault();
      this.requestLane(direction, 'pointer');
    };
    button.addEventListener('pointerdown', onPointerDown);
    this.disposers.push(() => {
      button.removeEventListener('pointerdown', onPointerDown);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private addListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  private addListener(
    target: HTMLElement,
    type: string,
    handler: (event: never) => void,
    options?: AddEventListenerOptions,
  ): void;
  private addListener(
    target: Window | HTMLElement,
    type: string,
    handler: (event: never) => void,
    options?: AddEventListenerOptions,
  ): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    this.disposers.push(() => {
      target.removeEventListener(type, listener, options);
    });
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        this.requestLane(-1, 'keyboard');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        this.requestLane(1, 'keyboard');
        break;
      case 'Escape':
        event.preventDefault();
        this.handlers.onTogglePause();
        break;
      case 'm':
      case 'M':
        this.handlers.onToggleMute();
        break;
      default:
        break;
    }
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    if (touch === undefined) return;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchHandled = false;
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (this.touchHandled || this.touchStartX === null || this.touchStartY === null) return;
    const touch = event.changedTouches[0];
    if (touch === undefined) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Horizontal intent only, and only one lane per gesture.
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    this.touchHandled = true;
    this.requestLane(deltaX > 0 ? 1 : -1, 'pointer');
  };

  private readonly handleTouchEnd = (): void => {
    this.touchStartX = null;
    this.touchStartY = null;
    this.touchHandled = false;
  };

  private requestLane(direction: LaneDirection, source: InputSource): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastLaneInputAt < GAME_CONFIG.inputDebounceMs) return;
    this.lastLaneInputAt = now;
    this.handlers.onLane(direction, source);
  }

  dispose(): void {
    for (const disposer of this.disposers) disposer();
    this.disposers.length = 0;
  }
}
