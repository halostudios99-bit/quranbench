import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildCitation,
  parseCitationSha,
  parseCitationVersion,
} from '@/lib/citation';
import {
  artifactsRoot,
  currentVersion,
  displayOnlyEditions,
  fullTarball,
  isKnownVersion,
  listArtifacts,
  listVersions,
  manifestSha256,
  nonRedistributablePaths,
  resolveArtifact,
} from '@/server/artifacts';
import { fullDownload, licenceGroups } from '@/server/api/downloads';
import { manifestResponse } from '@/server/api/core';

// Part C acceptance: the checksums shown on /data match the bytes on disk, and
// the citation string round-trips to a resolvable version.

describe('/data checksums match the artifacts on disk', () => {
  it('every declared sha256 and byte size matches the real file', () => {
    for (const version of listVersions()) {
      const excluded = nonRedistributablePaths(version);
      for (const artifact of listArtifacts(version)) {
        const absolute = join(artifactsRoot(), `v${version}`, artifact.path);

        // Non-redistributable editions are gitignored and fetched at build time,
        // so a clean checkout does not have them on disk. Their checksum cannot
        // be verified where the file was never fetched — but the download route
        // must still refuse them, which is the security-relevant half and is
        // asserted below regardless.
        if (excluded.has(artifact.path) && !existsSync(absolute)) {
          expect(
            resolveArtifact(version, artifact.path),
            `${artifact.path} must not be downloadable`,
          ).toBeNull();
          continue;
        }

        // Every declared artifact exists on disk with the recorded bytes — even a
        // display-only edition, which is served to readers and checksummed.
        const bytes = readFileSync(absolute);
        expect(bytes.length, `${artifact.path} bytes`).toBe(artifact.bytes);
        const sha = createHash('sha256').update(bytes).digest('hex');
        expect(sha, `${artifact.path} sha256`).toBe(artifact.sha256);

        // A redistributable artifact resolves through the download route; a
        // display-only one is deliberately refused there.
        const resolved = resolveArtifact(version, artifact.path);
        if (excluded.has(artifact.path)) {
          expect(resolved, `${artifact.path} must not be downloadable`).toBeNull();
        } else {
          expect(resolved, `${artifact.path} resolvable`).not.toBeNull();
        }
      }
    }
  });

  it('refuses to serve a display-only edition through the download route', () => {
    const version = currentVersion();
    const displayOnly = displayOnlyEditions(version);
    expect(displayOnly.length, 'v0.7.0 ships a display-only Itani edition').toBeGreaterThan(0);
    for (const e of displayOnly) {
      // The edition is a declared, checksummed artifact...
      expect(
        listArtifacts(version).some((a) => a.path === e.artifact),
        `${e.artifact} declared`,
      ).toBe(true);
      // ...yet the download route refuses both its data and its licence file.
      expect(resolveArtifact(version, e.artifact)).toBeNull();
      expect(resolveArtifact(version, e.licence_file)).toBeNull();
    }
  });

  it('rejects path traversal in artifact resolution', () => {
    expect(
      resolveArtifact(currentVersion(), '../v0.5.0/manifest.json'),
    ).toBeNull();
    expect(resolveArtifact(currentVersion(), '../../../etc/passwd')).toBeNull();
  });

  it('every downloadable artifact belongs to exactly one licence group', () => {
    const version = currentVersion();
    const grouped = licenceGroups(version).flatMap((g) =>
      g.files.map((f) => f.path),
    );
    // The downloadable set is every declared artifact minus the display-only ones.
    const excluded = nonRedistributablePaths(version);
    const downloadable = listArtifacts(version)
      .map((a) => a.path)
      .filter((p) => !excluded.has(p));
    expect(new Set(grouped)).toEqual(new Set(downloadable));
    // Each group declares a licence that permits redistribution.
    for (const group of licenceGroups(version)) {
      expect(group.licence).toBeTruthy();
      expect(group.licence_url).toMatch(/^https?:\/\//);
    }
  });
});

describe('every version offers a full-dataset tarball with a matching checksum', () => {
  it('the tarball is resolvable and its sha256 matches the bytes on disk', () => {
    for (const version of listVersions()) {
      const tarball = fullTarball(version);
      expect(tarball, `${version} full tarball`).not.toBeNull();

      // The tarball is served through the same download route as any artifact,
      // even though it is not listed in the manifest checksum block.
      const resolved = resolveArtifact(version, tarball!.path);
      expect(resolved, `${version} tarball resolvable`).not.toBeNull();

      const bytes = readFileSync(resolved!.absolutePath);
      expect(bytes.length, `${version} tarball size`).toBe(tarball!.bytes);
      const sha = createHash('sha256').update(bytes).digest('hex');
      expect(sha, `${version} tarball sha256`).toBe(tarball!.sha256);
    }
  });

  it('is offered on /data as a GPL whole with a download href', () => {
    const version = currentVersion();
    const full = fullDownload(version);
    expect(full).not.toBeNull();
    expect(full!.filename).toBe(`quranbench-corpus-v${version}.tar.gz`);
    expect(full!.href).toBe(
      `/api/v1/download/${version}/quranbench-corpus-v${version}.tar.gz`,
    );
    // The aggregate carries the GPL of the embedded Leeds morphology.
    expect(full!.licence).toMatch(/GPL/);
    expect(full!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(full!.bytes).toBeGreaterThan(0);
  });

  it('the tarball is not double-counted as a per-file artifact', () => {
    const version = currentVersion();
    const paths = listArtifacts(version).map((a) => a.path);
    expect(paths).not.toContain(`quranbench-corpus-v${version}.tar.gz`);
    expect(paths).not.toContain(`quranbench-corpus-v${version}.tar.gz.sha256`);
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
