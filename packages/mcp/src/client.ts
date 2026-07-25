// A minimal client for the quranbench public API. The MCP server is a thin
// wrapper over this API — not a separate integration — so everything an AI can
// reach here is exactly what a third party reaches over HTTP (docs/extensibility
// §6). The fetch implementation is injectable so tool handlers can be unit
// tested without a live server.

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export const DEFAULT_BASE_URL = 'https://quranbench.com/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ApiClientOptions = {}) {
    const envBase =
      typeof process !== 'undefined'
        ? process.env?.['QURANBENCH_API_BASE']
        : undefined;
    this.baseUrl = (options.baseUrl ?? envBase ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      '',
    );
    const injected = options.fetchImpl;
    if (injected) {
      this.fetchImpl = injected;
    } else if (typeof fetch === 'function') {
      this.fetchImpl = fetch as unknown as FetchLike;
    } else {
      throw new Error('no fetch implementation available; pass fetchImpl');
    }
  }

  /** GET a path (with a leading slash) and parse JSON, throwing on non-2xx. */
  async get(path: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      headers: { accept: 'application/json' },
    });
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const message =
        typeof body['message'] === 'string'
          ? body['message']
          : `request failed with status ${res.status}`;
      throw new ApiError(message, res.status, path);
    }
    return body;
  }
}

/** Build a query string from defined params only. */
export function query(
  params: Record<string, string | number | undefined>,
): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    );
  return parts.length ? `?${parts.join('&')}` : '';
}
