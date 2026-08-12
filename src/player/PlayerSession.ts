import type { Grade } from '../../shared/game-types.ts';
import type {
  CreatePlayerRequest,
  PlayerDto,
  UpdatePlayerRequest,
} from '../../shared/contracts/api.ts';
import { type ApiClient, ApiRequestError } from '../api/ApiClient.ts';
import { playersApi } from '../api/game-api.ts';
import { PlayerStorage } from './player-storage.ts';

/**
 * The signed-in player, such as it is.
 *
 * There are no accounts: a random token issued by the server is the whole
 * identity. This class keeps that token, the cached profile and the verified
 * best scores together, and always treats the server as the source of truth.
 */
export class PlayerSession {
  readonly storage = PlayerStorage.fromWindow();

  private profile: PlayerDto | null = null;
  private bestScores: Partial<Record<Grade, number>> = {};

  constructor(private readonly client: ApiClient) {
    this.client.setToken(this.storage.getToken());
    // Render instantly from cache; `restore()` reconciles with the server.
    this.profile = this.storage.getToken() === null ? null : this.storage.getCachedProfile();
  }

  get player(): PlayerDto | null {
    return this.profile;
  }

  get isReturning(): boolean {
    return this.storage.getToken() !== null;
  }

  bestScore(grade: Grade): number {
    return this.bestScores[grade] ?? 0;
  }

  get allBestScores(): Partial<Record<Grade, number>> {
    return { ...this.bestScores };
  }

  /**
   * Loads the profile behind the stored token.
   * Returns null when there is no token or the token is no longer valid.
   */
  async restore(): Promise<PlayerDto | null> {
    if (this.storage.getToken() === null) return null;

    try {
      const response = await playersApi.me(this.client);
      this.profile = response.player;
      this.bestScores = response.bestScores;
      this.storage.setCachedProfile(response.player);
      return response.player;
    } catch (error) {
      if (error instanceof ApiRequestError && error.isUnauthorized) {
        // The token is gone or was revoked: start over rather than pretend.
        this.signOut();
        return null;
      }
      // Offline: keep the cached profile so the hub still shows something.
      throw error;
    }
  }

  async create(input: CreatePlayerRequest): Promise<PlayerDto> {
    const response = await playersApi.create(this.client, input);
    this.storage.setToken(response.playerToken);
    this.client.setToken(response.playerToken);
    this.profile = response.player;
    this.bestScores = {};
    this.storage.setCachedProfile(response.player);
    return response.player;
  }

  async update(patch: UpdatePlayerRequest): Promise<PlayerDto> {
    const response = await playersApi.update(this.client, patch);
    this.profile = response.player;
    this.storage.setCachedProfile(response.player);
    return response.player;
  }

  /** Records a verified best score returned by the run endpoint. */
  noteBestScore(grade: Grade, score: number): void {
    if (score > (this.bestScores[grade] ?? 0)) {
      this.bestScores = { ...this.bestScores, [grade]: score };
    }
  }

  signOut(): void {
    this.storage.clearToken();
    this.client.setToken(null);
    this.profile = null;
    this.bestScores = {};
  }
}
