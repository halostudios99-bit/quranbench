// Domain types for the application layer. These mirror the Prisma schema but are
// declared independently so the rule layer (accounts, investigations, responses,
// moderation, rate-limit) and its tests depend on NO database at all. The Prisma
// adapter maps between these and generated Prisma rows — the string values are
// identical, so the mapping is an identity cast, never a translation.

export type InvestigationStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CONTESTED'
  | 'REVISED'
  | 'WITHDRAWN';

/** Statuses at which an investigation is public and surfaces in citations. */
export const PUBLISHED_STATUSES: InvestigationStatus[] = [
  'OPEN',
  'CONTESTED',
  'REVISED',
];

export function isPublished(status: InvestigationStatus): boolean {
  return PUBLISHED_STATUSES.includes(status);
}

export type ResponseType =
  | 'DISPUTES'
  | 'SUPPORTS'
  | 'CLARIFIES'
  | 'ADDS_EVIDENCE';

export const RESPONSE_TYPES: ResponseType[] = [
  'DISPUTES',
  'SUPPORTS',
  'CLARIFIES',
  'ADDS_EVIDENCE',
];

export type CitationKind = 'TOKEN' | 'ROOT' | 'SEGMENT' | 'SURAH';

// PAGE is a correction report against any public page (a verse, word, root or
// investigation URL): the platform's promise to be corrected needs a place to be
// told. targetId is the reported page path. See domain/moderation.ts.
export type ReportTargetType = 'INVESTIGATION' | 'RESPONSE' | 'PAGE';

export type ActionKind =
  | 'SIGNUP'
  | 'PUBLISH'
  | 'RESPONSE'
  | 'REPORT'
  | 'PASSWORD_RESET';

export interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

/** A persisted session, keyed by the SHA-256 of the raw cookie token. */
export interface SessionRecord {
  userId: string;
  expiresAt: Date;
}

/** One recorded contributor-terms acceptance. Append-only in the store. */
export interface TermsAcceptance {
  version: string;
  acceptedAt: Date;
}

export interface Investigation {
  id: string;
  authorId: string;
  slug: string;
  claim: string;
  query: string;
  counterEvidence: string;
  status: InvestigationStatus;
  flaggedForReview: boolean;
  reviewReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationRevision {
  id: string;
  investigationId: string;
  revision: number;
  authorId: string;
  claim: string;
  query: string;
  counterEvidence: string;
  status: InvestigationStatus;
  note: string | null;
  createdAt: Date;
}

/** An evidence reference: a corpus token id + the version it was pinned against.
 *  Never any Arabic text. */
export interface EvidencePinInput {
  tokenId: string;
  segmentId?: string | null;
  scheme?: string;
  note?: string | null;
}

export interface EvidencePin {
  id: string;
  tokenId: string;
  segmentId: string | null;
  scheme: string;
  note: string | null;
  corpusVersion: string;
}

export interface Response {
  id: string;
  investigationId: string;
  authorId: string;
  type: ResponseType;
  body: string;
  createdAt: Date;
}

export interface Citation {
  investigationId: string;
  kind: CitationKind;
  key: string;
  corpusVersion: string;
}

/** A published investigation as surfaced on a word or root page. */
export interface CitingInvestigation {
  id: string;
  slug: string;
  claim: string;
  status: InvestigationStatus;
  authorHandle: string;
  publishedAt: Date | null;
}
