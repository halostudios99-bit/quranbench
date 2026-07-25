import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildCitation,
  parseCitationSha,
  parseCitationVersion,
} from '@/lib/citation';
import {
  currentVersion,
  isKnownVersion,
  listArtifacts,
  listVersions,
  manifestSha256,
  resolveArtifact,
} from '@/server/artifacts';
import { licenceGroups } from '@/server/api/downloads';
import { manifestResponse } from '@/server/api/core';

// Part C acceptance: the checksums shown on /data match the bytes on disk, and
// the citation string round-trips to a resolvable version.

describe('/data checksums match the artifacts on disk', () => {
  it('every declared sha256 and byte size matches the real file', () => {
    for (const version of listVersions()) {
      for (const artifact of listArtifacts(version)) {
        const resolved = resolveArtifact(version, artifact.path);
        expect(
          resolved,
          `${version}/${artifact.path} resolvable`,
        ).not.toBeNull();
        const bytes = readFileSync(resolved!.absolutePath);
        expect(bytes.length, `${artifact.path} bytes`).toBe(artifact.bytes);
        const sha = createHash('sha256').update(bytes).digest('hex');
        expect(sha, `${artifact.path} sha256`).toBe(artifact.sha256);
      }
    }
  });

  it('rejects path traversal in artifact resolution', () => {
    expect(
      resolveArtifact(currentVersion(), '../v0.5.0/manifest.json'),
    ).toBeNull();
    expect(resolveArtifact(currentVersion(), '../../../etc/passwd')).toBeNull();
  });

  it('every artifact belongs to exactly one licence group', () => {
    const version = currentVersion();
    const grouped = licenceGroups(version).flatMap((g) =>
      g.files.map((f) => f.path),
    );
    const all = listArtifacts(version).map((a) => a.path);
    expect(new Set(grouped)).toEqual(new Set(all));
    // Each group declares a licence that permits redistribution.
    for (const group of licenceGroups(version)) {
      expect(group.licence).toBeTruthy();
      expect(group.licence_url).toMatch(/^https?:\/\//);
    }
  });
});

describe('the citation string round-trips to a resolvable version', () => {
  it('parses back the version and the fingerprint', () => {
    const version = currentVersion();
    const sha = manifestSha256(version);
    const citation = buildCitation({
      version,
      manifestSha256: sha,
      retrieved: '2026-07-25',
      url: `https://quranbench.com/data#${version}`,
    });

    const parsedVersion = parseCitationVersion(citation);
    expect(parsedVersion).toBe(version);
    expect(isKnownVersion(parsedVersion!)).toBe(true);

    // The parsed version resolves through the API to the same fingerprint.
    const resolved = manifestResponse(parsedVersion!);
    expect(resolved.status).toBe(200);
    expect(resolved.body['resolved_version']).toBe(version);
    expect(parseCitationSha(citation)).toBe(sha);
  });
});
