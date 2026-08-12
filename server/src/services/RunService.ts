import type { Grade } from '../../../shared/game-types.ts';
import { isGrade } from '../../../shared/game-types.ts';
import type {
  FinishRunRequest,
  StartRunRequest,
  StartRunResponse,
  VerifiedRunResult,
} from '../../../shared/contracts/api.ts';
import { GENERATOR_VERSION, QUESTIONS_PER_RUN, RUN_TTL_MS } from '../../../shared/contracts/api.ts';
import { MAP_MANIFEST_VERSION, isMapAvailable } from '../../../shared/maps/map-manifest.ts';
import { verifyRun } from '../../../shared/scoring/verify-run.ts';
import type { GameRunRecord, PlayerRecord } from '../domain/records.ts';
import type { GameRepository } from '../repositories/GameRepository.ts';
import { badRequest, forbidden, notFound, HttpError } from '../http/errors.ts';
import { generateSeed, newRunId } from '../utils/token.ts';
import { addMs, isExpired } from '../utils/time.ts';
import type { LeaderboardService } from './LeaderboardService.ts';

/** Most unfinished runs a player may hold open at once. */
const MAX_OPEN_RUNS = 3;

/**
 * Run sessions and score verification.
 *
 * The seed comes from here, never from the client, and the final score is
 * recomputed here from the answers alone. A client that reports its own score
 * is simply ignored, because no field carries one.
 */
export class RunService {
  private readonly repository: GameRepository;
  private readonly leaderboard: LeaderboardService;

  constructor(repository: GameRepository, leaderboard: LeaderboardService) {
    this.repository = repository;
    this.leaderboard = leaderboard;
  }

  async start(player: PlayerRecord, input: unknown): Promise<StartRunResponse> {
    const body = (input ?? {}) as Partial<StartRunRequest>;
    if (!isGrade(body.grade)) {
      throw badRequest('VALIDATION_FAILED', 'Lớp phải là số từ 1 đến 5.', 'grade');
    }

    // The map is whitelisted against the shared manifest: a client cannot
    // invent one, and a map switched off in this release is refused outright.
    if (!isMapAvailable(body.mapId)) {
      throw badRequest(
        'MAP_NOT_AVAILABLE',
        'Bản đồ này hiện chưa chơi được, bạn chọn bản đồ khác nhé!',
        'mapId',
      );
    }

    const now = new Date();
    const open = await this.repository.countOpenRuns(player.id, now.toISOString());
    if (open >= MAX_OPEN_RUNS) {
      throw new HttpError(
        429,
        'TOO_MANY_REQUESTS',
        'Bạn đang có quá nhiều lượt chơi chưa kết thúc, chờ một chút nhé!',
      );
    }

    const startedAt = now.toISOString();
    const expiresAt = addMs(now, RUN_TTL_MS).toISOString();

    const run = await this.repository.createRunSession({
      id: newRunId(),
      playerId: player.id,
      grade: body.grade,
      mapId: body.mapId,
      mapManifestVersion: MAP_MANIFEST_VERSION,
      seed: generateSeed(),
      generatorVersion: GENERATOR_VERSION,
      startedAt,
      expiresAt,
    });

    return {
      runId: run.id,
      grade: run.grade,
      // Echoed from the stored run, so the client renders what was recorded.
      mapId: run.mapId,
      mapManifestVersion: run.mapManifestVersion,
      seed: run.seed,
      generatorVersion: run.generatorVersion,
      totalQuestions: QUESTIONS_PER_RUN,
      startedAt: run.startedAt,
      expiresAt: run.expiresAt,
    };
  }

  async finish(player: PlayerRecord, runId: string, input: unknown): Promise<VerifiedRunResult> {
    const run = await this.repository.getRunById(runId);
    if (run === null) throw notFound('Không tìm thấy lượt chơi này.');
    if (run.playerId !== player.id) throw forbidden('Lượt chơi này không thuộc về bạn.');

    // Finishing twice returns the first result rather than creating a new one.
    if (run.status === 'finished') {
      return this.resultFromRecord(run, player, { recomputeRank: true, isNewBest: false });
    }
    if (run.status === 'rejected' || run.status === 'expired') {
      throw new HttpError(409, 'RUN_REJECTED', 'Lượt chơi này không hợp lệ, bạn chơi lại nhé!');
    }

    const body = (input ?? {}) as Partial<FinishRunRequest>;
    if (!Array.isArray(body.answers)) {
      throw badRequest('VALIDATION_FAILED', 'Thiếu danh sách câu trả lời.', 'answers');
    }

    const finishedAt = new Date();

    if (isExpired(run.expiresAt, finishedAt)) {
      await this.reject(run, 'RUN_EXPIRED', finishedAt.toISOString());
      throw new HttpError(
        410,
        'RUN_EXPIRED',
        'Lượt chơi đã quá hạn nên không được tính, bạn chơi lại nhé!',
      );
    }

    if (run.generatorVersion !== GENERATOR_VERSION) {
      await this.reject(run, 'GENERATOR_VERSION_UNSUPPORTED', finishedAt.toISOString());
      throw new HttpError(409, 'RUN_REJECTED', 'Phiên bản trò chơi đã thay đổi, bạn chơi lại nhé!');
    }

    // Best score before this run decides whether it is a new personal record.
    const previousBest = (await this.repository.getBestScores(player.id))[run.grade] ?? 0;

    const outcome = verifyRun({
      grade: run.grade,
      seed: run.seed,
      totalQuestions: QUESTIONS_PER_RUN,
      answers: body.answers,
      serverElapsedMs: finishedAt.getTime() - Date.parse(run.startedAt),
      clientDurationMs: typeof body.clientDurationMs === 'number' ? body.clientDurationMs : -1,
    });

    if (!outcome.ok) {
      await this.reject(run, outcome.reason, finishedAt.toISOString());
      throw new HttpError(422, 'RUN_REJECTED', 'Lượt chơi chưa hợp lệ nên không được ghi nhận.');
    }

    const finished = await this.repository.finishRun({
      id: run.id,
      status: 'finished',
      score: outcome.score,
      correctAnswers: outcome.correctAnswers,
      bestStreak: outcome.bestStreak,
      durationMs: outcome.durationMs,
      answers: outcome.answers,
      rejectionReason: null,
      finishedAt: finishedAt.toISOString(),
    });

    // The standings just changed, so cached boards must not be served again.
    this.leaderboard.invalidate();

    return this.resultFromRecord(finished, player, {
      recomputeRank: true,
      isNewBest: outcome.score > previousBest,
      starsOverride: outcome.stars,
    });
  }

  private async reject(run: GameRunRecord, reason: string, finishedAt: string): Promise<void> {
    await this.repository.finishRun({
      id: run.id,
      status: 'rejected',
      score: null,
      correctAnswers: null,
      bestStreak: null,
      durationMs: null,
      answers: null,
      rejectionReason: reason,
      finishedAt,
    });
  }

  private async resultFromRecord(
    run: GameRunRecord,
    player: PlayerRecord,
    options: { recomputeRank: boolean; isNewBest: boolean; starsOverride?: 1 | 2 | 3 },
  ): Promise<VerifiedRunResult> {
    const rank = options.recomputeRank ? await this.leaderboard.rankOf(run.grade, player.id) : null;

    return {
      runId: run.id,
      grade: run.grade,
      // Always the map stored at start: the finish payload has no say in it.
      mapId: run.mapId,
      score: run.score ?? 0,
      correctAnswers: run.correctAnswers ?? 0,
      bestStreak: run.bestStreak ?? 0,
      stars: options.starsOverride ?? starsFromCorrect(run.correctAnswers ?? 0),
      durationMs: run.durationMs ?? 0,
      isNewBest: options.isNewBest,
      rank,
    };
  }
}

function starsFromCorrect(correctAnswers: number): 1 | 2 | 3 {
  if (correctAnswers >= 10) return 3;
  if (correctAnswers >= 7) return 2;
  return 1;
}

export type { Grade };
