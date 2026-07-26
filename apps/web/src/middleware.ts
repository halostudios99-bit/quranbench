import { NextResponse, type NextRequest } from 'next/server';

// Two request-time concerns:
//
// 1. Content negotiation for corpus pages (docs/extensibility.md §5): a request
//    for a word, root, verse or surah page that prefers `application/ld+json` is
//    served machine-readable JSON-LD at the *same URL*.
//
// 2. CSRF token issuance: on the paths that render a state-changing form, ensure a
//    per-browser double-submit token exists (cookie + a request header the page
//    reads to embed it). Confined to those paths so public, cacheable corpus pages
//    are never given a Set-Cookie that would defeat shared caching.

const CORPUS_PATH = /^\/(?:word\/.+|root\/[^/]+|\d{1,3}(?:\/\d+(?:-\d+)?)?)$/;

// Paths whose responses render a form we protect (or receive its POST).
const CSRF_PATH =
  /^\/(?:signin|signup|signout|account|report|forgot-password|reset-password)(?:\/|$)/;

const CSRF_COOKIE = 'qb_csrf';
const CSRF_HEADER = 'x-qb-csrf';

function prefersJsonLd(accept: string | null): boolean {
  if (!accept) return false;
  const wantsLd = /application\/ld\+json/.test(accept);
  const wantsHtml = /text\/html/.test(accept);
  return wantsLd && !wantsHtml;
}

function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Resolve the CSRF token for this request when on a form path: reuse the cookie
  // if present, otherwise mint one to set on the response.
  const needsCsrf = CSRF_PATH.test(pathname);
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = needsCsrf ? (existing ?? newCsrfToken()) : undefined;

  const requestHeaders = new Headers(req.headers);
  if (token) requestHeaders.set(CSRF_HEADER, token);

  let res: NextResponse;
  if (prefersJsonLd(req.headers.get('accept')) && CORPUS_PATH.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/api/ld';
    url.searchParams.set('path', pathname);
    requestHeaders.set('x-qb-ld-path', pathname);
    res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    res = NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (token && !existing) {
    res.cookies.set(CSRF_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return res;
}

export const config = {
  // Skip Next internals, the API itself, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon|manifest|sw.js|.well-known).*)',
  ],
};
