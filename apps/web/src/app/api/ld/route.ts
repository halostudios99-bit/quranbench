import { jsonLdForPath } from '@/server/api/jsonld';

export const dynamic = 'force-dynamic';

// Content-negotiation target. `middleware.ts` rewrites a corpus page request
// that prefers `application/ld+json` here, preserving the original path in the
// `path` query parameter. Same URL, machine-readable body.
export function GET(req: Request): Response {
  const path =
    req.headers.get('x-qb-ld-path') ??
    new URL(req.url).searchParams.get('path') ??
    '/';
  const data = jsonLdForPath(path);
  if (!data) {
    return new Response(
      JSON.stringify({
        error: 'not_found',
        message: `no JSON-LD for '${path}'`,
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/ld+json; charset=utf-8' },
      },
    );
  }
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/ld+json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      vary: 'Accept',
    },
  });
}
