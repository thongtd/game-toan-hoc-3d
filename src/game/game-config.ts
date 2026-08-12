/** Tuning values for the runner. Everything gameplay-related lives here. */

export const LANE_POSITIONS_X: readonly [number, number, number] = [-2.6, 0, 2.6];

export const GAME_CONFIG = {
  /** Questions in one run. */
  questionsPerRun: 12,

  /**
   * World speed and gate spacing live in `shared/scoring/speed-config.ts`.
   * They are shared with the server, so they must not be duplicated here.
   */

  /** Duration of the correct/wrong banner. */
  feedbackMs: 800,

  /** How long the "TĂNG TỐC!" ribbon stays up after crossing a tier. */
  speedUpBannerMs: 800,

  /** Lane change tween duration. */
  laneChangeMs: 220,

  /** Ignore repeat lane inputs that arrive faster than this. */
  inputDebounceMs: 80,

  /** Largest simulation step; protects against tab-switch time jumps. */
  maxDeltaSeconds: 0.05,

  /** Countdown steps shown before a run starts. */
  countdownSteps: ['3', '2', '1', 'CHẠY!'] as const,
  countdownStepMs: 700,

  /** Track geometry. */
  trackSegmentLength: 20,
  trackSegmentCount: 10,
  trackWidth: 9.4,

  /** Camera. */
  cameraFov: 52,
  /** Portrait phones need a taller field of view to keep the gates in frame. */
  cameraFovPortrait: 64,
  /**
   * Extra field of view at the top speed tier, added gradually.
   * Small on purpose: enough to feel quick, not enough to distort the gates.
   */
  cameraFovSpeedBoost: 6,
  cameraOffset: { x: 0, y: 4.6, z: 7.5 },
  cameraLookAhead: { x: 0, y: 1.2, z: -8 },

  /** Particles. */
  maxParticles: 80,
  particlesPerBurst: 10,

  /** Decoration pooling. */
  decorationCount: 56,
  decorationSpacing: 5,

  /** How far behind the camera an object may fall before it is recycled. */
  recycleBehindDistance: 30,
} as const;

export const COLORS = {
  sky: 0xbfe8ff,
  grass: 0x78c850,
  road: 0x596a7a,
  roadLine: 0xf8fafc,
  primary: 0xffb703,
  primaryEdge: 0xd97904,
  secondary: 0x21b6d7,
  badge: 0x7b61e8,
  outline: 0x243b53,
  panel: 0xfff4c7,
  panelEdge: 0xa9602a,
  correct: 0x2ecc71,
  wrong: 0xff8a65,
  coin: 0xffd166,
  text: 0x183153,
} as const;

/**
 * Base colour of each answer gate.
 *
 * Fixed per lane (blue, purple, yellow) so the colouring never hints at which
 * gate is the right one.
 */
export const LANE_GATE_COLORS: readonly [number, number, number] = [
  COLORS.secondary,
  COLORS.badge,
  COLORS.primary,
];

/** CSS colour strings for the canvas-drawn answer panels. */
export const CSS_COLORS = {
  panelBackground: '#fff4c7',
  panelBorder: '#243b53',
  panelText: '#183153',
  panelCorrect: '#2ecc71',
  panelWrong: '#ff8a65',
} as const;
