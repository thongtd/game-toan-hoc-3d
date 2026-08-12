import type { PlayerDto } from '../../shared/contracts/api.ts';
import type { Grade } from '../../shared/game-types.ts';
import { isGrade } from '../../shared/game-types.ts';
import type { LeaderboardPeriod } from '../../shared/contracts/api.ts';

/**
 * Local persistence for the anonymous identity.
 *
 * The token is the only thing here that matters; everything else is a cache to
 * render the hub instantly on a return visit and is reconciled against the API
 * as soon as it answers.
 */

export const TOKEN_KEY = 'math-runner-3d:player-token:v1';
export const PROFILE_CACHE_KEY = 'math-runner-3d:player-cache:v1';
export const HUB_PREFS_KEY = 'math-runner-3d:hub-prefs:v1';

export interface HubPreferences {
  grade: Grade;
  period: LeaderboardPeriod;
  avatarCatalogVersion: number;
}

const DEFAULT_PREFS: HubPreferences = {
  grade: 1,
  period: 'weekly',
  avatarCatalogVersion: 0,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class PlayerStorage {
  constructor(private readonly storage: StorageLike | null) {}

  static fromWindow(): PlayerStorage {
    try {
      const probe = '__mr3d_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return new PlayerStorage(window.localStorage);
    } catch {
      return new PlayerStorage(null);
    }
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Private browsing: the session simply does not survive a reload.
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Nothing else to do.
    }
  }

  /* --------------------------------- Token -------------------------------- */

  getToken(): string | null {
    const token = this.read(TOKEN_KEY);
    return token !== null && token.length > 0 ? token : null;
  }

  setToken(token: string): void {
    this.write(TOKEN_KEY, token);
  }

  clearToken(): void {
    this.remove(TOKEN_KEY);
    this.remove(PROFILE_CACHE_KEY);
  }

  /* ----------------------------- Profile cache ---------------------------- */

  getCachedProfile(): PlayerDto | null {
    const raw = this.read(PROFILE_CACHE_KEY);
    if (raw === null) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      if (typeof parsed.id !== 'string' || typeof parsed.nickname !== 'string') return null;
      if (typeof parsed.age !== 'number' || typeof parsed.avatarId !== 'string') return null;

      return {
        id: parsed.id,
        nickname: parsed.nickname,
        age: parsed.age,
        avatarId: parsed.avatarId,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      };
    } catch {
      return null;
    }
  }

  setCachedProfile(player: PlayerDto): void {
    this.write(PROFILE_CACHE_KEY, JSON.stringify(player));
  }

  /* ------------------------------ Preferences ----------------------------- */

  getPreferences(): HubPreferences {
    const raw = this.read(HUB_PREFS_KEY);
    if (raw === null) return { ...DEFAULT_PREFS };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return { ...DEFAULT_PREFS };

      const grade = parsed.grade;
      const period = parsed.period;
      const version = parsed.avatarCatalogVersion;

      return {
        grade: isGrade(grade) ? grade : DEFAULT_PREFS.grade,
        period: period === 'all_time' ? 'all_time' : 'weekly',
        avatarCatalogVersion: typeof version === 'number' ? version : 0,
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  setPreferences(prefs: Partial<HubPreferences>): void {
    this.write(HUB_PREFS_KEY, JSON.stringify({ ...this.getPreferences(), ...prefs }));
  }
}
