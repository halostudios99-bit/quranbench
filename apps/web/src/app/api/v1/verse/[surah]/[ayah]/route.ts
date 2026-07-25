import { verseResponse } from '@/server/api/core';
import { corsPreflight, jsonResponse } from '@/server/api/http';
import { parseAyahParam } from '@/lib/addressing';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ surah: string; ayah: string }> },
): Promise<Response> {
  const { surah, ayah } = await params;
  const n = Number(surah);
  const range = parseAyahParam(ayah);
  if (!Number.isInteger(n) || !range) {
    return jsonResponse(req, {
      status: 400,
      body: {
        error: 'bad_request',
        message: `'${surah}/${ayah}' is not a verse or range (expected e.g. 2/255 or 2/1-5)`,
      },
    });
  }
  return jsonResponse(req, verseResponse(n, range.from, range.to));
}

export function OPTIONS(): Response {
  return corsPreflight();
}
