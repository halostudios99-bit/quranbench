import { rootResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const perPage = Number(url.searchParams.get('per_page') ?? '50') || 50;
  return jsonResponse(
    req,
    rootResponse(
      decodeURIComponent(slug),
      page,
      Math.min(Math.max(perPage, 1), 200),
    ),
  );
}

export function OPTIONS(): Response {
  return corsPreflight();
}
