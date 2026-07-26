// An in-memory Store for tests. It has no dependency on Prisma or a database, so
// the domain rules can be exercised in a plain unit test. It is a faithful
// implementation of the port — same semantics as PrismaStore — not a stub.

import type {
  AddRevisionInput,
  Credential,
  CreateInvestigationInput,
  CreateReportInput,
  CreateResponseInput,
  CreateUserInput,
  InvestigationHeadPatch,
  Store,
} from './store';
import {
  isPublished,
  type ActionKind,
  type Citation,
  type CitationKind,
  type CitingInvestigation,
  type EvidencePin,
  type EvidencePinInput,
  type Investigation,
  type InvestigationRevision,
  type Response,
  type SessionRecord,
  type TermsAcceptance,
  type User,
} from './types';

interface Acceptance {
  userId: string;
  version: string;
  acceptedAt: Date;
}
interface ActionRow {
  kind: ActionKind;
  subject: string;
  at: Date;
}
interface SessionRow {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}
interface VerificationRow {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}
interface Report {
  id: string;
  reporterId: string | null;
  targetType: CreateReportInput['targetType'];
  targetId: string;
  reason: string;
  detail: string | null;
  createdAt: Date;
}

export class InMemoryStore implements Store {
  private seq = 0;
  private now = () => new Date();

  private users: User[] = [];
  private passwordHashes = new Map<string, string>();
  private readerPrefs = new Map<string, unknown>();
  private sessions: SessionRow[] = [];
  private verifications: VerificationRow[] = [];
  private resets: VerificationRow[] = [];
  private acceptances: Acceptance[] = [];
  private investigations: Investigation[] = [];
  private revisions: InvestigationRevision[] = [];
  private pins: (EvidencePin & {
    investigationId: string | null;
    responseId: string | null;
  })[] = [];
  private citations: Citation[] = [];
  private responses: Response[] = [];
  private reports: Report[] = [];
  private actions: ActionRow[] = [];

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq.toString(36).padStart(6, '0')}`;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: this.id('usr'),
      email: input.email,
      handle: input.handle,
      displayName: input.displayName ?? null,
      emailVerified: null,
      createdAt: this.now(),
    };
    this.users.push(user);
    this.passwordHashes.set(user.id, input.passwordHash);
    return user;
  }
  async getUser(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async getUserByHandle(handle: string) {
    return this.users.find((u) => u.handle === handle) ?? null;
  }
  async recordTermsAcceptance(
    userId: string,
    version: string,
    acceptedAt: Date,
  ) {
    const exists = this.acceptances.some(
      (a) => a.userId === userId && a.version === version,
    );
    if (!exists) this.acceptances.push({ userId, version, acceptedAt });
  }
  async hasAcceptedTerms(userId: string) {
    return this.acceptances.some((a) => a.userId === userId);
  }
  async listTermsAcceptances(userId: string): Promise<TermsAcceptance[]> {
    return this.acceptances
      .filter((a) => a.userId === userId)
      .map((a) => ({ version: a.version, acceptedAt: a.acceptedAt }))
      .sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());
  }
  async findCredential(email: string): Promise<Credential | null> {
    const user = this.users.find((u) => u.email === email);
    if (!user) return null;
    const passwordHash = this.passwordHashes.get(user.id);
    if (!passwordHash) return null;
    return { user, passwordHash };
  }
  async updatePasswordHash(userId: string, passwordHash: string) {
    this.passwordHashes.set(userId, passwordHash);
  }
  async markEmailVerified(userId: string, verifiedAt: Date) {
    const user = this.users.find((u) => u.id === userId);
    if (user) user.emailVerified = verifiedAt;
  }
  async getReaderPrefs(userId: string) {
    return this.readerPrefs.get(userId) ?? null;
  }
  async setReaderPrefs(userId: string, prefs: unknown) {
    this.readerPrefs.set(userId, prefs);
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    this.sessions.push({ tokenHash, userId, expiresAt });
  }
  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    const row = this.sessions.find((s) => s.tokenHash === tokenHash);
    return row ? { userId: row.userId, expiresAt: row.expiresAt } : null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions = this.sessions.filter((s) => s.tokenHash !== tokenHash);
  }
  async deleteUserSessions(userId: string) {
    this.sessions = this.sessions.filter((s) => s.userId !== userId);
  }

  async createEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    this.verifications.push({ tokenHash, userId, expiresAt });
  }
  async consumeEmailVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const row = this.verifications.find((v) => v.tokenHash === tokenHash);
    if (!row) return null;
    this.verifications = this.verifications.filter(
      (v) => v.tokenHash !== tokenHash,
    );
    if (row.expiresAt.getTime() <= now.getTime()) return null;
    return row.userId;
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    this.resets.push({ tokenHash, userId, expiresAt });
  }
  async consumePasswordResetToken(
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const row = this.resets.find((r) => r.tokenHash === tokenHash);
    if (!row) return null;
    this.resets = this.resets.filter((r) => r.tokenHash !== tokenHash);
    if (row.expiresAt.getTime() <= now.getTime()) return null;
    return row.userId;
  }
  async deleteUserPasswordResetTokens(userId: string) {
    this.resets = this.resets.filter((r) => r.userId !== userId);
  }

  async createInvestigation(
    input: CreateInvestigationInput,
    corpusVersion: string,
  ): Promise<Investigation> {
    const at = this.now();
    const inv: Investigation = {
      id: this.id('inv'),
      authorId: input.authorId,
      slug: input.slug,
      claim: input.claim,
      query: input.query,
      counterEvidence: input.counterEvidence,
      status: 'DRAFT',
      flaggedForReview: false,
      reviewReason: null,
      publishedAt: null,
      createdAt: at,
      updatedAt: at,
    };
    this.investigations.push(inv);
    await this.replaceInvestigationPins(inv.id, input.pins, corpusVersion);
    return inv;
  }
  async getInvestigation(id: string) {
    return this.investigations.find((i) => i.id === id) ?? null;
  }
  async getInvestigationBySlug(slug: string) {
    return this.investigations.find((i) => i.slug === slug) ?? null;
  }
  async listInvestigations(statuses: Investigation['status'][]) {
    return this.investigations
      .filter((i) => statuses.includes(i.status))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  async listInvestigationsByAuthor(authorId: string) {
    return this.investigations
      .filter((i) => i.authorId === authorId)
      .map((i) => ({ ...i }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  async updateInvestigationHead(id: string, patch: InvestigationHeadPatch) {
    const inv = this.investigations.find((i) => i.id === id);
    if (!inv) throw new Error('investigation not found');
    if (patch.claim !== undefined) inv.claim = patch.claim;
    if (patch.query !== undefined) inv.query = patch.query;
    if (patch.counterEvidence !== undefined)
      inv.counterEvidence = patch.counterEvidence;
    if (patch.status !== undefined) inv.status = patch.status;
    if (patch.flaggedForReview !== undefined)
      inv.flaggedForReview = patch.flaggedForReview;
    if (patch.reviewReason !== undefined) inv.reviewReason = patch.reviewReason;
    if (patch.publishedAt !== undefined) inv.publishedAt = patch.publishedAt;
    inv.updatedAt = this.now();
    return { ...inv };
  }
  async replaceInvestigationPins(
    investigationId: string,
    pins: EvidencePinInput[],
    corpusVersion: string,
  ) {
    this.pins = this.pins.filter((p) => p.investigationId !== investigationId);
    for (const p of pins) {
      this.pins.push({
        id: this.id('pin'),
        investigationId,
        responseId: null,
        tokenId: p.tokenId,
        segmentId: p.segmentId ?? null,
        scheme: p.scheme ?? 'tanzil-uthmani',
        note: p.note ?? null,
        corpusVersion,
      });
    }
  }
  async listInvestigationPins(investigationId: string): Promise<EvidencePin[]> {
    return this.pins
      .filter((p) => p.investigationId === investigationId)
      .map(stripOwner);
  }

  async addRevision(input: AddRevisionInput): Promise<InvestigationRevision> {
    const revision =
      this.revisions.filter((r) => r.investigationId === input.investigationId)
        .length + 1;
    const row: InvestigationRevision = {
      id: this.id('rev'),
      investigationId: input.investigationId,
      revision,
      authorId: input.authorId,
      claim: input.claim,
      query: input.query,
      counterEvidence: input.counterEvidence,
      status: input.status,
      note: input.note ?? null,
      createdAt: this.now(),
    };
    // Frozen: the historical row can never be mutated in place.
    this.revisions.push(Object.freeze({ ...row }));
    return row;
  }
  async listRevisions(investigationId: string) {
    return this.revisions
      .filter((r) => r.investigationId === investigationId)
      .map((r) => ({ ...r }))
      .sort((a, b) => a.revision - b.revision);
  }

  async replaceCitations(investigationId: string, citations: Citation[]) {
    this.citations = this.citations.filter(
      (c) => c.investigationId !== investigationId,
    );
    this.citations.push(...citations.map((c) => ({ ...c })));
  }
  async findCitingInvestigations(
    kind: CitationKind,
    key: string,
  ): Promise<CitingInvestigation[]> {
    const seen = new Set<string>();
    const out: CitingInvestigation[] = [];
    for (const c of this.citations) {
      if (c.kind !== kind || c.key !== key) continue;
      const inv = this.investigations.find((i) => i.id === c.investigationId);
      if (!inv || !isPublished(inv.status) || seen.has(inv.id)) continue;
      seen.add(inv.id);
      const author = this.users.find((u) => u.id === inv.authorId);
      out.push({
        id: inv.id,
        slug: inv.slug,
        claim: inv.claim,
        status: inv.status,
        authorHandle: author?.handle ?? 'unknown',
        publishedAt: inv.publishedAt,
      });
    }
    return out.sort(
      (a, b) =>
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );
  }

  async createResponse(
    input: CreateResponseInput,
    corpusVersion: string,
  ): Promise<Response> {
    const response: Response = {
      id: this.id('res'),
      investigationId: input.investigationId,
      authorId: input.authorId,
      type: input.type,
      body: input.body,
      createdAt: this.now(),
    };
    this.responses.push(response);
    for (const p of input.pins) {
      this.pins.push({
        id: this.id('pin'),
        investigationId: null,
        responseId: response.id,
        tokenId: p.tokenId,
        segmentId: p.segmentId ?? null,
        scheme: p.scheme ?? 'tanzil-uthmani',
        note: p.note ?? null,
        corpusVersion,
      });
    }
    return response;
  }
  async listResponses(investigationId: string) {
    return this.responses
      .filter((r) => r.investigationId === investigationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async listResponsePins(responseId: string): Promise<EvidencePin[]> {
    return this.pins.filter((p) => p.responseId === responseId).map(stripOwner);
  }

  async createReport(input: CreateReportInput) {
    const id = this.id('rep');
    this.reports.push({
      id,
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail ?? null,
      createdAt: this.now(),
    });
    return { id };
  }

  async countActions(kind: ActionKind, subject: string, since: Date) {
    return this.actions.filter(
      (a) => a.kind === kind && a.subject === subject && a.at >= since,
    ).length;
  }
  async recordAction(kind: ActionKind, subject: string, at: Date) {
    this.actions.push({ kind, subject, at });
  }

  /** Test helper: how many moderation reports are queued. */
  reportCount(): number {
    return this.reports.length;
  }
}

function stripOwner(
  p: EvidencePin & {
    investigationId: string | null;
    responseId: string | null;
  },
): EvidencePin {
  return {
    id: p.id,
    tokenId: p.tokenId,
    segmentId: p.segmentId ?? null,
    scheme: p.scheme,
    note: p.note ?? null,
    corpusVersion: p.corpusVersion,
  };
}
