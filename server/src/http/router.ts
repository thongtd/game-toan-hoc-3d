import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiErrorBody } from '../../../shared/contracts/api.ts';
import { HttpError, payloadTooLarge, unsupportedMediaType } from './errors.ts';
import type { PlayerRecord } from '../domain/records.ts';

/**
 * A very small router over `node:http`.
 *
 * The API has nine endpoints and needs JSON parsing, CORS, a body limit and
 * consistent errors - which is a few dozen lines. Hand-rolling it keeps the
 * server's dependency list empty, which matters for software aimed at children.
 */

export type Method = 'GET' | 'POST' | 'PATCH' | 'OPTIONS';

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  requestId: string;
  clientKey: string;
  /** Set by the auth middleware when a valid bearer token was supplied. */
  player: PlayerRecord | null;
  readJson: <T>() => Promise<T>;
}

export type Handler = (context: RequestContext) => unknown;

interface Route {
  method: Method;
  /** Path pattern with `:name` segments, relative to the API base path. */
  pattern: string;
  segments: string[];
  handler: Handler;
  /** Requires a valid player token. */
  auth: 'required' | 'optional' | 'none';
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: Method, pattern: string, auth: Route['auth'], handler: Handler): this {
    this.routes.push({
      method,
      pattern,
      segments: pattern.split('/').filter((segment) => segment.length > 0),
      handler,
      auth,
    });
    return this;
  }

  get(pattern: string, auth: Route['auth'], handler: Handler): this {
    return this.add('GET', pattern, auth, handler);
  }

  post(pattern: string, auth: Route['auth'], handler: Handler): this {
    return this.add('POST', pattern, auth, handler);
  }

  patch(pattern: string, auth: Route['auth'], handler: Handler): this {
    return this.add('PATCH', pattern, auth, handler);
  }

  /** Finds the route for a method and path, extracting `:name` parameters. */
  match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const parts = pathname.split('/').filter((segment) => segment.length > 0);

    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;

      const params: Record<string, string> = {};
      let matched = true;

      for (const [index, segment] of route.segments.entries()) {
        const actual = parts[index] ?? '';
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(actual);
          continue;
        }
        if (segment !== actual) {
          matched = false;
          break;
        }
      }

      if (matched) return { route, params };
    }

    return null;
  }

  /** Paths registered for any method; used to answer 405 vs 404 correctly. */
  hasPath(pathname: string): boolean {
    const parts = pathname.split('/').filter((segment) => segment.length > 0);
    return this.routes.some(
      (route) =>
        route.segments.length === parts.length &&
        route.segments.every(
          (segment, index) => segment.startsWith(':') || segment === (parts[index] ?? ''),
        ),
    );
  }

  routeAuth(route: Route): Route['auth'] {
    return route.auth;
  }
}

/** Reads and parses a JSON body, enforcing the content type and size limit. */
export async function readJsonBody<T>(req: IncomingMessage, limitBytes: number): Promise<T> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw unsupportedMediaType();
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > limitBytes) {
      throw payloadTooLarge();
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ.');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload).toString(),
  });
  res.end(payload);
}

export function sendError(res: ServerResponse, requestId: string, error: HttpError): void {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.field === undefined ? {} : { field: error.field }),
    },
  };
  sendJson(res, error.status, body);
}
