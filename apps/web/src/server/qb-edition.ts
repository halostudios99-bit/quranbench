import 'server-only';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LoadedTranslation, TranslationEdition } from '@quranbench/corpus';

/**
 * The project's own generated English edition.
 *
 * Every other edition in the reader is a licensed human translation loaded from
 * the sealed corpus release. This one is not: it is produced from the decision
 * table by packages/corpus-build (see pipeline/edition.py), it changes whenever
 * a decision changes, and it carries a different licence. It is therefore kept
 * outside the versioned release directory and loaded separately, so that the
 * manifest and its checksums continue to describe sourced data only.
 *
 * Three things follow from it being generated rather than translated, and the
 * reader must honour all three:
 *
 *   - it is PARTIAL. Only verses whose every word is decided are present, so
 *     most verses have no line at all. `getVerseTranslations` already skips an
 *     edition that lacks a verse, so this needs no special case.
 *   - it carries a DISCLAIMER, which the reader shows wherever it is displayed.
 *   - some of its words are graded `judgement` — weaker evidence than the rest.
 *     Those positions travel with each line so the reader can mark them instead
 *     of presenting them as settled.
 */
export interface GeneratedEdition extends TranslationEdition {
  generated: true;
  disclaimer: string;
  corpus_version: string;
  /** The decision table these words came from, so a reading can be traced. */
  decision_table_sha256: string;
  artifact_sha256: string;
  coverage: {
    verses_rendered: number;
    verses_total: number;
    words_rendered: number;
    words_total: number;
    verses_carrying_judgement: number;
    grades: Record<string, number>;
  };
}

/**
 * A generated line: the text, plus the word spans graded judgement.
 *
 * Spans are [start, length] into the whitespace-split text, not token indices:
 * one Arabic token can render as several English words, and a word can be
 * dropped by the repetition rule, so token position would mark the wrong word.
 */
export interface GeneratedLine {
  text: string;
  judgement: number[][];
}

export interface LoadedGeneratedEdition extends LoadedTranslation {
  edition: GeneratedEdition;
  /** verse id → the judgement word spans in that verse's rendering. */
  judgementByVerseId: Map<string, number[][]>;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Load the generated edition, or return null if it has not been built.
 *
 * Absence is not an error. The edition is a derived artifact; a checkout that
 * has never run the generator should still boot and serve every other edition.
 * A PRESENT but corrupted artifact is a different matter and throws, because
 * silently serving words that do not match the recorded hash would defeat the
 * point of recording it.
 */
export function loadGeneratedEdition(dir: string): LoadedGeneratedEdition | null {
  let meta: string;
  let body: string;
  try {
    meta = readFileSync(join(dir, 'edition.json'), 'utf8');
  } catch {
    return null;
  }

  const edition = JSON.parse(meta) as GeneratedEdition;
  try {
    body = readFileSync(join(dir, edition.artifact), 'utf8');
  } catch (cause) {
    throw new Error(
      `generated edition '${edition.id}': metadata is present but its artifact ` +
        `'${edition.artifact}' is not (${(cause as Error).message}). ` +
        `Run: python -m pipeline.edition build`,
    );
  }

  const actual = sha256(body);
  if (actual !== edition.artifact_sha256) {
    throw new Error(
      `generated edition '${edition.id}': artifact hash ${actual} does not match ` +
        `the ${edition.artifact_sha256} recorded in edition.json. The text and the ` +
        `decisions it claims to come from have diverged; rebuild it.`,
    );
  }

  const byVerseId = new Map<string, string>();
  const judgementByVerseId = new Map<string, number[][]>();
  for (const raw of body.split('\n')) {
    if (!raw) continue;
    const row = JSON.parse(raw) as { id: string } & GeneratedLine;
    byVerseId.set(row.id, row.text);
    if (row.judgement?.length) judgementByVerseId.set(row.id, row.judgement);
  }

  if (byVerseId.size !== edition.verses) {
    throw new Error(
      `generated edition '${edition.id}' has ${byVerseId.size} lines, ` +
        `edition.json declares ${edition.verses}`,
    );
  }

  return { edition, byVerseId, judgementByVerseId };
}

/** Whether an edition is the generated one — it must be displayed differently. */
export function isGenerated(
  edition: TranslationEdition,
): edition is GeneratedEdition {
  return (edition as GeneratedEdition).generated === true;
}
