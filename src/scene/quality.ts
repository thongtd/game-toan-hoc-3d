export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  /** Multiplier applied to the decoration budget. */
  decorationScale: number;
  antialias: boolean;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualitySettings>> = {
  low: {
    level: 'low',
    pixelRatioCap: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    decorationScale: 0.5,
    antialias: false,
  },
  medium: {
    level: 'medium',
    pixelRatioCap: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    decorationScale: 0.8,
    antialias: true,
  },
  high: {
    level: 'high',
    pixelRatioCap: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    decorationScale: 1,
    antialias: true,
  },
};

/** Initial guess before any frame has been measured. */
export function detectInitialQuality(): QualitySettings {
  const isCoarsePointer =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const lowMemory =
    'deviceMemory' in navigator && typeof navigator.deviceMemory === 'number'
      ? navigator.deviceMemory <= 4
      : false;

  if (lowMemory) return QUALITY_PRESETS.medium;
  return isCoarsePointer ? QUALITY_PRESETS.medium : QUALITY_PRESETS.high;
}

/**
 * Samples frame times for a fixed window and reports the average FPS once.
 *
 * The game uses this to step down to the low preset on weak devices instead of
 * running the whole session below 45 FPS.
 */
export class FpsProbe {
  private elapsed = 0;
  private frames = 0;
  private finished = false;

  constructor(private readonly windowSeconds = 5) {}

  /** Returns the measured average FPS on the frame the window closes. */
  sample(delta: number): number | null {
    if (this.finished || delta <= 0) return null;
    this.elapsed += delta;
    this.frames += 1;
    if (this.elapsed < this.windowSeconds) return null;

    this.finished = true;
    return this.frames / this.elapsed;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  reset(): void {
    this.elapsed = 0;
    this.frames = 0;
    this.finished = false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
