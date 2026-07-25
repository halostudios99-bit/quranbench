import { manifestResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  const version = new URL(req.url).searchParams.get('version') ?? undefined;
  return jsonResponse(req, manifestResponse(version));
}

export function OPTIONS(): Response {
  return corsPreflight();
}
