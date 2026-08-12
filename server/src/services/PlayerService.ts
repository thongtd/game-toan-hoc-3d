import type {
  CreatePlayerRequest,
  CreatePlayerResponse,
  PlayerDto,
  PlayerMeResponse,
  UpdatePlayerRequest,
} from '../../../shared/contracts/api.ts';
import {
  validateNickname,
  normaliseNicknameForSearch,
} from '../../../shared/validation/nickname.ts';
import { validateAge, validateAvatarId } from '../../../shared/validation/profile.ts';
import type { PlayerRecord } from '../domain/records.ts';
import type { GameRepository } from '../repositories/GameRepository.ts';
import { badRequest, unauthorized } from '../http/errors.ts';
import { generatePlayerToken, hashPlayerToken, newPlayerId } from '../utils/token.ts';
import { nowIso } from '../utils/time.ts';

/**
 * Player profiles and anonymous identity.
 *
 * Validation runs here again even though the browser already did it: the
 * client's checks are for fast feedback, these are the ones that decide.
 */
export class PlayerService {
  private readonly repository: GameRepository;
  private readonly pepper: string;

  constructor(repository: GameRepository, pepper: string) {
    this.repository = repository;
    this.pepper = pepper;
  }

  async create(input: unknown): Promise<CreatePlayerResponse> {
    const body = (input ?? {}) as Partial<CreatePlayerRequest>;

    const nickname = validateNickname(body.nickname);
    if (!nickname.ok) throw badRequest(nickname.code, nickname.message, 'nickname');

    const age = validateAge(body.age);
    if (!age.ok) throw badRequest(age.code, age.message, 'age');

    const avatar = validateAvatarId(body.avatarId);
    if (!avatar.ok) throw badRequest(avatar.code, avatar.message, 'avatarId');

    // The raw token is returned once and then only ever exists as a hash here.
    const token = generatePlayerToken();
    const record = await this.repository.createPlayer({
      id: newPlayerId(),
      nickname: nickname.value,
      nicknameNormalized: normaliseNicknameForSearch(nickname.value),
      age: age.value,
      avatarId: avatar.value,
      tokenHash: hashPlayerToken(token, this.pepper),
      createdAt: nowIso(),
    });

    return { player: toDto(record), playerToken: token };
  }

  /** Resolves a bearer token to an active player, or null. */
  async authenticate(token: string | null): Promise<PlayerRecord | null> {
    if (token === null || token.length === 0) return null;

    const player = await this.repository.getPlayerByTokenHash(hashPlayerToken(token, this.pepper));
    if (player?.status !== 'active') return null;

    await this.repository.touchPlayer(player.id, nowIso());
    return player;
  }

  async me(player: PlayerRecord): Promise<PlayerMeResponse> {
    // Both are read together so the hub can render the profile and pick the
    // next map without a second round trip.
    const [bestScores, mapStats] = await Promise.all([
      this.repository.getBestScores(player.id),
      this.repository.getMapStats(player.id),
    ]);
    return { player: toDto(player), bestScores, mapStats };
  }

  async update(player: PlayerRecord, input: unknown): Promise<PlayerDto> {
    const body = (input ?? {}) as UpdatePlayerRequest;

    const hasAny =
      body.nickname !== undefined || body.age !== undefined || body.avatarId !== undefined;
    if (!hasAny) {
      throw badRequest('VALIDATION_FAILED', 'Chưa có thay đổi nào để lưu.');
    }

    const patch: Parameters<GameRepository['updatePlayer']>[1] = { updatedAt: nowIso() };

    if (body.nickname !== undefined) {
      const nickname = validateNickname(body.nickname);
      if (!nickname.ok) throw badRequest(nickname.code, nickname.message, 'nickname');
      patch.nickname = nickname.value;
      patch.nicknameNormalized = normaliseNicknameForSearch(nickname.value);
    }

    if (body.age !== undefined) {
      const age = validateAge(body.age);
      if (!age.ok) throw badRequest(age.code, age.message, 'age');
      patch.age = age.value;
    }

    if (body.avatarId !== undefined) {
      const avatar = validateAvatarId(body.avatarId);
      if (!avatar.ok) throw badRequest(avatar.code, avatar.message, 'avatarId');
      patch.avatarId = avatar.value;
    }

    // `id`, `status`, token and scores are not patchable by design: they are
    // simply never read from the request body.
    const updated = await this.repository.updatePlayer(player.id, patch);
    return toDto(updated);
  }

  requirePlayer(player: PlayerRecord | null): PlayerRecord {
    if (player === null) throw unauthorized();
    return player;
  }
}

/** Never exposes the token hash, status or last-seen timestamp. */
export function toDto(record: PlayerRecord): PlayerDto {
  return {
    id: record.id,
    nickname: record.nickname,
    age: record.age,
    avatarId: record.avatarId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
