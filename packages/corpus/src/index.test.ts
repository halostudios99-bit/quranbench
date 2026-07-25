import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CorpusValidationError, DEFAULT_CORPUS_VERSION, loadCorpus } from './index.js';

// Loaded once — the artifacts are a few megabytes and reused across assertions.
const corpus = loadCorpus();

describe('loadCorpus', () => {
  it('loads the default version and exposes the manifest', () => {
    expect(corpus.version).toBe(DEFAULT_CORPUS_VERSION);
    expect(corpus.manifest.corpus_version).toBe(DEFAULT_CORPUS_VERSION);
    expect(corpus.manifest.segmentation_scheme).toBe('tanzil-uthmani');
  });

  it('loads the declared counts exactly', () => {
    // Documented figures from corpus v0.3.0's manifest.
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

  it('preserves Quranic text byte-for-byte (no mutation on load)', () => {
    const first = corpus.tokens[0]!;
    expect(first.id).toBe('quran:tanzil-uthmani:1:1:1');
    expect(first.text_uthmani).toBe('بِسْمِ');
    expect(first.text_normalised).toBe('بسم');
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
