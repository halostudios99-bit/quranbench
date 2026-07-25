// A citation names a version, never "the current site" (docs/extensibility.md
// §1, §4). This builds a copyable citation string that pins the corpus version
// and a dataset fingerprint, and parses the version back out so a reference can
// be resolved to a specific, immutable release. Pure — no I/O — so it is shared
// by the server page and the client copy button and is unit-testable.

export interface CitationInput {
  version: string;
  /** sha256 of manifest.json — the dataset fingerprint for this version. */
  manifestSha256: string;
  /** ISO date the citation was produced, e.g. 2026-07-25. */
  retrieved: string;
  /** Canonical dataset URL for the version. */
  url: string;
}

/**
 * Build a citation string. Example:
 * `quranbench (2026). Quran corpus, version 0.6.0 [Data set]. Retrieved
 *  2026-07-25 from https://quranbench.com/data#0.6.0. sha256(manifest.json)=ab12…`
 */
export function buildCitation(input: CitationInput): string {
  const year = input.retrieved.slice(0, 4);
  return (
    `quranbench (${year}). Quran corpus, version ${input.version} [Data set]. ` +
    `Retrieved ${input.retrieved} from ${input.url}. ` +
    `sha256(manifest.json)=${input.manifestSha256}.`
  );
}

const VERSION_RE = /version\s+(\d+\.\d+\.\d+)\b/;
const SHA_RE = /sha256\(manifest\.json\)=([0-9a-f]{64})/;

/** Extract the corpus version from a citation string, or null. */
export function parseCitationVersion(citation: string): string | null {
  return VERSION_RE.exec(citation)?.[1] ?? null;
}

/** Extract the manifest sha256 fingerprint from a citation string, or null. */
export function parseCitationSha(citation: string): string | null {
  return SHA_RE.exec(citation)?.[1] ?? null;
}
