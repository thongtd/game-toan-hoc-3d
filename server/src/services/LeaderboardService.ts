import type { Grade } from '../../../shared/game-types.ts';
import { isGrade } from '../../../shared/game-types.ts';
import type {
  LeaderboardEntryDto,
  LeaderboardPeriod,
  LeaderboardResponse,
} from '../../../shared/contracts/api.ts';
import type { GameRepository } from '../repositories/GameRepository.ts';
import { badRequest } from '../http/errors.ts';
import { currentWeek, toLocalIso } from '../utils/time.ts';

const MIN_LIMIT = 5;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

interface CacheEntry {
  expiresAt: number;
  response: LeaderboardResponse;
}

export interface LeaderboardParams {
  grade: Grade;
  period: LeaderboardPeriod;
  limit: number;
}

/**
 * Reads the ranking boards.
 *
 * Boards are per grade because a lap of grade 1 sums and a lap of grade 5
 * fractions are not comparable. Responses are cached briefly so a burst of
 * players opening the hub does not turn into a burst of queries.
 */
export class LeaderboardService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly repository: GameRepository;
  private readonly cacheMs: number;

  constructor(repository: GameRepository, cacheMs: number) {
    this.repository = repository;
    this.cacheMs = cacheMs;
  }

  /** Validates raw query-string values into typed parameters. */
  parseParams(search: URLSearchParams): LeaderboardParams {
    const rawGrade = Number.parseInt(search.get('grade') ?? '', 10);
    if (!isGrade(rawGrade)) {
      throw badRequest('VALIDATION_FAILED', 'Lớp phải là số từ 1 đến 5.', 'grade');
    }

    const rawPeriod = search.get('period') ?? 'weekly';
    if (rawPeriod !== 'weekly' && rawPeriod !== 'all_time') {
      throw badRequest('VALIDATION_FAILED', 'Khoảng thời gian không hợp lệ.', 'period');
    }

    const rawLimit = search.get('limit');
    const limit = rawLimit === null ? DEFAULT_LIMIT : Number.parseInt(rawLimit, 10);
    if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
      throw badRequest(
        'VALIDATION_FAILED',
        `Số dòng phải từ ${String(MIN_LIMIT)} đến ${String(MAX_LIMIT)}.`,
        'limit',
      );
    }

    return { grade: rawGrade, period: rawPeriod, limit };
  }

  async get(params: LeaderboardParams, playerId: string | null): Promise<LeaderboardResponse> {
    const window = periodWindow(params.period);
    const cacheKey = `${String(params.grade)}:${params.period}:${String(params.limit)}`;

    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    let base: LeaderboardResponse;

    if (cached !== undefined && cached.expiresAt > now) {
      base = cached.response;
    } else {
      const rows = await this.repository.getLeaderboard({
        grade: params.grade,
        period: params.period,
        limit: params.limit,
        periodStart: window.startIso,
        periodEnd: window.endIso,
      });

      base = {
        grade: params.grade,
        period: params.period,
        periodStart: window.displayStart,
        periodEnd: window.displayEnd,
        entries: rows.map(toEntryDto),
        currentPlayerEntry: null,
        generatedAt: new Date(now).toISOString(),
      };
      this.cache.set(cacheKey, { expiresAt: now + this.cacheMs, response: base });
    }

    // The caller's own row is never cached: it depends on who is asking.
    let currentPlayerEntry: LeaderboardEntryDto | null = null;
    if (playerId !== null) {
      const rank = await this.repository.getPlayerRank({
        grade: params.grade,
        period: params.period,
        limit: params.limit,
        periodStart: window.startIso,
        periodEnd: window.endIso,
        playerId,
      });
      currentPlayerEntry = rank === null ? null : toEntryDto(rank);
    }

    return { ...base, currentPlayerEntry };
  }

  /** Rank of one player, used right after a run is verified. */
  async rankOf(grade: Grade, playerId: string): Promise<number | null> {
    const window = periodWindow('weekly');
    const row = await this.repository.getPlayerRank({
      grade,
      period: 'weekly',
      limit: MAX_LIMIT,
      periodStart: window.startIso,
      periodEnd: window.endIso,
      playerId,
    });
    return row?.rank ?? null;
  }

  /** Drops cached boards, e.g. after a run changes the standings. */
  invalidate(): void {
    this.cache.clear();
  }
}

interface PeriodWindow {
  startIso: string | null;
  endIso: string | null;
  displayStart: string | null;
  displayEnd: string | null;
}

function periodWindow(period: LeaderboardPeriod): PeriodWindow {
  if (period === 'all_time') {
    return { startIso: null, endIso: null, displayStart: null, displayEnd: null };
  }
  const week = currentWeek();
  return {
    startIso: week.start.toISOString(),
    endIso: week.end.toISOString(),
    displayStart: toLocalIso(week.start),
    displayEnd: toLocalIso(week.end),
  };
}

/**
 * Public projection: rank, nickname, avatar and score only.
 * Age, player id, duration and run history stay on the server.
 */
function toEntryDto(row: {
  rank: number;
  nickname: string;
  avatarId: string;
  score: number;
}): LeaderboardEntryDto {
  return {
    rank: row.rank,
    nickname: row.nickname,
    avatarId: row.avatarId,
    score: row.score,
  };
}
