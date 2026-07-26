import { NextResponse } from 'next/server';

import { wordHref } from '@/lib/addressing';
import { randomTokenId } from '@/server/corpus';

// /random redirects to a random word page — a way in for the curious, and a way to
// stumble onto the corpus. With ?seed=… the choice is deterministic (a pure hash of
// the seed), so a link is reproducible and the redirect is testable. Never cached:
// each unseeded request should land somewhere new.
export const dynamic = 'force-dynamic';

export function GET(request: Request): NextResponse {
  const seed = new URL(request.url).searchParams.get('seed');
  const id = randomTokenId(seed);
  if (!id) return new NextResponse('No words in the corpus', { status: 404 });
  return NextResponse.redirect(new URL(wordHref(id), request.url), 307);
}
