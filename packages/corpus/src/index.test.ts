import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CorpusValidationError, DEFAULT_CORPUS_VERSION, loadCorpus } from './index.js';

const ARTIFACTS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'corpus-build',
  'out',
);

// Loaded once — the artifacts are a few megabytes and reused across assertions.
const corpus = loadCorpus();

describe('loadCorpus', () => {
  it('loads the default version and exposes the manifest', () => {
    expect(corpus.version).toBe(DEFAULT_CORPUS_VERSION);
    expect(corpus.manifest.corpus_version).toBe(DEFAULT_CORPUS_VERSION);
    expect(corpus.manifest.segmentation_scheme).toBe('tanzil-uthmani');
  });

  it('loads the declared counts exactly', () => {
    // Documented figures — unchanged since v0.5.0 (v0.6.0 only adds translations).
    expect(corpus.tokens.length).toBe(77881);
    expect(corpus.segments.length).toBe(6236);
    expect(corpus.surahs.length).toBe(114);
  });

  it('loads sources and numbering schemes', () => {
    expect(corpus.sources.map((s) => s.id)).toContain('tanzil-uthmani');
    expect(corpus.numbering.has('kufan')).toBe(true);
    expect(corpus.numbering.get('kufan')!.is_default).toBe(true);
  });

  it('computes a checksum for every loaded artifact', () => {
    for (const file of ['manifest.json', 'sources.json', 'surahs.json', 'verses.jsonl', 'tokens.jsonl']) {
      expect(corpus.checksums[file]).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('records output checksums in the manifest for every non-manifest artifact', () => {
    const checksums = corpus.manifest.checksums;
    expect(checksums['manifest.json']).toBeUndefined();
    for (const file of ['sources.json', 'surahs.json', 'verses.jsonl', 'tokens.jsonl', 'numbering/kufan.json']) {
      expect(checksums[file]!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(checksums[file]!.bytes).toBeGreaterThan(0);
    }
    // The loader's independently computed checksums agree with the manifest's.
    for (const file of ['sources.json', 'surahs.json', 'verses.jsonl', 'tokens.jsonl']) {
      expect(corpus.checksums[file]).toBe(checksums[file]!.sha256);
    }
  });

  it('fails loudly, naming the file, when one byte of an artifact is corrupted', () => {
    const root = mkdtempSync(join(tmpdir(), 'qb-corrupt-'));
    const dir = join(root, `v${DEFAULT_CORPUS_VERSION}`);
    cpSync(join(ARTIFACTS_ROOT, `v${DEFAULT_CORPUS_VERSION}`), dir, { recursive: true });

    const tokensPath = join(dir, 'tokens.jsonl');
    const bytes = readFileSync(tokensPath);
    bytes[1000] = bytes[1000]! ^ 0x01; // flip a single bit deep in the file
    writeFileSync(tokensPath, bytes);

    expect(() => loadCorpus(DEFAULT_CORPUS_VERSION, { root })).toThrow(CorpusValidationError);
    expect(() => loadCorpus(DEFAULT_CORPUS_VERSION, { root })).toThrow(/tokens\.jsonl.*checksum/);
  });

  it('degrades cleanly when a non-redistributable edition is absent', () => {
    // Talal Itani's ClearQuran is fetched at build time and never committed, so a
    // fork that has not fetched it must still load the corpus — just with one
    // fewer translation. Removing a *redistributable* edition would, by contrast,
    // remain a hard error (covered by the checksum tests above).
    const root = mkdtempSync(join(tmpdir(), 'qb-no-itani-'));
    const dir = join(root, `v${DEFAULT_CORPUS_VERSION}`);
    cpSync(join(ARTIFACTS_ROOT, `v${DEFAULT_CORPUS_VERSION}`), dir, {
      recursive: true,
    });
    rmSync(join(dir, 'translations', 'en-itani.jsonl'));

    const degraded = loadCorpus(DEFAULT_CORPUS_VERSION, { root });
    const editionIds = degraded.translations.map((t) => t.edition.id);
    expect(editionIds).not.toContain('en-itani');
    expect(editionIds).toContain('en-pickthall');
    expect(degraded.translations.length).toBe(corpus.translations.length - 1);
  });

  it('preserves Quranic text byte-for-byte (no mutation on load)', () => {
    const first = corpus.tokens[0]!;
    expect(first.id).toBe('quran:tanzil-uthmani:1:1:1');
    expect(first.text_uthmani).toBe('بِسْمِ');
    expect(first.text_normalised).toBe('بسم');
  });

  it('loads verse-level translation editions with a redistributable licence', () => {
    expect(corpus.translations.length).toBeGreaterThanOrEqual(2);
    for (const t of corpus.translations) {
      expect(t.edition.licence).toBeTruthy();
      expect(t.edition.licence_url).toMatch(/^https?:\/\//);
      expect(t.edition.translator).toBeTruthy();
      // Verse-level: one line per counted verse, keyed by a real verse id.
      expect(t.byVerseId.size).toBe(corpus.segments.length);
      expect(t.byVerseId.get('quran:tanzil-uthmani:1:1')).toBeTruthy();
    }
    expect(corpus.translations.map((t) => t.edition.id)).toContain('en-pickthall');
    expect(corpus.manifest.translations!.alignment).toBe('verse-level');
  });

  it('fails loudly when the requested version is absent', () => {
    expect(() => loadCorpus('99.0.0')).toThrow(CorpusValidationError);
  });

  it('fails loudly on a manifest whose version disagrees with the request', () => {
    const root = mkdtempSync(join(tmpdir(), 'qb-corpus-'));
    mkdirSync(join(root, 'v0.2.0'));
    writeFileSync(
      join(root, 'v0.2.0', 'manifest.json'),
      JSON.stringify({
        corpus_version: '0.3.0',
        counts: { surahs: 114, verses: 6236, tokens: 77881 },
        numbering: { active: 'kufan', available: ['kufan'] },
        segmentation_scheme: 'tanzil-uthmani',
      }),
    );
    expect(() => loadCorpus('0.2.0', { root })).toThrow(/does not match requested version/);
  });
});
