import { searchResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const perPage = Number(url.searchParams.get('per_page') ?? '50') || 50;
  const basmalaParam = url.searchParams.get('basmala');
  const includeBasmala =
    basmalaParam === null
      ? undefined
      : basmalaParam === '1' || basmalaParam === 'true';
  return jsonResponse(
    req,
    searchResponse(q, { page, perPage, includeBasmala }),
  );
}

export function OPTIONS(): Response {
  return corsPreflight();
}
