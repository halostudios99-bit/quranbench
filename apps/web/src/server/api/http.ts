import 'server-only';

import type { ApiResult } from './core';

// One place builds every API HTTP response so the contract — headers, CORS,
// caching, rate-limit disclosure — is uniform. The API is public, keyless and
// cross-origin readable (docs/extensibility.md §5).

/** Published, generous limit: requests per IP per rolling minute. */
export const RATE_LIMIT_PER_MINUTE = 600;
const WINDOW_MS = 60_000;

// Per-process sliding-window counter. Deliberately simple: the corpus is served
// from many stateless replicas behind a proxy, so this is a courtesy backstop,
// not a security control. The published limit is what third parties rely on.
const hits = new Map<string, number[]>();

interface RateState {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

function rateLimit(ip: string, nowMs: number): RateState {
  const cutoff = nowMs - WINDOW_MS;
  const times = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  const allowed = times.length < RATE_LIMIT_PER_MINUTE;
  if (allowed) times.push(nowMs);
  hits.set(ip, times);
  return {
    allowed,
    remaining: Math.max(0, RATE_LIMIT_PER_MINUTE - times.length),
    resetSeconds: Math.ceil(WINDOW_MS / 1000),
  };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

function baseHeaders(corpusVersion: unknown): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Accept, Content-Type',
    'x-ratelimit-limit': String(RATE_LIMIT_PER_MINUTE),
    // Public, cacheable reads; immutable corpus data revalidated weekly.
    'cache-control':
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  });
  if (typeof corpusVersion === 'string') {
    headers.set('x-corpus-version', corpusVersion);
  }
  return headers;
}

/** Serialise an ApiResult to a JSON Response, applying rate limiting. */
export function jsonResponse(req: Request, result: ApiResult): Response {
  const now = Date.now();
  const rate = rateLimit(clientIp(req), now);
  const headers = baseHeaders(result.body['corpus_version']);
  headers.set('x-ratelimit-remaining', String(rate.remaining));

  if (!rate.allowed) {
    headers.set('retry-after', String(rate.resetSeconds));
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: `Rate limit is ${RATE_LIMIT_PER_MINUTE} requests per minute. Retry shortly.`,
        limit_per_minute: RATE_LIMIT_PER_MINUTE,
      }),
      { status: 429, headers },
    );
  }

  return new Response(JSON.stringify(result.body, null, 2), {
    status: result.status,
    headers,
  });
}

/** Preflight / OPTIONS support for cross-origin browser clients. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: baseHeaders(undefined) });
}
