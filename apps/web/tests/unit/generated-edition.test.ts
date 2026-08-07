import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isGenerated, loadGeneratedEdition } from '@/server/qb-edition';

// The generated edition is the one thing on this site that is not sourced from
// somewhere else, so the load path has to be strict about two things: that the
// words on screen are the words the recorded decisions produced, and that the
// edition can never be mistaken for a human translation.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const editionDir = join(repoRoot, 'packages', 'corpus-build', 'qb-translation');

function scratch(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'qb-edition-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body, 'utf8');
  }
  return dir;
}

describe('the generated edition', () => {
  it('loads the built artifact and marks itself as generated', () => {
    const loaded = loadGeneratedEdition(editionDir);
    expect(loaded, 'run: python -m pipeline.edition build').not.toBeNull();
    expect(isGenerated(loaded!.edition)).toBe(true);
    expect(loaded!.edition.translator).toMatch(/generated/i);
    expect(loaded!.edition.disclaimer.length).toBeGreaterThan(80);
    expect(loaded!.byVerseId.size).toBe(loaded!.edition.verses);
  });

  it('reports coverage honestly, complete or not', () => {
    const { edition, byVerseId } = loadGeneratedEdition(editionDir)!;
    // The edition reached 100% of verses on 2026-08-07 and the disclaimer was
    // rewritten from "incomplete" to "under review" at the same moment —
    // this test originally asserted partiality precisely to force that change.
    expect(edition.coverage.verses_rendered).toBe(byVerseId.size);
    expect(byVerseId.size).toBeLessThanOrEqual(edition.coverage.verses_total);
    if (byVerseId.size === edition.coverage.verses_total) {
      expect(edition.disclaimer).not.toMatch(/incomplete/i);
    }
  });

  it('marks judgement words as spans that land on real words', () => {
    const { byVerseId, judgementByVerseId } = loadGeneratedEdition(editionDir)!;
    expect(judgementByVerseId.size).toBeGreaterThan(0);

    for (const [verseId, spans] of judgementByVerseId) {
      const words = byVerseId.get(verseId)!.split(' ');
      for (const [start, length] of spans) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(length).toBeGreaterThan(0);
        // A span that runs off the end would silently mark nothing.
        expect(start! + length!).toBeLessThanOrEqual(words.length);
      }
    }
  });

  it('refuses an artifact that does not match its recorded hash', () => {
    // The hash is what ties the words on screen to the decisions that produced
    // them. Serving text that no longer matches would make the record a fiction.
    const meta = JSON.parse(readFileSync(join(editionDir, 'edition.json'), 'utf8'));
    const dir = scratch({
      'edition.json': JSON.stringify(meta),
      [meta.artifact]: '{"id":"quran:tanzil-uthmani:1:1","text":"tampered"}\n',
    });
    try {
      expect(() => loadGeneratedEdition(dir)).toThrow(/does not match/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats an unbuilt edition as absent, not as an error', () => {
    // A checkout that has never run the generator must still boot and serve
    // every other edition.
    const dir = scratch({});
    try {
      expect(loadGeneratedEdition(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
