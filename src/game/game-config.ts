/** Tuning values for the runner. Everything gameplay-related lives here. */

export const LANE_POSITIONS_X: readonly [number, number, number] = [-2.6, 0, 2.6];

export const GAME_CONFIG = {
  /** Questions in one run. */
  questionsPerRun: 12,

  /** Speed added to the world after each resolved question. */
  speedIncrementPerQuestion: 0.28,

  /** Distance from the player to the first gate of a run. */
  firstGateDistance: 48,

  /** Random spacing between consecutive gates. */
  gateDistanceMin: 45,
  gateDistanceMax: 55,

  /**
   * A question must stay readable for at least this long before its gate
   * arrives. Gate spacing is stretched when the world speed would otherwise
   * make the run too fast to read.
   */
  minReadingSeconds: 4.5,

  /** Duration of the correct/wrong banner. */
  feedbackMs: 800,

  /** Lane change tween duration. */
  laneChangeMs: 220,

  /** Ignore repeat lane inputs that arrive faster than this. */
  inputDebounceMs: 80,

  /** After a wrong answer the world briefly eases off. */
  wrongAnswerSlowdownFactor: 0.85,
  wrongAnswerSlowdownMs: 500,

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
