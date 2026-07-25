import 'server-only';

import { prisma } from './db';
import type {
  AddRevisionInput,
  CreateInvestigationInput,
  CreateReportInput,
  CreateResponseInput,
  CreateUserInput,
  InvestigationHeadPatch,
  Store,
} from './domain/store';
import {
  PUBLISHED_STATUSES,
  type ActionKind,
  type Citation,
  type CitationKind,
  type CitingInvestigation,
  type EvidencePin,
  type EvidencePinInput,
  type Investigation,
  type InvestigationRevision,
  type Response,
  type User,
} from './domain/types';

// The production Store: a thin adapter over Prisma. The domain enum string values
// are identical to the Prisma enums, so mapping a row to a domain object is a
// field copy, never a translation. All business rules live in the domain layer;
// this file only persists.

type Row = Record<string, unknown>;

function toUser(r: Row): User {
  return {
    id: r.id as string,
    email: r.email as string,
    handle: r.handle as string,
    displayName: (r.displayName as string | null) ?? null,
    emailVerified: (r.emailVerified as Date | null) ?? null,
    createdAt: r.createdAt as Date,
  };
}

function toInvestigation(r: Row): Investigation {
  return {
    id: r.id as string,
    authorId: r.authorId as string,
    slug: r.slug as string,
    claim: r.claim as string,
    query: r.query as string,
    counterEvidence: r.counterEvidence as string,
    status: r.status as Investigation['status'],
    flaggedForReview: r.flaggedForReview as boolean,
    reviewReason: (r.reviewReason as string | null) ?? null,
    publishedAt: (r.publishedAt as Date | null) ?? null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  };
}

function toPin(r: Row): EvidencePin {
  return {
    id: r.id as string,
    tokenId: r.tokenId as string,
    segmentId: (r.segmentId as string | null) ?? null,
    scheme: r.scheme as string,
    note: (r.note as string | null) ?? null,
    corpusVersion: r.corpusVersion as string,
  };
}

function toRevision(r: Row): InvestigationRevision {
  return {
    id: r.id as string,
    investigationId: r.investigationId as string,
    revision: r.revision as number,
    authorId: r.authorId as string,
    claim: r.claim as string,
    query: r.query as string,
    counterEvidence: r.counterEvidence as string,
    status: r.status as Investigation['status'],
    note: (r.note as string | null) ?? null,
    createdAt: r.createdAt as Date,
  };
}

function toResponse(r: Row): Response {
  return {
    id: r.id as string,
    investigationId: r.investigationId as string,
    authorId: r.authorId as string,
    type: r.type as Response['type'],
    body: r.body as string,
    createdAt: r.createdAt as Date,
  };
}

export const prismaStore: Store = {
  async createUser(input: CreateUserInput) {
    return toUser(await prisma.user.create({ data: input }));
  },
  async getUser(id) {
    const r = await prisma.user.findUnique({ where: { id } });
    return r ? toUser(r) : null;
  },
  async getUserByEmail(email) {
    const r = await prisma.user.findUnique({ where: { email } });
    return r ? toUser(r) : null;
  },
  async getUserByHandle(handle) {
    const r = await prisma.user.findUnique({ where: { handle } });
    return r ? toUser(r) : null;
  },
  async recordTermsAcceptance(userId, version, acceptedAt) {
    await prisma.contributorTermsAcceptance.upsert({
      where: { userId_version: { userId, version } },
      create: { userId, version, acceptedAt },
      update: {},
    });
  },
  async hasAcceptedTerms(userId) {
    const count = await prisma.contributorTermsAcceptance.count({
      where: { userId },
    });
    return count > 0;
  },
  async listTermsAcceptances(userId) {
    const rows = await prisma.contributorTermsAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    });
    return rows.map((r) => ({ version: r.version, acceptedAt: r.acceptedAt }));
  },
  async findCredential(email) {
    const r = await prisma.user.findUnique({ where: { email } });
    if (!r) return null;
    return { user: toUser(r), passwordHash: r.passwordHash as string };
  },
  async markEmailVerified(userId, verifiedAt) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: verifiedAt },
    });
  },

  async createSession(userId, tokenHash, expiresAt) {
    await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  },
  async getSession(tokenHash) {
    const r = await prisma.session.findUnique({ where: { tokenHash } });
    return r ? { userId: r.userId, expiresAt: r.expiresAt } : null;
  },
  async deleteSession(tokenHash) {
    await prisma.session.deleteMany({ where: { tokenHash } });
  },
  async deleteUserSessions(userId) {
    await prisma.session.deleteMany({ where: { userId } });
  },

  async createEmailVerificationToken(userId, tokenHash, expiresAt) {
    await prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  },
  async consumeEmailVerificationToken(tokenHash, now) {
    const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    await prisma.emailVerificationToken.delete({ where: { tokenHash } });
    if (row.expiresAt.getTime() <= now.getTime()) return null;
    return row.userId;
  },

  async createInvestigation(input: CreateInvestigationInput, corpusVersion) {
    const created = await prisma.investigation.create({
      data: {
        authorId: input.authorId,
        slug: input.slug,
        claim: input.claim,
        query: input.query,
        counterEvidence: input.counterEvidence,
        status: 'DRAFT',
        pins: {
          create: input.pins.map((p) => ({
            tokenId: p.tokenId,
            segmentId: p.segmentId ?? null,
            scheme: p.scheme ?? 'tanzil-uthmani',
            note: p.note ?? null,
            corpusVersion,
          })),
        },
      },
    });
    return toInvestigation(created);
  },
  async getInvestigation(id) {
    const r = await prisma.investigation.findUnique({ where: { id } });
    return r ? toInvestigation(r) : null;
  },
  async getInvestigationBySlug(slug) {
    const r = await prisma.investigation.findUnique({ where: { slug } });
    return r ? toInvestigation(r) : null;
  },
  async listInvestigations(statuses) {
    const rows = await prisma.investigation.findMany({
      where: { status: { in: statuses } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toInvestigation);
  },
  async listInvestigationsByAuthor(authorId) {
    const rows = await prisma.investigation.findMany({
      where: { authorId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toInvestigation);
  },
  async updateInvestigationHead(id, patch: InvestigationHeadPatch) {
    const r = await prisma.investigation.update({ where: { id }, data: patch });
    return toInvestigation(r);
  },
  async replaceInvestigationPins(investigationId, pins: EvidencePinInput[], corpusVersion) {
    await prisma.$transaction([
      prisma.evidencePin.deleteMany({ where: { investigationId } }),
      prisma.evidencePin.createMany({
        data: pins.map((p) => ({
          investigationId,
          tokenId: p.tokenId,
          segmentId: p.segmentId ?? null,
          scheme: p.scheme ?? 'tanzil-uthmani',
          note: p.note ?? null,
          corpusVersion,
        })),
      }),
    ]);
  },
  async listInvestigationPins(investigationId) {
    const rows = await prisma.evidencePin.findMany({
      where: { investigationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toPin);
  },

  async addRevision(input: AddRevisionInput) {
    const next = await prisma.investigationRevision.count({
      where: { investigationId: input.investigationId },
    });
    const r = await prisma.investigationRevision.create({
      data: {
        investigationId: input.investigationId,
        revision: next + 1,
        authorId: input.authorId,
        claim: input.claim,
        query: input.query,
        counterEvidence: input.counterEvidence,
        status: input.status,
        note: input.note ?? null,
      },
    });
    return toRevision(r);
  },
  async listRevisions(investigationId) {
    const rows = await prisma.investigationRevision.findMany({
      where: { investigationId },
      orderBy: { revision: 'asc' },
    });
    return rows.map(toRevision);
  },

  async replaceCitations(investigationId, citations: Citation[]) {
    await prisma.$transaction([
      prisma.citation.deleteMany({ where: { investigationId } }),
      prisma.citation.createMany({
        data: citations.map((c) => ({
          investigationId,
          kind: c.kind,
          key: c.key,
          corpusVersion: c.corpusVersion,
        })),
      }),
    ]);
  },
  async findCitingInvestigations(kind: CitationKind, key: string): Promise<CitingInvestigation[]> {
    const rows = await prisma.citation.findMany({
      where: {
        kind,
        key,
        investigation: { status: { in: PUBLISHED_STATUSES } },
      },
      include: { investigation: { include: { author: { select: { handle: true } } } } },
      orderBy: { investigation: { publishedAt: 'desc' } },
    });
    return rows.map((row) => {
      const inv = row.investigation;
      return {
        id: inv.id,
        slug: inv.slug,
        claim: inv.claim,
        status: inv.status as Investigation['status'],
        authorHandle: inv.author.handle,
        publishedAt: inv.publishedAt,
      };
    });
  },

  async createResponse(input: CreateResponseInput, corpusVersion) {
    const r = await prisma.response.create({
      data: {
        investigationId: input.investigationId,
        authorId: input.authorId,
        type: input.type,
        body: input.body,
        pins: {
          create: input.pins.map((p) => ({
            tokenId: p.tokenId,
            segmentId: p.segmentId ?? null,
            scheme: p.scheme ?? 'tanzil-uthmani',
            note: p.note ?? null,
            corpusVersion,
          })),
        },
      },
    });
    return toResponse(r);
  },
  async listResponses(investigationId) {
    const rows = await prisma.response.findMany({
      where: { investigationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toResponse);
  },
  async listResponsePins(responseId) {
    const rows = await prisma.evidencePin.findMany({
      where: { responseId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toPin);
  },

  async createReport(input: CreateReportInput) {
    const r = await prisma.moderationReport.create({
      data: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        detail: input.detail ?? null,
      },
    });
    return { id: r.id };
  },

  async countActions(kind: ActionKind, subject, since) {
    return prisma.actionEvent.count({
      where: { kind, subject, createdAt: { gte: since } },
    });
  },
  async recordAction(kind: ActionKind, subject, at) {
    await prisma.actionEvent.create({ data: { kind, subject, createdAt: at } });
  },
};
