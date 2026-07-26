import { NextResponse } from 'next/server';

import { getCorpus } from '@/server/corpus';

// Container health check. Healthy means the process is up and the in-memory corpus
// — the thing that makes every public page work — has loaded. The database is not
// required for health: public pages degrade gracefully without it, so a DB blip
// must not take the whole container out of the load balancer. The corpus version
// is reported so a deploy can be confirmed to be serving the expected data.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const corpus = getCorpus();
    return NextResponse.json(
      {
        status: 'ok',
        corpus_version: corpus.version,
        tokens: corpus.tokens.length,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'error' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
