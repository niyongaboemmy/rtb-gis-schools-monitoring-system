import { Injectable, Logger } from '@nestjs/common';
import { TdmpConfig } from './tdmp.config';
import type { TdmpListMeta } from './tdmp.types';

export type Query = Record<string, string | number | boolean | undefined>;

/** TDMP answered, but refused the request (4xx other than 429). */
export class TdmpRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    path: string,
  ) {
    super(`TDMP ${path} answered ${status}`);
  }
}

/** TDMP could not be reached, timed out, or kept failing (5xx / 429). */
export class TdmpUnavailableError extends Error {}

const RETRY_DELAYS_MS = [500, 1500];
const MAX_RETRY_AFTER_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One page of a TDMP list endpoint (`{ data, meta: { page } }`). */
export interface TdmpPage<T> {
  data: T[];
  meta?: TdmpListMeta;
}

/** What one endpoint answered, for the connection check. */
export interface TdmpEndpointCheck {
  /** HTTP status, or 0 when TDMP could not be reached. */
  status: number;
  ms: number;
  body: unknown;
}

/**
 * HTTP client for the TDMP data API. Uses the partner API key unless a user
 * access token is given (the `/auth/me/*` routes).
 */
@Injectable()
export class TdmpApiClient {
  private readonly logger = new Logger(TdmpApiClient.name);

  constructor(private readonly config: TdmpConfig) {}

  url(path: string, query?: Query): string {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    return url.toString();
  }

  /** GET JSON. `bearer` switches from the API key to a user's token. */
  async get<T>(path: string, query?: Query, bearer?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    else if (this.config.apiKeyHeader === 'x-api-key')
      headers['X-API-Key'] = this.config.apiKey;
    else headers.Authorization = `ApiKey ${this.config.apiKey}`;
    return this.request<T>(path, { method: 'GET', headers }, query);
  }

  /** Sends a request with timeout and retries on network errors, 429 and 5xx. */
  async request<T>(path: string, init: RequestInit, query?: Query): Promise<T> {
    const url = this.url(path, query);
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
      } catch (err) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new TdmpUnavailableError(
          `TDMP ${path} unreachable: ${(err as Error).message}`,
        );
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < RETRY_DELAYS_MS.length) {
          const retryAfter = Number(res.headers.get('retry-after')) * 1000;
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, MAX_RETRY_AFTER_MS)
              : RETRY_DELAYS_MS[attempt],
          );
          continue;
        }
        throw new TdmpUnavailableError(`TDMP ${path} answered ${res.status}`);
      }

      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok) throw new TdmpRequestError(res.status, body, path);
      return body as T;
    }
  }

  /** One page of a list endpoint, with its `meta`. */
  page<T>(path: string, query: Query = {}): Promise<TdmpPage<T>> {
    return this.get<TdmpPage<T>>(path, query);
  }

  /**
   * GET an endpoint once and report its status instead of throwing (403 = TDMP
   * has not granted us that data yet). No retries: this is a quick check.
   */
  async check(path: string, query?: Query): Promise<TdmpEndpointCheck> {
    const started = Date.now();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.apiKeyHeader === 'x-api-key')
      headers['X-API-Key'] = this.config.apiKey;
    else headers.Authorization = `ApiKey ${this.config.apiKey}`;
    try {
      const res = await fetch(this.url(path, query), {
        headers,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      return { status: res.status, ms: Date.now() - started, body };
    } catch {
      return { status: 0, ms: Date.now() - started, body: null };
    }
  }

  /** Walks every page of a list endpoint. */
  async *paginate<T>(path: string, query: Query = {}): AsyncGenerator<T> {
    const limit = this.config.pageSize;
    for (let page = 1; ; page++) {
      const res = await this.get<TdmpPage<T>>(path, { ...query, page, limit });
      const rows = Array.isArray(res?.data) ? res.data : [];
      for (const row of rows) yield row;
      const total = res?.meta?.page?.total;
      const seen = (page - 1) * limit + rows.length;
      if (!rows.length || rows.length < limit) return;
      if (typeof total === 'number' && seen >= total) return;
      if (page >= 10_000) {
        this.logger.warn(`Stopped paging ${path} after ${page} pages`);
        return;
      }
    }
  }

  /** `meta.page.total` of a filtered list, read with a 1-row page. */
  async count(path: string, query: Query): Promise<number | null> {
    const res = await this.get<TdmpPage<unknown>>(path, {
      ...query,
      page: 1,
      limit: 1,
    });
    const total = res?.meta?.page?.total;
    return typeof total === 'number' ? total : null;
  }
}
