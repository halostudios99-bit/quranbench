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
  User,
} from './types';

export interface CreateUserInput {
  email: string;
  handle: string;
  displayName?: string | null;
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

  // ── Investigations ────────────────────────────────────────────────────────
  createInvestigation(
    input: CreateInvestigationInput,
    corpusVersion: string,
  ): Promise<Investigation>;
  getInvestigation(id: string): Promise<Investigation | null>;
  getInvestigationBySlug(slug: string): Promise<Investigation | null>;
  listInvestigations(statuses: Investigation['status'][]): Promise<Investigation[]>;
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
