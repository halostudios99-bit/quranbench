// Orchestration: audit one article end to end. Extract claims, verify each
// against the corpus, deduplicate, rank. Pure over the context — no I/O.

import type { AuditContext } from './context.js';
import { extract, type RawReference } from './extract.js';
import { excerptAt, lineIndexer } from './text.js';
import {
  refString,
  verifyLooseArabic,
  verifyReference,
  verifyRootClaim,
  verifyTransliteration,
} from './verify.js';
import {
  SEVERITY_WEIGHT,
  type ArticleReport,
  type Finding,
  type SourceLocation,
} from './types.js';

export interface ArticleInput {
  /** Source file basename, e.g. "zakat.md". */
  file: string;
  markdown: string;
}

interface ArticleMeta {
  title: string;
  slug: string;
}

function parseMeta(file: string, markdown: string): ArticleMeta {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.replace(/\.md$/, '');
  const slug =
    markdown.match(/slug:\s*([A-Za-z0-9-]+)/)?.[1]?.trim() ?? file.replace(/\.md$/, '');
  return { title, slug };
}

/** Keep one reference per distinct verse ref, preferring the richest mention. */
function dedupeReferences(refs: RawReference[]): RawReference[] {
  const chosen = new Map<string, RawReference>();
  for (const ref of refs) {
    const key = refString(ref);
    const prev = chosen.get(key);
    if (!prev) {
      chosen.set(key, ref);
      continue;
    }
    // Prefer a mention that carries a quoted verse, then one with a surah name.
    const score = (r: RawReference) => (r.arabic ? 2 : 0) + (r.surahName ? 1 : 0);
    if (score(ref) > score(prev)) chosen.set(key, ref);
  }
  return [...chosen.values()];
}

const STATUS_ORDER = { flagged: 0, unchecked: 1, verified: 2 } as const;
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function auditArticle(ctx: AuditContext, input: ArticleInput): ArticleReport {
  const { markdown, file } = input;
  const lineOf = lineIndexer(markdown);
  const locate = (index: number): SourceLocation => ({
    line: lineOf(index),
    excerpt: excerptAt(markdown, index),
  });

  const ex = extract(markdown);
  const findings: Finding[] = [];

  for (const ref of dedupeReferences(ex.references)) {
    findings.push(...verifyReference(ctx, ref, locate(ref.index)));
  }

  const seenLoose = new Set<string>();
  for (const quote of ex.looseArabic) {
    const key = quote.text.replace(/\s+/g, ' ').trim();
    if (seenLoose.has(key)) continue;
    seenLoose.add(key);
    const f = verifyLooseArabic(ctx, quote, locate(quote.index));
    if (f) findings.push(f);
  }

  for (const claim of ex.rootClaims) {
    findings.push(verifyRootClaim(ctx, claim, locate(claim.index)));
  }

  const seenTranslit = new Set<string>();
  for (const pair of ex.transliterations) {
    const key = `${pair.translit.toLowerCase()}|${pair.arabic}`;
    if (seenTranslit.has(key)) continue;
    seenTranslit.add(key);
    const f = verifyTransliteration(pair, locate(pair.index));
    if (f) findings.push(f);
  }

  findings.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.location.line - b.location.line,
  );

  const counts = {
    checked: findings.length,
    verified: findings.filter((f) => f.status === 'verified').length,
    flagged: findings.filter((f) => f.status === 'flagged').length,
    unchecked: findings.filter((f) => f.status === 'unchecked').length,
  };
  const workScore = findings
    .filter((f) => f.status === 'flagged')
    .reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);

  const { title, slug } = parseMeta(file, markdown);
  return {
    slug,
    title,
    file,
    corpusVersion: ctx.version,
    provenance: `Audited against corpus ${ctx.version} (Tanzil Uthmani text, Leeds QAC morphology) with @quranbench/audit. Automated checks only; every flag is for human decision and nothing was corrected.`,
    counts,
    workScore,
    findings,
  };
}

/** Verified verse references, with resolved token ids — used to seed evidence. */
export function verifiedEvidence(
  report: ArticleReport,
): { reference: string; segmentIds: string[]; tokenIds: string[] }[] {
  return report.findings
    .filter((f) => f.kind === 'verse-reference' && f.status === 'verified' && f.tokenIds)
    .map((f) => ({
      reference: f.reference!,
      segmentIds: f.segmentIds ?? [],
      tokenIds: f.tokenIds ?? [],
    }));
}
