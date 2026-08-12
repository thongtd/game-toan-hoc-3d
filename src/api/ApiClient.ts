import { API_BASE_PATH } from '../../shared/contracts/api.ts';
import type { ApiErrorBody, ApiErrorCode } from '../../shared/contracts/api.ts';

/**
 * Thin fetch wrapper for the game API.
 *
 * Attaches the player token, enforces a timeout and turns every failure into a
 * typed `ApiRequestError`, so screens can react to a specific code instead of
 * parsing messages.
 */

const DEFAULT_TIMEOUT_MS = 9000;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT',
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** True when the token is gone or no longer valid. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the server could not be reached at all. */
  get isOffline(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Called whenever the server rejects the current token. */
  onUnauthorized?: () => void;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Send the player token when one is available. */
  auth?: 'required' | 'optional' | 'none';
  /** Retry once on a network hiccup. Only ever used for idempotent reads. */
  retry?: boolean;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private token: string | null = null;

  constructor(private readonly options: ApiClientOptions = {}) {
    const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
    this.baseUrl = (options.baseUrl ?? configured ?? API_BASE_PATH).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  get hasToken(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await this.send<T>(path, options);
    } catch (error) {
      const canRetry =
        options.retry === true && error instanceof ApiRequestError && error.isOffline;
      if (!canRetry) throw error;

      await new Promise((resolve) => setTimeout(resolve, 400));
      return this.send<T>(path, options);
    }
  }

  private async send<T>(path: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.auth !== 'none' && this.token !== null) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal,
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      throw new ApiRequestError(
        0,
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        'Chưa kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé!',
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const payload: unknown = text.length === 0 ? null : safeParse(text);

    if (!response.ok) {
      const body = payload as ApiErrorBody | null;
      const error = body?.error;
      if (response.status === 401) {
        this.options.onUnauthorized?.();
      }
      throw new ApiRequestError(
        response.status,
        error?.code ?? 'INTERNAL_ERROR',
        error?.message ?? 'Máy chủ gặp sự cố, bạn thử lại sau nhé!',
        error?.field,
      );
    }

    return payload as T;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
