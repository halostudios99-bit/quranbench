// The persistence port. Every rule in the domain layer talks to this interface,
// never to Prisma directly. Two implementations exist: PrismaStore (production,
// src/server/store-prisma.ts) and InMemoryStore (tests, store-memory.ts). Because
// the rules depend only on this port, they are testable with no database — which
// is exactly how the publish gate, the terms gate and append-only revisions are
// proven below the UI.

import type {
  ActionKind,
  Citation,
  CitingInvestigation,
  CitationKind,
  EvidencePin,
  EvidencePinInput,
  Investigation,
  InvestigationRevision,
  ReportTargetType,
  Response,
  ResponseType,
  SessionRecord,
  TermsAcceptance,
  User,
} from './types';

export interface CreateUserInput {
  email: string;
  handle: string;
  displayName?: string | null;
  /** scrypt hash from domain/password.ts. The raw password never reaches the store. */
  passwordHash: string;
}

/** An email + its password hash, for sign-in credential checks. */
export interface Credential {
  user: User;
  passwordHash: string;
}

export interface CreateInvestigationInput {
  authorId: string;
  slug: string;
  claim: string;
  query: string;
  counterEvidence: string;
  pins: EvidencePinInput[];
}

export interface InvestigationHeadPatch {
  claim?: string;
  query?: string;
  counterEvidence?: string;
  status?: Investigation['status'];
  flaggedForReview?: boolean;
  reviewReason?: string | null;
  publishedAt?: Date | null;
}

export interface AddRevisionInput {
  investigationId: string;
  authorId: string;
  claim: string;
  query: string;
  counterEvidence: string;
  status: Investigation['status'];
  note?: string | null;
}

export interface CreateResponseInput {
  investigationId: string;
  authorId: string;
  type: ResponseType;
  body: string;
  pins: EvidencePinInput[];
}

export interface CreateReportInput {
  reporterId: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  detail?: string | null;
}

export interface Store {
  // ── Accounts ──────────────────────────────────────────────────────────────
  createUser(input: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByHandle(handle: string): Promise<User | null>;
  recordTermsAcceptance(
    userId: string,
    version: string,
    acceptedAt: Date,
  ): Promise<void>;
  hasAcceptedTerms(userId: string): Promise<boolean>;
  /** Every acceptance on file for a user, newest first — for the account page. */
  listTermsAcceptances(userId: string): Promise<TermsAcceptance[]>;
  /** The email + password hash for a sign-in check, or null if no such account. */
  findCredential(email: string): Promise<Credential | null>;
  markEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  /** The reader's saved view preferences (opaque JSON), or null if none stored. */
  getReaderPrefs(userId: string): Promise<unknown | null>;
  /** Persist the reader's view preferences on the account. Never gates content. */
  setReaderPrefs(userId: string, prefs: unknown): Promise<void>;

  // ── Sessions ────────────────────────────────────────────────────────────────
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  // ── Email verification tokens ────────────────────────────────────────────────
  createEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  /** Consume a token: return its user id and delete it, or null if invalid/expired. */
  consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<string | null>;

  // ── Investigations ────────────────────────────────────────────────────────
  createInvestigation(
    input: CreateInvestigationInput,
    corpusVersion: string,
  ): Promise<Investigation>;
  getInvestigation(id: string): Promise<Investigation | null>;
  getInvestigationBySlug(slug: string): Promise<Investigation | null>;
  listInvestigations(statuses: Investigation['status'][]): Promise<Investigation[]>;
  /** Every investigation by one author, any status — the account page needs drafts too. */
  listInvestigationsByAuthor(authorId: string): Promise<Investigation[]>;
  updateInvestigationHead(
    id: string,
    patch: InvestigationHeadPatch,
  ): Promise<Investigation>;
  replaceInvestigationPins(
    investigationId: string,
    pins: EvidencePinInput[],
    corpusVersion: string,
  ): Promise<void>;
  listInvestigationPins(investigationId: string): Promise<EvidencePin[]>;

  // Append-only. There is deliberately no updateRevision / deleteRevision.
  addRevision(input: AddRevisionInput): Promise<InvestigationRevision>;
  listRevisions(investigationId: string): Promise<InvestigationRevision[]>;

  // ── Citations (bidirectional linking projection) ────────────────────────────
  replaceCitations(
    investigationId: string,
    citations: Citation[],
  ): Promise<void>;
  findCitingInvestigations(
    kind: CitationKind,
    key: string,
  ): Promise<CitingInvestigation[]>;

  // ── Responses ───────────────────────────────────────────────────────────────
  createResponse(
    input: CreateResponseInput,
    corpusVersion: string,
  ): Promise<Response>;
  listResponses(investigationId: string): Promise<Response[]>;
  listResponsePins(responseId: string): Promise<EvidencePin[]>;

  // ── Moderation ────────────────────────────────────────────────────────────
  createReport(input: CreateReportInput): Promise<{ id: string }>;

  // ── Rate limiting ───────────────────────────────────────────────────────────
  countActions(kind: ActionKind, subject: string, since: Date): Promise<number>;
  recordAction(kind: ActionKind, subject: string, at: Date): Promise<void>;
}
