// @quranbench/audit — verify the linguistic claims in an article against the
// corpus. Extraction is pure; verification reads the loaded corpus and search
// index. Nothing here ever modifies the source or auto-corrects a claim — every
// problem is reported as a Finding for a human to decide.

export { createContext, strongSkeleton, joinRoot, type AuditContext } from './context.js';
export { auditArticle, verifiedEvidence, type ArticleInput } from './audit.js';
export { extract, type Extraction } from './extract.js';
export { renderMarkdown } from './report.js';
export { buildSurahMatcher, SurahMatcher, normaliseName } from './surahs.js';

export type {
  ArticleReport,
  ArticleReportCounts,
  Finding,
  FindingKind,
  FindingStatus,
  MatchLevel,
  Severity,
  SourceLocation,
} from './types.js';
export { SEVERITY_WEIGHT } from './types.js';
