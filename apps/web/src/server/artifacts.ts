import 'server-only';

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

import { DEFAULT_CORPUS_VERSION, type Manifest } from '@quranbench/corpus';

// Every published corpus version is an immutable directory on disk under
// packages/corpus-build/out/v<version>. This module is the one place that reads
// those directories for anything other than the loaded in-memory corpus: it
// backs the /data downloads, the manifest API for any version, and the
// third-party byte-verification promise. It performs no computation over the
// corpus — it only enumerates versions and serves raw artifact bytes.

/** Artifacts root: packages/corpus-build/out, two levels up from apps/web. */
export function artifactsRoot(): string {
  return resolve(process.cwd(), '..', '..', 'packages', 'corpus-build', 'out');
}

const VERSION_DIR_RE = /^v(\d+\.\d+\.\d+)$/;

/** Every published version present on disk, newest semver first. */
export function listVersions(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(artifactsRoot());
  } catch {
    return [];
  }
  const versions = entries
    .map((name) => VERSION_DIR_RE.exec(name)?.[1])
    .filter((v): v is string => v !== undefined);
  return versions.sort(compareSemverDesc);
}

function compareSemverDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The version served by the live in-memory corpus and API by default. */
export function currentVersion(): string {
  return DEFAULT_CORPUS_VERSION;
}

export function isKnownVersion(version: string): boolean {
  return listVersions().includes(version);
}

function versionDir(version: string): string {
  if (!VERSION_DIR_RE.test(`v${version}`)) {
    throw new Error(`invalid version '${version}'`);
  }
  return join(artifactsRoot(), `v${version}`);
}

/** Read and parse a version's manifest.json straight from disk (any version). */
export function readManifest(version: string): Manifest {
  const path = join(versionDir(version), 'manifest.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

/** sha256 of a version's manifest.json bytes — the dataset fingerprint. */
export function manifestSha256(version: string): string {
  const path = join(versionDir(version), 'manifest.json');
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export interface ArtifactFile {
  /** POSIX-relative path within the version dir, e.g. `morphology/roots.json`. */
  path: string;
  sha256: string;
  bytes: number;
}

/** Every artifact of a version, from the manifest checksum block, path-sorted. */
export function listArtifacts(version: string): ArtifactFile[] {
  const manifest = readManifest(version);
  return Object.entries(manifest.checksums)
    .map(([path, meta]) => ({ path, sha256: meta.sha256, bytes: meta.bytes }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export interface ResolvedArtifact {
  absolutePath: string;
  bytes: number;
}

/**
 * Resolve a version + relative artifact path to a file on disk, guaranteeing the
 * result stays inside the version directory (no path traversal) and is declared
 * in the manifest. Returns null if the version, path, or file is unknown.
 */
export function resolveArtifact(
  version: string,
  relPath: string,
): ResolvedArtifact | null {
  if (!isKnownVersion(version)) return null;
  const dir = versionDir(version);
  // Reject traversal before touching the filesystem: the normalised absolute
  // path must remain prefixed by the version dir.
  const target = normalize(join(dir, relPath));
  if (target !== dir && !target.startsWith(dir + sep)) return null;

  const declared = new Set(listArtifacts(version).map((a) => a.path));
  const rel = relPath.split(sep).join('/');
  if (rel !== 'manifest.json' && !declared.has(rel)) return null;

  try {
    const stat = statSync(target);
    if (!stat.isFile()) return null;
    return { absolutePath: target, bytes: stat.size };
  } catch {
    return null;
  }
}

/** Content-Type for an artifact by extension; downloads default to octet-stream. */
export function artifactContentType(relPath: string): string {
  if (relPath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (relPath.endsWith('.jsonl')) return 'application/x-ndjson; charset=utf-8';
  if (relPath.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}
