import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  Corpus,
  LaneEntry,
  LoadedTranslation,
  Manifest,
  NumberingScheme,
  Root,
  Segment,
  Source,
  Surah,
  Token,
} from './types.js';

export const DEFAULT_CORPUS_VERSION = '0.8.0';

/**
 * Thrown when an artifact fails validation. A corrupted or schema-drifted corpus
 * must never load silently — the invariant the rest of the system relies on is
 * that if `loadCorpus` returns, the corpus matched its manifest exactly.
 */
export class CorpusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorpusValidationError';
  }
}

function fail(message: string): never {
  throw new CorpusValidationError(message);
}

/** Default artifacts root: packages/corpus-build/out, resolved from this module. */
function defaultRoot(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return join(here, '..', '..', 'corpus-build', 'out');
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    fail(`cannot read artifact '${path}': ${(cause as Error).message}`);
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseJson(path: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    fail(`artifact '${path}' is not valid JSON: ${(cause as Error).message}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireKeys(
  where: string,
  obj: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (!(key in obj)) fail(`${where}: missing required field '${key}'`);
  }
}

const TOKEN_KEYS = [
  'id',
  'segment_id',
  'surah',
  'slot',
  'position',
  'text_uthmani',
  'text_simple',
  'text_no_tashkeel',
  'text_normalised',
  'char_start',
  'char_end',
  'following_marks',
  'is_basmala',
  'morphology',
] as const;

const ROOT_KEYS = [
  'root',
  'root_slug',
  'lemmas',
  'occurrences',
  'token_ids',
] as const;

const SEGMENT_KEYS = [
  'id',
  'work_id',
  'source_id',
  'surah',
  'slot',
  'ordinals',
  'text_uthmani',
  'text_simple',
  'text_no_tashkeel',
  'text_normalised',
  'leading_marks',
] as const;

const SURAH_KEYS = [
  'id',
  'number',
  'name_ar',
  'name_translit',
  'name_en',
  'revelation_place',
  'revelation_order',
  'verse_count',
  'basmala',
  'source_id',
] as const;

const SOURCE_KEYS = [
  'id',
  'name',
  'publisher',
  'edition',
  'year',
  'url',
  'licence',
  'role',
  'sha256',
] as const;

function parseJsonl(path: string, text: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (cause) {
      fail(
        `artifact '${path}' line ${i + 1}: invalid JSON: ${(cause as Error).message}`,
      );
    }
    if (!isObject(parsed))
      fail(`artifact '${path}' line ${i + 1}: expected an object`);
    rows.push(parsed);
  }
  return rows;
}

function validateManifest(
  path: string,
  raw: unknown,
  expectedVersion: string,
): Manifest {
  if (!isObject(raw)) fail(`${path}: manifest must be an object`);
  requireKeys(path, raw, [
    'corpus_version',
    'counts',
    'numbering',
    'segmentation_scheme',
  ]);

  const version = raw['corpus_version'];
  if (version !== expectedVersion) {
    fail(
      `${path}: manifest corpus_version '${String(version)}' does not match requested version '${expectedVersion}'`,
    );
  }

  const counts = raw['counts'];
  if (!isObject(counts)) fail(`${path}: counts must be an object`);
  for (const key of ['surahs', 'verses', 'tokens'] as const) {
    if (typeof counts[key] !== 'number')
      fail(`${path}: counts.${key} must be a number`);
  }

  const numbering = raw['numbering'];
  if (!isObject(numbering)) fail(`${path}: numbering must be an object`);
  if (typeof numbering['active'] !== 'string')
    fail(`${path}: numbering.active must be a string`);
  if (!Array.isArray(numbering['available']))
    fail(`${path}: numbering.available must be an array`);

  // Checked after the version guard so a version mismatch is still reported as
  // such rather than as a missing checksums block.
  const checksums = raw['checksums'];
  if (!isObject(checksums))
    fail(`${path}: manifest.checksums must be an object`);

  return raw as unknown as Manifest;
}

/**
 * Read and validate corpus artifacts for `version` from disk, returning typed
 * in-memory structures. Fails loudly — throws {@link CorpusValidationError} — on
 * schema drift or a count that disagrees with the manifest, so a corrupted
 * corpus can never load silently.
 */
export function loadCorpus(
  version: string = DEFAULT_CORPUS_VERSION,
  options: { root?: string } = {},
): Corpus {
  const root = options.root ?? defaultRoot();
  const dir = join(root, `v${version}`);

  const paths = {
    manifest: join(dir, 'manifest.json'),
    sources: join(dir, 'sources.json'),
    surahs: join(dir, 'surahs.json'),
    verses: join(dir, 'verses.jsonl'),
    tokens: join(dir, 'tokens.jsonl'),
  };

  const manifestText = readText(paths.manifest);
  const manifest = validateManifest(
    paths.manifest,
    parseJson(paths.manifest, manifestText),
    version,
  );

  // Byte-level verification: every artifact must match the sha256 and size the
  // manifest records for it. Structural checks below run in addition — this
  // guards against a corpus whose shape is fine but whose bytes were tampered
  // with. The manifest cannot checksum itself, so it is excluded.
  const expectedChecksums = manifest.checksums;
  function verifyBytes(relKey: string, text: string): void {
    const expected = expectedChecksums[relKey];
    if (!expected)
      fail(`manifest has no checksum entry for artifact '${relKey}'`);
    const actualSha = sha256(text);
    if (actualSha !== expected.sha256) {
      fail(
        `artifact '${relKey}' failed checksum: manifest sha256 ${expected.sha256}, file ${actualSha}`,
      );
    }
    const actualBytes = Buffer.byteLength(text, 'utf8');
    if (actualBytes !== expected.bytes) {
      fail(
        `artifact '${relKey}' size mismatch: manifest ${expected.bytes} bytes, file ${actualBytes} bytes`,
      );
    }
  }

  const checksums: Record<string, string> = {
    'manifest.json': sha256(manifestText),
  };

  const sourcesText = readText(paths.sources);
  verifyBytes('sources.json', sourcesText);
  checksums['sources.json'] = sha256(sourcesText);
  const sourcesRaw = parseJson(paths.sources, sourcesText);
  if (!Array.isArray(sourcesRaw)) fail(`${paths.sources}: expected an array`);
  const sources: Source[] = sourcesRaw.map((row, i) => {
    if (!isObject(row)) fail(`${paths.sources}[${i}]: expected an object`);
    requireKeys(`${paths.sources}[${i}]`, row, SOURCE_KEYS);
    return row as unknown as Source;
  });

  const surahsText = readText(paths.surahs);
  verifyBytes('surahs.json', surahsText);
  checksums['surahs.json'] = sha256(surahsText);
  const surahsRaw = parseJson(paths.surahs, surahsText);
  if (!Array.isArray(surahsRaw)) fail(`${paths.surahs}: expected an array`);
  const surahs: Surah[] = surahsRaw.map((row, i) => {
    if (!isObject(row)) fail(`${paths.surahs}[${i}]: expected an object`);
    requireKeys(`${paths.surahs}[${i}]`, row, SURAH_KEYS);
    return row as unknown as Surah;
  });

  const numbering = new Map<string, NumberingScheme>();
  for (const id of manifest.numbering.available) {
    const numPath = join(dir, 'numbering', `${id}.json`);
    const numText = readText(numPath);
    verifyBytes(`numbering/${id}.json`, numText);
    checksums[`numbering/${id}.json`] = sha256(numText);
    const numRaw = parseJson(numPath, numText);
    if (!isObject(numRaw)) fail(`${numPath}: expected an object`);
    requireKeys(numPath, numRaw, ['id', 'name', 'rules']);
    numbering.set(id, numRaw as unknown as NumberingScheme);
  }

  const versesText = readText(paths.verses);
  verifyBytes('verses.jsonl', versesText);
  checksums['verses.jsonl'] = sha256(versesText);
  const versesRaw = parseJsonl(paths.verses, versesText);
  const segments: Segment[] = versesRaw.map((row, i) => {
    requireKeys(`${paths.verses} row ${i + 1}`, row, SEGMENT_KEYS);
    if (!isObject(row['ordinals']))
      fail(`${paths.verses} row ${i + 1}: ordinals must be an object`);
    return row as unknown as Segment;
  });

  const tokensText = readText(paths.tokens);
  verifyBytes('tokens.jsonl', tokensText);
  checksums['tokens.jsonl'] = sha256(tokensText);
  const tokensRaw = parseJsonl(paths.tokens, tokensText);
  const tokens: Token[] = tokensRaw.map((row, i) => {
    requireKeys(`${paths.tokens} row ${i + 1}`, row, TOKEN_KEYS);
    if (typeof row['position'] !== 'number') {
      fail(`${paths.tokens} row ${i + 1}: position must be a number`);
    }
    if (typeof row['is_basmala'] !== 'boolean') {
      fail(`${paths.tokens} row ${i + 1}: is_basmala must be a boolean`);
    }
    const morph = row['morphology'];
    if (!isObject(morph))
      fail(`${paths.tokens} row ${i + 1}: morphology must be an object`);
    if (typeof morph['pos'] !== 'string') {
      fail(`${paths.tokens} row ${i + 1}: morphology.pos must be a string`);
    }
    if (!Array.isArray(morph['segments'])) {
      fail(
        `${paths.tokens} row ${i + 1}: morphology.segments must be an array`,
      );
    }
    return row as unknown as Token;
  });

  const rootsPath = join(dir, 'morphology', 'roots.json');
  const rootsText = readText(rootsPath);
  verifyBytes('morphology/roots.json', rootsText);
  checksums['morphology/roots.json'] = sha256(rootsText);
  const rootsRaw = parseJson(rootsPath, rootsText);
  if (!Array.isArray(rootsRaw)) fail(`${rootsPath}: expected an array`);
  const roots: Root[] = rootsRaw.map((row, i) => {
    if (!isObject(row)) fail(`${rootsPath}[${i}]: expected an object`);
    requireKeys(`${rootsPath}[${i}]`, row, ROOT_KEYS);
    if (!Array.isArray(row['token_ids']))
      fail(`${rootsPath}[${i}]: token_ids must be an array`);
    return row as unknown as Root;
  });

  // Lane's Lexicon (v0.8.0+): external annotation mapped onto roots. Present only
  // when the manifest declares it; loaded, checksum-verified, indexed by root slug.
  const lexicon = new Map<string, LaneEntry>();
  const lexiconArtifact = manifest.lexicon?.['artifact'];
  if (typeof lexiconArtifact === 'string') {
    const lexPath = join(dir, lexiconArtifact);
    const lexText = readText(lexPath);
    verifyBytes(lexiconArtifact, lexText);
    checksums[lexiconArtifact] = sha256(lexText);
    const lexRaw = parseJson(lexPath, lexText);
    if (!Array.isArray(lexRaw)) fail(`${lexPath}: expected an array`);
    const rootSlugs = new Set(roots.map((r) => r.root_slug));
    for (let i = 0; i < lexRaw.length; i++) {
      const row = lexRaw[i];
      if (!isObject(row)) fail(`${lexPath}[${i}]: expected an object`);
      requireKeys(`${lexPath}[${i}]`, row, ['root_slug', 'root', 'text']);
      const slug = row['root_slug'];
      if (typeof slug !== 'string')
        fail(`${lexPath}[${i}]: root_slug must be a string`);
      // A Lane entry must map onto a real corpus root — never a dangling annotation.
      if (!rootSlugs.has(slug))
        fail(`${lexPath}[${i}]: '${slug}' is not a corpus root`);
      lexicon.set(slug, row as unknown as LaneEntry);
    }
  }

  // Verse-level translation editions (v0.6.0+). Each edition declared in the
  // manifest is loaded, checksum-verified, and indexed by verse id. A missing or
  // count-mismatched edition is a hard error: the manifest and artifacts must agree.
  const translations: LoadedTranslation[] = [];
  const verseIds = new Set(segments.map((s) => s.id));
  for (const edition of manifest.translations?.editions ?? []) {
    const relPath = edition.artifact;
    const editionPath = join(dir, relPath);
    const editionText = readText(editionPath);
    verifyBytes(relPath, editionText);
    checksums[relPath] = sha256(editionText);
    const rows = parseJsonl(editionPath, editionText);
    const byVerseId = new Map<string, string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      requireKeys(`${editionPath} row ${i + 1}`, row, ['id', 'text']);
      const id = row['id'];
      const text = row['text'];
      if (typeof id !== 'string')
        fail(`${editionPath} row ${i + 1}: id must be a string`);
      if (typeof text !== 'string')
        fail(`${editionPath} row ${i + 1}: text must be a string`);
      // Identity mapping: every translation line addresses a real corpus verse.
      if (!verseIds.has(id))
        fail(`${editionPath} row ${i + 1}: '${id}' is not a corpus verse id`);
      byVerseId.set(id, text);
    }
    if (byVerseId.size !== edition.verses) {
      fail(
        `translation '${edition.id}' has ${byVerseId.size} lines, manifest declares ${edition.verses}`,
      );
    }
    translations.push({ edition, byVerseId });
  }

  // Cross-check the loaded shapes against the manifest's declared counts. A
  // mismatch means the artifacts and manifest disagree — refuse to load.
  if (tokens.length !== manifest.counts.tokens) {
    fail(
      `token count ${tokens.length} does not match manifest.counts.tokens ${manifest.counts.tokens}`,
    );
  }
  if (segments.length !== manifest.counts.verses) {
    fail(
      `verse count ${segments.length} does not match manifest.counts.verses ${manifest.counts.verses}`,
    );
  }
  if (surahs.length !== manifest.counts.surahs) {
    fail(
      `surah count ${surahs.length} does not match manifest.counts.surahs ${manifest.counts.surahs}`,
    );
  }

  // Referential integrity: every token belongs to a segment id, and its declared
  // surah is in range. Guards against a build that emitted orphaned tokens.
  const segmentIds = new Set(segments.map((s) => s.id));
  const surahNumbers = new Set(surahs.map((s) => s.number));
  for (const token of tokens) {
    if (token.surah < 1 || !surahNumbers.has(token.surah)) {
      fail(`token '${token.id}' references unknown surah ${token.surah}`);
    }
    // Basmala tokens live in segments that are not verse rows; only verify
    // ordinary (numeric-slot) tokens resolve to a counted segment.
    if (token.slot !== 'basmala' && !segmentIds.has(token.segment_id)) {
      fail(
        `token '${token.id}' references unknown segment '${token.segment_id}'`,
      );
    }
  }

  return {
    version,
    manifest,
    sources,
    surahs,
    segments,
    tokens,
    roots,
    lexicon,
    translations,
    numbering,
    checksums,
  };
}
