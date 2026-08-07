import { NextRequest, NextResponse } from 'next/server';

import { suggest } from '@/server/suggest';

// Autosuggest for the search box. Internal to the site UI, deliberately NOT
// part of /api/v1: it has no stability promise, no OpenAPI entry, and may
// change shape whenever the dropdown does. The corpus is immutable per deploy,
// so responses are cacheable — Cloudflare takes most of the keystroke load.

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest): NextResponse {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  return NextResponse.json(
    { suggestions: suggest(q) },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
