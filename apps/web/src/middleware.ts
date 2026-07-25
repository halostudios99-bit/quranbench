import { NextResponse, type NextRequest } from 'next/server';

// Content negotiation for corpus pages (docs/extensibility.md §5): a request for
// a word, root, verse or surah page that prefers `application/ld+json` is served
// machine-readable JSON-LD at the *same URL*. HTML remains the default; only an
// explicit ld+json preference is redirected to the JSON-LD renderer.

const CORPUS_PATH = /^\/(?:word\/.+|root\/[^/]+|\d{1,3}(?:\/\d+(?:-\d+)?)?)$/;

function prefersJsonLd(accept: string | null): boolean {
  if (!accept) return false;
  // Honour it only when ld+json is explicitly present and not dominated by HTML.
  const wantsLd = /application\/ld\+json/.test(accept);
  const wantsHtml = /text\/html/.test(accept);
  return wantsLd && !wantsHtml;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (prefersJsonLd(req.headers.get('accept')) && CORPUS_PATH.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/api/ld';
    url.searchParams.set('path', pathname);
    // Also carry the path on a request header: query params can be dropped
    // across a rewrite in some runtimes, headers survive.
    const headers = new Headers(req.headers);
    headers.set('x-qb-ld-path', pathname);
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, the API itself, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon|manifest|sw.js|.well-known).*)',
  ],
};
