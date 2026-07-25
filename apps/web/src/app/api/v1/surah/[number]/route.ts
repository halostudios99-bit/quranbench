import { surahResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n)) {
    return jsonResponse(req, {
      status: 400,
      body: {
        error: 'bad_request',
        message: `'${number}' is not a surah number`,
      },
    });
  }
  return jsonResponse(req, surahResponse(n));
}

export function OPTIONS(): Response {
  return corsPreflight();
}
