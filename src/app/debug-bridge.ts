import type { AppPhase } from './app-state.ts';
import type { GameSnapshot } from '../game/Game.ts';
import type { LaneIndex, Question, RunResult } from '../../shared/game-types.ts';
import type { MapId } from '../../shared/maps/map-manifest.ts';
import { DEFAULT_MAP_ID } from '../../shared/maps/map-manifest.ts';

export interface DebugSnapshot {
  phase: AppPhase;
  lane: LaneIndex;
  score: number;
  streak: number;
  questionIndex: number;
  activeQuestion: Question | null;
  /** World speed this frame, so a test can assert the ceiling holds. */
  speed: number;
  speedTier: number;
  mapId: MapId;
  /** True when the map's scenery failed and the spare road is in use. */
  mapFallback: boolean;
  playerX: number;
}

export interface RenderStats {
  geometries: number;
  textures: number;
  programs: number;
}

export interface DebugBridge {
  getSnapshot(): DebugSnapshot;
  moveToLane(lane: LaneIndex): void;
  setTimeScale(scale: number): void;
  getLastResult(): RunResult | null;
  /** GPU resource counts, used to prove map swaps do not leak. */
  getRenderStats(): RenderStats;
}

declare global {
  interface Window {
    __MATH_RUNNER_DEBUG__?: DebugBridge;
  }
}

export interface DebugSource {
  getPhase(): AppPhase;
  getSnapshot(): GameSnapshot | null;
  moveToLane(lane: LaneIndex): void;
  setTimeScale(scale: number): void;
  getLastResult(): RunResult | null;
  getRenderStats(): RenderStats;
}

/** True only in a dev server or an explicitly flagged test build. */
export function isDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_GAME_DEBUG === 'true';
}

/**
 * Exposes a read-only view of the running game for end-to-end tests.
 *
 * There is deliberately no "win the game" helper: the bridge can read state
 * and move the runner, which is exactly what a real player can do.
 */
export function installDebugBridge(source: DebugSource): void {
  window.__MATH_RUNNER_DEBUG__ = {
    getSnapshot(): DebugSnapshot {
      const snapshot = source.getSnapshot();
      return {
        phase: source.getPhase(),
        lane: snapshot?.lane ?? 1,
        score: snapshot?.score ?? 0,
        streak: snapshot?.streak ?? 0,
        questionIndex: snapshot?.questionIndex ?? -1,
        activeQuestion: snapshot?.activeQuestion ?? null,
        speed: snapshot?.speed ?? 0,
        speedTier: snapshot?.speedTier ?? 0,
        mapId: snapshot?.mapId ?? DEFAULT_MAP_ID,
        mapFallback: snapshot?.mapFallback ?? false,
        playerX: snapshot?.playerX ?? 0,
      };
    },
    moveToLane(lane: LaneIndex): void {
      source.moveToLane(lane);
    },
    setTimeScale(scale: number): void {
      source.setTimeScale(scale);
    },
    getLastResult(): RunResult | null {
      return source.getLastResult();
    },
    getRenderStats(): RenderStats {
      return source.getRenderStats();
    },
  };
}
