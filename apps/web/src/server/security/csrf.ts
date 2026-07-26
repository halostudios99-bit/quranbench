import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import { cookies, headers } from 'next/headers';

// CSRF defence for state-changing requests, layered on top of the SameSite=lax
// session and CSRF cookies. The pattern is double-submit: a random token is set
// as a cookie (in middleware.ts) and echoed in a hidden form field; a forged
// cross-site POST cannot read the cookie to reproduce the field, so it is
// rejected. Route handlers additionally check the Origin header. Next.js already
// enforces an Origin check on Server Actions; this adds the double-submit token so
// every enumerated write — sign-in, sign-up, sign-out, account, report, password
// reset — is covered by both.

export const CSRF_COOKIE = 'qb_csrf';
export const CSRF_FIELD = 'csrf';
export const CSRF_HEADER = 'x-qb-csrf';

// ─── Pure helpers (unit-tested without a request context) ─────────────────────

/** Constant-time token comparison. Both must be present and equal length. */
export function tokensMatch(
  submitted: unknown,
  cookie: string | undefined,
): boolean {
  if (typeof submitted !== 'string' || !cookie) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(cookie);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Whether a request's Origin is same-origin. An absent Origin is allowed (some
 * legitimate same-origin no-JS posts omit it) — the double-submit token is the
 * primary control; a present cross-site Origin is rejected.
 */
export function originAllowed(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ─── Request-bound wrappers ───────────────────────────────────────────────────

/** The token to embed in a form on this render. Prefers the header the middleware
 *  set (present even on a first visit, before the cookie has round-tripped). */
export async function csrfToken(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get(CSRF_HEADER);
  if (fromHeader) return fromHeader;
  return (await cookies()).get(CSRF_COOKIE)?.value ?? '';
}

/** Verify a Server Action submission's token against the cookie. */
export async function verifyCsrf(form: FormData): Promise<boolean> {
  const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
  return tokensMatch(form.get(CSRF_FIELD), cookie);
}

/** Verify a route-handler POST: double-submit token and same-origin. */
export async function verifyCsrfRequest(
  request: Request,
  form: FormData,
): Promise<boolean> {
  const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
  if (!tokensMatch(form.get(CSRF_FIELD), cookie)) return false;
  return originAllowed(
    request.headers.get('origin'),
    request.headers.get('host'),
  );
}
