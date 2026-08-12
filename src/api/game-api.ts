import type { Grade } from '../../shared/game-types.ts';
import type {
  AvatarsResponse,
  CreatePlayerRequest,
  CreatePlayerResponse,
  FinishRunRequest,
  FinishRunResponse,
  LeaderboardPeriod,
  LeaderboardResponse,
  PlayerMeResponse,
  StartRunResponse,
  UpdatePlayerRequest,
} from '../../shared/contracts/api.ts';
import type { MapId } from '../../shared/maps/map-manifest.ts';
import type { ApiClient } from './ApiClient.ts';

/** Typed calls for each endpoint, grouped by resource. */

export const playersApi = {
  create(client: ApiClient, body: CreatePlayerRequest): Promise<CreatePlayerResponse> {
    return client.request('/players', { method: 'POST', body, auth: 'none' });
  },

  me(client: ApiClient): Promise<PlayerMeResponse> {
    return client.request('/players/me', { auth: 'required' });
  },

  update(
    client: ApiClient,
    body: UpdatePlayerRequest,
  ): Promise<{ player: PlayerMeResponse['player'] }> {
    return client.request('/players/me', { method: 'PATCH', body, auth: 'required' });
  },
};

export const runsApi = {
  start(client: ApiClient, grade: Grade, mapId: MapId): Promise<StartRunResponse> {
    return client.request('/runs/start', {
      method: 'POST',
      body: { grade, mapId },
      auth: 'required',
    });
  },

  /**
   * Finishing is idempotent on the server, so a controlled retry is safe and
   * a dropped response never costs the player their run.
   */
  finish(client: ApiClient, runId: string, body: FinishRunRequest): Promise<FinishRunResponse> {
    return client.request(`/runs/${encodeURIComponent(runId)}/finish`, {
      method: 'POST',
      body,
      auth: 'required',
      retry: true,
    });
  },
};

export const leaderboardApi = {
  get(
    client: ApiClient,
    params: { grade: Grade; period: LeaderboardPeriod; limit?: number },
  ): Promise<LeaderboardResponse> {
    const search = new URLSearchParams({
      grade: String(params.grade),
      period: params.period,
      limit: String(params.limit ?? 10),
    });
    return client.request(`/leaderboard?${search.toString()}`, { auth: 'optional', retry: true });
  },
};

export const avatarsApi = {
  list(client: ApiClient): Promise<AvatarsResponse> {
    return client.request('/avatars', { auth: 'none', retry: true });
  },
};
