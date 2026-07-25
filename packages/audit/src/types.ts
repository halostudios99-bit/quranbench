// Domain types for the audit checker. An audit produces Findings: assertions in
// an article that were extracted and then verified against the corpus. Nothing
// here corrects the source — every problem is flagged for a human decision.

export type Severity = 'high' | 'medium' | 'low';

/**
 * verified   — checked against the corpus and confirmed.
 * flagged    — checked against the corpus and it disagrees. Needs a human.
 * unchecked  — extracted but not automatically verifiable; listed for review.
 */
export type FindingStatus = 'verified' | 'flagged' | 'unchecked';

export type FindingKind =
  | 'verse-reference'
  | 'surah-name'
  | 'quoted-arabic'
  | 'root-claim'
  | 'transliteration';

/**
 * How closely a quoted Arabic string matched the corpus text.
 * orthographic — matched only after collapsing script differences (Imlaei vs Uthmani).
 */
export type MatchLevel = 'canonical' | 'normalised' | 'orthographic' | 'partial' | 'none';

export interface SourceLocation {
  /** 1-based line number in the source markdown. */
  line: number;
  /** A short trimmed excerpt around the claim, for the human reviewer. */
  excerpt: string;
}

export interface Finding {
  kind: FindingKind;
  status: FindingStatus;
  /** Only meaningful when status is 'flagged'. */
  severity: Severity;
  location: SourceLocation;
  /** One-line human-readable statement of what was checked and the outcome. */
  summary: string;
  /** Longer explanation and the corpus evidence behind the outcome. */
  detail: string;

  // --- Structured evidence, populated where relevant ---
  /** e.g. "2:43" or "2:43-45". */
  reference?: string;
  /** Resolved corpus segment id(s), if the reference resolved. */
  segmentIds?: string[];
  /** Resolved corpus token ids — used to pin evidence when seeding. */
  tokenIds?: string[];
  /** The Arabic string as it appeared in the article. */
  claimedArabic?: string;
  /** For root claims: the root the article asserts. */
  claimedRoot?: string;
  /** For root claims: the root(s) the corpus records for the word. */
  corpusRoots?: string[];
  matchLevel?: MatchLevel;
}

export interface ArticleReportCounts {
  checked: number;
  verified: number;
  flagged: number;
  unchecked: number;
}

export interface ArticleReport {
  slug: string;
  title: string;
  /** Source file name (basename). */
  file: string;
  corpusVersion: string;
  /** Provenance line: how and against what this report was produced. */
  provenance: string;
  counts: ArticleReportCounts;
  /** Weighted flagged score used to rank articles by review effort. */
  workScore: number;
  findings: Finding[];
}

/** Severity weights used to compute the ranking score. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 5,
  medium: 2,
  low: 1,
};
