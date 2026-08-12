import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { ServerConfig } from './config.ts';
import type { GameRepository } from './repositories/GameRepository.ts';
import { PlayerService } from './services/PlayerService.ts';
import { LeaderboardService } from './services/LeaderboardService.ts';
import { RunService } from './services/RunService.ts';
import { RateLimiter } from './middleware/rate-limit.ts';
import { HttpError, notFound, tooManyRequests } from './http/errors.ts';
import { Router, readJsonBody, sendError, sendJson } from './http/router.ts';
import type { RequestContext } from './http/router.ts';
import { newRequestId, readBearerToken } from './utils/token.ts';
import { API_BASE_PATH } from '../../shared/contracts/api.ts';
import type { AvatarsResponse, HealthResponse } from '../../shared/contracts/api.ts';
import { AVATAR_CATALOG_VERSION, SELECTABLE_AVATARS } from '../../shared/content/avatars.ts';

export interface AppHandles {
  server: Server;
  repository: GameRepository;
  rateLimiter: RateLimiter;
  close: () => Promise<void>;
}

/**
 * Builds the HTTP application.
 *
 * Kept separate from the process entry point so integration tests can start it
 * on an ephemeral port with a temporary database.
 */
export function createApp(
  config: ServerConfig,
  repository: GameRepository,
  options: { rateLimitEnabled?: boolean } = {},
): AppHandles {
  const startedAt = Date.now();
  const rateLimiter = new RateLimiter(options.rateLimitEnabled ?? config.nodeEnv !== 'test');

  const players = new PlayerService(repository, config.playerTokenPepper);
  const leaderboard = new LeaderboardService(repository, config.leaderboardCacheMs);
  const runs = new RunService(repository, leaderboard);

  const router = new Router();

  router.get('/health', 'none', async (): Promise<HealthResponse> => {
    const storageOk = await repository.ping();
    return {
      status: storageOk ? 'ok' : 'degraded',
      storage: storageOk ? 'ok' : 'unavailable',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    };
  });

  router.get('/avatars', 'none', (): AvatarsResponse => {
    return {
      // Only selectable avatars are offered; source and licence live in the
      // repository docs, not in a runtime payload.
      items: SELECTABLE_AVATARS.map((avatar) => ({
        id: avatar.id,
        category: avatar.category,
        displayName: avatar.displayName,
        imageUrl: avatar.imageUrl,
      })),
      version: AVATAR_CATALOG_VERSION,
    };
  });

  router.post('/players', 'none', async (context) => {
    guard(rateLimiter.check('createPlayer', context.clientKey));
    const body = await context.readJson<unknown>();
    const created = await players.create(body);
    context.res.statusCode = 201;
    return created;
  });

  router.get('/players/me', 'required', async (context) => {
    return players.me(players.requirePlayer(context.player));
  });

  router.patch('/players/me', 'required', async (context) => {
    const player = players.requirePlayer(context.player);
    guard(rateLimiter.check('updatePlayer', player.id));
    const body = await context.readJson<unknown>();
    return { player: await players.update(player, body) };
  });

  router.post('/runs/start', 'required', async (context) => {
    const player = players.requirePlayer(context.player);
    guard(rateLimiter.check('startRun', player.id));
    const body = await context.readJson<unknown>();
    context.res.statusCode = 201;
    return runs.start(player, body);
  });

  router.post('/runs/:runId/finish', 'required', async (context) => {
    const player = players.requirePlayer(context.player);
    guard(rateLimiter.check('finishRun', player.id));
    const body = await context.readJson<unknown>();
    return { result: await runs.finish(player, context.params.runId ?? '', body) };
  });

  router.get('/leaderboard', 'optional', async (context) => {
    guard(rateLimiter.check('leaderboard', context.clientKey));
    const params = leaderboard.parseParams(context.url.searchParams);
    return leaderboard.get(params, context.player?.id ?? null);
  });

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = newRequestId();
    res.setHeader('x-request-id', requestId);
    applySecurityHeaders(res);

    const origin = req.headers.origin;
    if (typeof origin === 'string' && config.corsOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'content-type, authorization');
      res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('access-control-max-age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (!url.pathname.startsWith(API_BASE_PATH)) {
      sendError(res, requestId, notFound('Đường dẫn không tồn tại.'));
      return;
    }

    const routePath = url.pathname.slice(API_BASE_PATH.length) || '/';
    const matched = router.match(req.method ?? 'GET', routePath);

    if (matched === null) {
      const status = router.hasPath(routePath) ? 405 : 404;
      sendError(res, requestId, new HttpError(status, 'NOT_FOUND', 'Đường dẫn không tồn tại.'));
      return;
    }

    const context: RequestContext = {
      req,
      res,
      url,
      params: matched.params,
      requestId,
      clientKey: clientKeyFor(req, config.trustProxy),
      player: null,
      readJson: <T>() => readJsonBody<T>(req, config.bodyLimitBytes),
    };

    try {
      const auth = router.routeAuth(matched.route);
      if (auth !== 'none') {
        // The Authorization header is read here and never logged anywhere.
        context.player = await players.authenticate(readBearerToken(req.headers.authorization));
        if (auth === 'required' && context.player === null) {
          throw new HttpError(401, 'UNAUTHORIZED', 'Bạn cần tạo hồ sơ trước nhé!');
        }
      }

      const body = await matched.route.handler(context);
      if (res.writableEnded) return;
      sendJson(res, res.statusCode === 200 ? 200 : res.statusCode, body ?? {});
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(res, requestId, error);
        return;
      }
      // Unexpected failures are logged with an id but never echoed to a client.
      console.error(`[${requestId}] ${req.method ?? '?'} ${routePath} failed:`, error);
      sendError(
        res,
        requestId,
        new HttpError(500, 'INTERNAL_ERROR', 'Máy chủ gặp sự cố, bạn thử lại sau nhé!'),
      );
    }
  }

  const sweepTimer = setInterval(() => {
    rateLimiter.sweep();
  }, 60_000);
  sweepTimer.unref();

  return {
    server,
    repository,
    rateLimiter,
    close: async () => {
      clearInterval(sweepTimer);
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await repository.close();
    },
  };
}

function guard(allowed: boolean): void {
  if (!allowed) throw tooManyRequests();
}

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('cross-origin-resource-policy', 'same-site');
  res.setHeader('cache-control', 'no-store');
}

/** Coarse identity for IP-based limits. Never stored, only kept in memory. */
function clientKeyFor(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    if (first !== undefined && first.trim().length > 0) return first.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}
