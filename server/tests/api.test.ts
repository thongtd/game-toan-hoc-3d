import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import type { AppHandles } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { SqliteGameRepository } from '../src/repositories/SqliteGameRepository.ts';
import type { Grade } from '../../shared/game-types.ts';
import { generateQuestions } from '../../shared/math/question-generator.ts';
import { QUESTIONS_PER_RUN } from '../../shared/contracts/api.ts';
import type {
  ApiErrorBody,
  AvatarsResponse,
  CreatePlayerResponse,
  FinishRunResponse,
  HealthResponse,
  LeaderboardResponse,
  PlayerDto,
  PlayerMeResponse,
  StartRunResponse,
} from '../../shared/contracts/api.ts';

/**
 * Integration tests over the real HTTP surface.
 *
 * The app is started on an ephemeral port with a throwaway SQLite file, so the
 * routing, auth, validation and storage layers are all exercised together.
 */

let app: AppHandles;
let baseUrl: string;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'mr3d-api-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    STORAGE_DRIVER: 'sqlite',
    SQLITE_PATH: path.join(dataDir, 'api.db'),
    PLAYER_TOKEN_PEPPER: 'test-pepper-value-that-is-long-enough-32',
  });

  app = createApp(config, new SqliteGameRepository(config.sqlitePath), { rateLimitEnabled: false });
  await new Promise<void>((resolve) => {
    app.server.listen(0, '127.0.0.1', resolve);
  });

  const address = app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${String(address.port)}/api/v1`;
});

afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
  rawBody?: string;
  contentType?: string | null;
}

async function call(pathname: string, options: CallOptions = {}): Promise<ApiCall> {
  const headers: Record<string, string> = {};
  if (options.contentType !== null) {
    headers['content-type'] = options.contentType ?? 'application/json';
  }
  if (options.token !== undefined) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit = { method: options.method ?? 'GET', headers };
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  if (body !== undefined) init.body = body;

  const response = await fetch(`${baseUrl}${pathname}`, init);

  const text = await response.text();
  return {
    status: response.status,
    json: text.length === 0 ? null : (JSON.parse(text) as unknown),
  };
}

interface ApiCall {
  status: number;
  json: unknown;
}

/** Narrows a failed response to the documented error envelope. */
function apiError(json: unknown): ApiErrorBody['error'] {
  return (json as ApiErrorBody).error;
}

async function createPlayer(nickname = 'Gấu Mập'): Promise<CreatePlayerResponse> {
  const response = await call('/players', {
    method: 'POST',
    body: { nickname, age: 8, avatarId: 'animal-panda-01' },
  });
  expect(response.status).toBe(201);
  return response.json as CreatePlayerResponse;
}

/** Plays a full run correctly, using the seed the server issued. */
async function playRun(
  token: string,
  grade: Grade,
  options: { correctCount?: number; responseMs?: number } = {},
): Promise<FinishRunResponse> {
  const started = (await call('/runs/start', { method: 'POST', token, body: { grade } }))
    .json as StartRunResponse;

  const questions = generateQuestions({
    grade,
    seed: started.seed,
    count: started.totalQuestions,
  });
  const correctCount = options.correctCount ?? QUESTIONS_PER_RUN;

  const answers = questions.map((question, index) => ({
    questionIndex: index,
    selectedIndex:
      index < correctCount ? question.correctIndex : ((question.correctIndex + 1) % 3 as 0 | 1 | 2),
    responseMs: options.responseMs ?? 3000,
  }));

  // The server refuses runs that finish implausibly fast.
  await new Promise((resolve) => setTimeout(resolve, 5100));

  const finished = await call(`/runs/${started.runId}/finish`, {
    method: 'POST',
    token,
    body: { clientDurationMs: 5200, answers },
  });
  expect(finished.status, JSON.stringify(finished.json)).toBe(200);
  return finished.json as FinishRunResponse;
}

describe('GET /health', () => {
  it('reports storage connectivity without leaking paths', async () => {
    const response = await call('/health');
    expect(response.status).toBe(200);
    expect((response.json as HealthResponse).status).toBe('ok');
    expect((response.json as HealthResponse).storage).toBe('ok');
    expect(JSON.stringify(response.json)).not.toContain(dataDir);
  });
});

describe('GET /avatars', () => {
  it('returns the enabled catalog without licence metadata', async () => {
    const response = await call('/avatars');
    expect(response.status).toBe(200);
    expect((response.json as AvatarsResponse).items.length).toBeGreaterThanOrEqual(24);

    const first = (response.json as AvatarsResponse).items[0] ?? {};
    expect(Object.keys(first).sort()).toEqual(['category', 'displayName', 'id', 'imageUrl']);
  });
});

describe('POST /players', () => {
  it('creates a player and returns a token once', async () => {
    const created = await createPlayer();
    expect(created.player.nickname).toBe('Gấu Mập');
    expect(created.player.age).toBe(8);
    expect(created.playerToken.length).toBeGreaterThan(20);
    expect(JSON.stringify(created.player)).not.toContain(created.playerToken);
  });

  it('rejects an invalid nickname with the documented error code', async () => {
    const response = await call('/players', {
      method: 'POST',
      body: { nickname: 'a', age: 8, avatarId: 'animal-panda-01' },
    });
    expect(response.status).toBe(400);
    expect(apiError(response.json).code).toBe('NICKNAME_TOO_SHORT');
    expect(apiError(response.json).field).toBe('nickname');
    expect(apiError(response.json).requestId).toMatch(/^req_/);
  });

  it('rejects an out-of-range age and an unknown avatar', async () => {
    const age = await call('/players', {
      method: 'POST',
      body: { nickname: 'Gấu Mập', age: 3, avatarId: 'animal-panda-01' },
    });
    expect(age.status).toBe(400);
    expect(apiError(age.json).code).toBe('AGE_OUT_OF_RANGE');

    const avatar = await call('/players', {
      method: 'POST',
      body: { nickname: 'Gấu Mập', age: 8, avatarId: 'not-a-real-avatar' },
    });
    expect(avatar.status).toBe(400);
    expect(apiError(avatar.json).code).toBe('AVATAR_UNKNOWN');
  });

  it('requires a JSON content type', async () => {
    const response = await call('/players', {
      method: 'POST',
      rawBody: 'nickname=x',
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(response.status).toBe(415);
    expect(apiError(response.json).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a body over the size limit', async () => {
    const response = await call('/players', {
      method: 'POST',
      rawBody: JSON.stringify({ nickname: 'x'.repeat(40000) }),
    });
    expect(response.status).toBe(413);
  });
});

describe('GET /players/me', () => {
  it('returns the profile for a valid token', async () => {
    const created = await createPlayer();
    const response = await call('/players/me', { token: created.playerToken });

    expect(response.status).toBe(200);
    const body = response.json as PlayerMeResponse;
    expect(body.player.id).toBe(created.player.id);
    expect(body.bestScores).toEqual({});
  });

  it('rejects a missing or wrong token', async () => {
    expect((await call('/players/me')).status).toBe(401);

    const wrong = await call('/players/me', { token: 'not-a-real-token' });
    expect(wrong.status).toBe(401);
    expect(apiError(wrong.json).code).toBe('UNAUTHORIZED');
  });
});

describe('PATCH /players/me', () => {
  it('updates the allowed fields', async () => {
    const created = await createPlayer();
    const response = await call('/players/me', {
      method: 'PATCH',
      token: created.playerToken,
      body: { nickname: 'Panda Tốc Độ', age: 9, avatarId: 'robot-blue-01' },
    });

    expect(response.status).toBe(200);
    expect((response.json as { player: PlayerDto }).player.nickname).toBe('Panda Tốc Độ');
    expect((response.json as { player: PlayerDto }).player.age).toBe(9);
    expect((response.json as { player: PlayerDto }).player.avatarId).toBe('robot-blue-01');
  });

  it('ignores attempts to change protected fields', async () => {
    const created = await createPlayer();
    const response = await call('/players/me', {
      method: 'PATCH',
      token: created.playerToken,
      body: { nickname: 'Vẫn Là Tôi', id: 'hacked', status: 'disabled', score: 99999 },
    });

    expect(response.status).toBe(200);
    expect((response.json as { player: PlayerDto }).player.id).toBe(created.player.id);

    // The player must still be usable, proving status was not changed.
    expect((await call('/players/me', { token: created.playerToken })).status).toBe(200);
  });

  it('requires at least one field', async () => {
    const created = await createPlayer();
    const response = await call('/players/me', {
      method: 'PATCH',
      token: created.playerToken,
      body: {},
    });
    expect(response.status).toBe(400);
    expect(apiError(response.json).code).toBe('VALIDATION_FAILED');
  });
});

describe('runs', () => {
  it('issues a server-side seed and verifies the score', async () => {
    const created = await createPlayer();
    const finished = await playRun(created.playerToken, 3);

    expect(finished.result.correctAnswers).toBe(QUESTIONS_PER_RUN);
    expect(finished.result.stars).toBe(3);
    expect(finished.result.score).toBeGreaterThan(0);
    expect(finished.result.isNewBest).toBe(true);
    expect(finished.result.rank).toBe(1);
  }, 20000);

  it('ignores any score the client tries to send', async () => {
    const created = await createPlayer();
    const started = (
      await call('/runs/start', { method: 'POST', token: created.playerToken, body: { grade: 1 } })
    ).json as StartRunResponse;

    const questions = generateQuestions({ grade: 1, seed: started.seed, count: 12 });
    // Every answer wrong, but the payload also carries a huge fake score.
    const answers = questions.map((question, index) => ({
      questionIndex: index,
      selectedIndex: ((question.correctIndex + 1) % 3) as 0 | 1 | 2,
      responseMs: 2000,
    }));

    await new Promise((resolve) => setTimeout(resolve, 5100));
    const finished = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: created.playerToken,
      body: { clientDurationMs: 6000, answers, score: 999999, stars: 3 },
    });

    expect(finished.status).toBe(200);
    expect((finished.json as FinishRunResponse).result.score).toBe(0);
    expect((finished.json as FinishRunResponse).result.correctAnswers).toBe(0);
  }, 20000);

  it('is idempotent when finished twice', async () => {
    const created = await createPlayer();
    const started = (
      await call('/runs/start', { method: 'POST', token: created.playerToken, body: { grade: 2 } })
    ).json as StartRunResponse;

    const questions = generateQuestions({ grade: 2, seed: started.seed, count: 12 });
    const answers = questions.map((question, index) => ({
      questionIndex: index,
      selectedIndex: question.correctIndex,
      responseMs: 2500,
    }));

    await new Promise((resolve) => setTimeout(resolve, 5100));
    const first = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: created.playerToken,
      body: { clientDurationMs: 6000, answers },
    });
    const second = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: created.playerToken,
      body: { clientDurationMs: 1, answers: answers.slice(0, 3) },
    });

    expect(second.status).toBe(200);
    expect((second.json as FinishRunResponse).result.score).toBe(
      (first.json as FinishRunResponse).result.score,
    );
  }, 20000);

  it('rejects a run belonging to another player', async () => {
    const owner = await createPlayer('Chủ Sở Hữu');
    const other = await createPlayer('Người Khác');

    const started = (
      await call('/runs/start', { method: 'POST', token: owner.playerToken, body: { grade: 1 } })
    ).json as StartRunResponse;

    const response = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: other.playerToken,
      body: { clientDurationMs: 6000, answers: [] },
    });

    expect(response.status).toBe(403);
    expect(apiError(response.json).code).toBe('FORBIDDEN');
  });

  it('rejects a payload with the wrong number of answers', async () => {
    const created = await createPlayer();
    const started = (
      await call('/runs/start', { method: 'POST', token: created.playerToken, body: { grade: 1 } })
    ).json as StartRunResponse;

    await new Promise((resolve) => setTimeout(resolve, 5100));
    const response = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: created.playerToken,
      body: {
        clientDurationMs: 6000,
        answers: [{ questionIndex: 0, selectedIndex: 0, responseMs: 100 }],
      },
    });

    expect(response.status).toBe(422);
    expect(apiError(response.json).code).toBe('RUN_REJECTED');
  }, 20000);

  it('rejects an implausibly fast run', async () => {
    const created = await createPlayer();
    const started = (
      await call('/runs/start', { method: 'POST', token: created.playerToken, body: { grade: 1 } })
    ).json as StartRunResponse;

    const questions = generateQuestions({ grade: 1, seed: started.seed, count: 12 });
    const answers = questions.map((question, index) => ({
      questionIndex: index,
      selectedIndex: question.correctIndex,
      responseMs: 10,
    }));

    // Finishing immediately: the server clock says this cannot be a real run.
    const response = await call(`/runs/${started.runId}/finish`, {
      method: 'POST',
      token: created.playerToken,
      body: { clientDurationMs: 50, answers },
    });

    expect(response.status).toBe(422);
  });

  it('requires a valid grade to start', async () => {
    const created = await createPlayer();
    const response = await call('/runs/start', {
      method: 'POST',
      token: created.playerToken,
      body: { grade: 9 },
    });
    expect(response.status).toBe(400);
    expect(apiError(response.json).field).toBe('grade');
  });
});

describe('GET /leaderboard', () => {
  it('validates its query parameters', async () => {
    expect((await call('/leaderboard')).status).toBe(400);
    expect((await call('/leaderboard?grade=9')).status).toBe(400);
    expect((await call('/leaderboard?grade=1&period=daily')).status).toBe(400);
    expect((await call('/leaderboard?grade=1&limit=2')).status).toBe(400);
    expect((await call('/leaderboard?grade=1&limit=500')).status).toBe(400);
  });

  it('works without a token and never exposes private fields', async () => {
    const created = await createPlayer('Người Dẫn Đầu');
    await playRun(created.playerToken, 4);

    const response = await call('/leaderboard?grade=4&period=weekly&limit=10');
    expect(response.status).toBe(200);

    const body = response.json as LeaderboardResponse;
    expect(body.entries).toHaveLength(1);
    expect(Object.keys(body.entries[0] ?? {}).sort()).toEqual([
      'avatarId',
      'nickname',
      'rank',
      'score',
    ]);

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('"age"');
    expect(serialised).not.toContain('playerId');
    expect(serialised).not.toContain(created.playerToken);
    expect(serialised).not.toContain('durationMs');
  }, 20000);

  it('adds the caller entry when authenticated', async () => {
    const created = await createPlayer('Tôi Đây');
    await playRun(created.playerToken, 5);

    const anonymous = (await call('/leaderboard?grade=5')).json as LeaderboardResponse;
    expect(anonymous.currentPlayerEntry).toBeNull();

    const authed = (await call('/leaderboard?grade=5', { token: created.playerToken }))
      .json as LeaderboardResponse;
    expect(authed.currentPlayerEntry?.nickname).toBe('Tôi Đây');
    expect(authed.currentPlayerEntry?.rank).toBe(1);
  }, 20000);

  it('keeps grades in separate boards', async () => {
    const created = await createPlayer();
    await playRun(created.playerToken, 2);

    expect(((await call('/leaderboard?grade=2')).json as LeaderboardResponse).entries).toHaveLength(1);
    expect(((await call('/leaderboard?grade=3')).json as LeaderboardResponse).entries).toHaveLength(0);
  }, 20000);
});

describe('routing and errors', () => {
  it('returns 404 for unknown paths and 405 for the wrong method', async () => {
    expect((await call('/nope')).status).toBe(404);
    expect((await call('/avatars', { method: 'POST', body: {} })).status).toBe(405);
  });

  it('stamps every response with a request id', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('rate limiting', () => {
  it('returns 429 once the window is exhausted', async () => {
    // This app instance is built with limiting enabled explicitly.
    await app.close();

    const config = loadConfig({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'sqlite',
      SQLITE_PATH: path.join(dataDir, 'rate.db'),
      PLAYER_TOKEN_PEPPER: 'test-pepper-value-that-is-long-enough-32',
    });

    app = createApp(config, new SqliteGameRepository(config.sqlitePath), { rateLimitEnabled: true });
    await new Promise<void>((resolve) => {
      app.server.listen(0, '127.0.0.1', resolve);
    });
    const address = app.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}/api/v1`;

    let sawTooMany = false;
    for (let i = 0; i < 15; i += 1) {
      const response = await call('/players', {
        method: 'POST',
        body: { nickname: `Tay đua ${String(i)}`, age: 8, avatarId: 'animal-panda-01' },
      });
      if (response.status === 429) {
        expect(apiError(response.json).code).toBe('TOO_MANY_REQUESTS');
        sawTooMany = true;
        break;
      }
    }

    expect(sawTooMany).toBe(true);
  });
});
