import { resolveResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  const ref = new URL(req.url).searchParams.get('ref') ?? '';
  return jsonResponse(req, resolveResponse(ref));
}

export function OPTIONS(): Response {
  return corsPreflight();
}
