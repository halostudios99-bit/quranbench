import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { artifactContentType, resolveArtifact } from '@/server/artifacts';

export const dynamic = 'force-dynamic';

// Raw artifact download. Streams a version's file byte-for-byte so a third party
// can verify the published sha256 against what they receive (docs/extensibility
// §6, and the /data verification procedure). Path traversal is rejected in
// resolveArtifact — only files declared in the manifest are served.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ version: string; path: string[] }> },
): Promise<Response> {
  const { version, path } = await params;
  const relPath = path.map((p) => decodeURIComponent(p)).join('/');
  const resolved = resolveArtifact(version, relPath);
  if (!resolved) {
    return new Response(
      JSON.stringify({
        error: 'not_found',
        message: `no artifact '${relPath}' in v${version}`,
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }

  const nodeStream = createReadStream(resolved.absolutePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filename = relPath.split('/').pop() ?? 'artifact';
  return new Response(webStream, {
    status: 200,
    headers: {
      'content-type': artifactContentType(relPath),
      'content-length': String(resolved.bytes),
      'content-disposition': `attachment; filename="${filename}"`,
      'access-control-allow-origin': '*',
      // Immutable: a published version's bytes never change.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-corpus-version': version,
    },
  });
}
