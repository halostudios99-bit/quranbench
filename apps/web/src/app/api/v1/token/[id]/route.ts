import { tokenResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return jsonResponse(req, tokenResponse(decodeURIComponent(id)));
}

export function OPTIONS(): Response {
  return corsPreflight();
}
