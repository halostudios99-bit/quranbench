import { rootIndexResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  return jsonResponse(req, rootIndexResponse());
}

export function OPTIONS(): Response {
  return corsPreflight();
}
