import 'server-only';

import {
  fullTarball,
  fullTarballName,
  listArtifacts,
  nonRedistributablePaths,
  type ArtifactFile,
} from '@/server/artifacts';

// Per-licence separation of the dataset (Part C): a downloader must be able to
// take only the parts they can legally use. The Quran text is CC-BY (Tanzil);
// the morphology is GPL (Leeds), and copyleft propagates to any file that
// embeds it; translations are separate public-domain editions. This is the one
// place that maps an artifact path to the licence group it belongs to.

export type LicenceGroupId = 'text' | 'morphology' | 'translations';

export interface LicenceGroup {
  id: LicenceGroupId;
  title: string;
  licence: string;
  licence_url: string;
  note: string;
  files: ArtifactFile[];
  total_bytes: number;
}

function groupIdFor(path: string): LicenceGroupId {
  if (path.startsWith('translations/')) return 'translations';
  // tokens.jsonl embeds the Leeds morphology annotation, so the combined file is
  // distributed under the copyleft licence — not CC-BY.
  if (path.startsWith('morphology/') || path === 'tokens.jsonl')
    return 'morphology';
  return 'text';
}

const GROUP_META: Record<
  LicenceGroupId,
  Omit<LicenceGroup, 'files' | 'total_bytes'>
> = {
  text: {
    id: 'text',
    title: 'Quran text & structure',
    licence: 'CC-BY-3.0',
    licence_url: 'https://tanzil.net/docs/download',
    note: 'Uthmani text from the Tanzil Project, plus verse rows, surah metadata, numbering schemes, identifier mappings and the build manifest. Take this if you only want the Quran text under CC-BY. Full verse text lives in verses.jsonl.',
  },
  morphology: {
    id: 'morphology',
    title: 'Morphology',
    licence: 'GPL-2.0-or-later',
    licence_url: 'https://opensource.org/license/gpl-2-0',
    note: 'Root, lemma, part-of-speech and segment annotation from the Leeds Quranic Arabic Corpus. tokens.jsonl combines the Quran text with this annotation, so the combined file is GPL. If you cannot accept copyleft, use verses.jsonl from the text group instead.',
  },
  translations: {
    id: 'translations',
    title: 'Translations',
    licence: 'Public domain (per edition)',
    licence_url: 'https://quranbench.com/method',
    note: 'Verse-level human translation editions in the public domain — the ones you may redistribute. Correspondence to the Arabic is verse-level only, never word-level. Each edition ships its own LICENSE file. Display-only editions (shown on the site under a licence that permits display but not redistribution, e.g. Talal Itani under CC BY-NC-ND) are deliberately excluded from these downloads and from the full tarball; they are listed below with the reason.',
  },
};

/** The artifacts of a version, grouped by licence, path-sorted within a group. */
export function licenceGroups(version: string): LicenceGroup[] {
  const buckets: Record<LicenceGroupId, ArtifactFile[]> = {
    text: [],
    morphology: [],
    translations: [],
  };
  // Display-only editions are on disk (served to readers) but not redistributable,
  // so they never appear in the downloads — the same rule the tarball applies.
  const excluded = nonRedistributablePaths(version);
  for (const file of listArtifacts(version)) {
    if (excluded.has(file.path)) continue;
    buckets[groupIdFor(file.path)].push(file);
  }

  const order: LicenceGroupId[] = ['text', 'morphology', 'translations'];
  return order
    .map((id) => ({
      ...GROUP_META[id],
      files: buckets[id],
      total_bytes: buckets[id].reduce((sum, f) => sum + f.bytes, 0),
    }))
    .filter((g) => g.files.length > 0);
}

export interface FullDownload {
  filename: string;
  href: string;
  sha256: string;
  bytes: number;
  licence: string;
  licence_url: string;
  note: string;
}

/**
 * The full-dataset tarball offering for a version, or null if it was not built.
 * The whole archive is GPL: it embeds tokens.jsonl and morphology/ (the Leeds
 * QAC), whose copyleft propagates to the aggregate — the same rule downloads.ts
 * applies to the individual GPL files above.
 */
export function fullDownload(version: string): FullDownload | null {
  const tarball = fullTarball(version);
  if (!tarball) return null;
  const morphology = GROUP_META.morphology;
  return {
    filename: fullTarballName(version),
    href: downloadHref(version, tarball.path),
    sha256: tarball.sha256,
    bytes: tarball.bytes,
    licence: morphology.licence,
    licence_url: morphology.licence_url,
    note: 'The complete artifact set for this version in a single archive: text, morphology, translations, numbering, mappings and the manifest. Because it embeds the GPL Leeds morphology (tokens.jsonl and morphology/), the tarball as a whole is GPL-2.0-or-later. Verify it against the published sha256 before use. For CC-BY-only text, take the per-file text group instead.',
  };
}

export function downloadHref(version: string, path: string): string {
  return `/api/v1/download/${version}/${path}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
