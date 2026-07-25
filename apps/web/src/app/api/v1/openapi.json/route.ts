import { buildOpenApi } from '@/server/api/openapi';
import { corsPreflight } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(JSON.stringify(buildOpenApi(), null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

export function OPTIONS(): Response {
  return corsPreflight();
}
