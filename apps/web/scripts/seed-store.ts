// A minimal Store adapter over a plain PrismaClient, for the seed script only.
// It implements just the methods createAccount + createInvestigation (and the
// idempotent updates in seed-investigations.ts) actually call. The production
// adapter (src/server/store-prisma.ts) is `server-only` and cannot be imported
// into a standalone script, so this reuses the *domain logic* (the terms gate,
// append-only revisions) without reusing the server-only wiring.
//
// Not production code. Unimplemented Store methods throw if ever reached.

import type { PrismaClient } from '@prisma/client';
import type {
  AddRevisionInput,
  CreateInvestigationInput,
  CreateUserInput,
  InvestigationHeadPatch,
  Store,
} from '../src/server/domain/store.js';
import type {
  ActionKind,
  EvidencePin,
  EvidencePinInput,
  Investigation,
  InvestigationRevision,
  User,
} from '../src/server/domain/types.js';

type Row = Record<string, unknown>;

function toUser(u: Row): User {
  return {
    id: u.id as string,
    email: u.email as string,
    handle: u.handle as string,
    displayName: (u.displayName as string | null) ?? null,
    emailVerified: (u.emailVerified as Date | null) ?? null,
    createdAt: u.createdAt as Date,
  };
}

function toInvestigation(i: Row): Investigation {
  return {
    id: i.id as string,
    authorId: i.authorId as string,
    slug: i.slug as string,
    claim: i.claim as string,
    query: i.query as string,
    counterEvidence: i.counterEvidence as string,
    status: i.status as Investigation['status'],
    flaggedForReview: i.flaggedForReview as boolean,
    reviewReason: (i.reviewReason as string | null) ?? null,
    publishedAt: (i.publishedAt as Date | null) ?? null,
    createdAt: i.createdAt as Date,
    updatedAt: i.updatedAt as Date,
  };
}

const unsupported =
  (name: string) =>
  (): never => {
    throw new Error(`seed-store: ${name} is not implemented (not needed for seeding).`);
  };

export function makeSeedStore(prisma: PrismaClient): Store {
  const store: Partial<Store> = {
    async createUser(input: CreateUserInput): Promise<User> {
      const u = await prisma.user.create({
        data: {
          email: input.email,
          handle: input.handle,
          displayName: input.displayName ?? null,
          passwordHash: input.passwordHash,
        },
      });
      return toUser(u as Row);
    },
    async getUser(id: string): Promise<User | null> {
      const u = await prisma.user.findUnique({ where: { id } });
      return u ? toUser(u as Row) : null;
    },
    async getUserByEmail(email: string): Promise<User | null> {
      const u = await prisma.user.findUnique({ where: { email } });
      return u ? toUser(u as Row) : null;
    },
    async getUserByHandle(handle: string): Promise<User | null> {
      const u = await prisma.user.findUnique({ where: { handle } });
      return u ? toUser(u as Row) : null;
    },
    async recordTermsAcceptance(userId: string, version: string, acceptedAt: Date): Promise<void> {
      await prisma.contributorTermsAcceptance.upsert({
        where: { userId_version: { userId, version } },
        create: { userId, version, acceptedAt },
        update: {},
      });
    },
    async hasAcceptedTerms(userId: string): Promise<boolean> {
      const n = await prisma.contributorTermsAcceptance.count({ where: { userId } });
      return n > 0;
    },
    async markEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
      await prisma.user.update({ where: { id: userId }, data: { emailVerified: verifiedAt } });
    },

    async createInvestigation(
      input: CreateInvestigationInput,
      corpusVersion: string,
    ): Promise<Investigation> {
      const created = await prisma.investigation.create({
        data: {
          authorId: input.authorId,
          slug: input.slug,
          claim: input.claim,
          query: input.query,
          counterEvidence: input.counterEvidence,
          status: 'DRAFT',
          pins: {
            create: input.pins.map((p: EvidencePinInput) => ({
              tokenId: p.tokenId,
              segmentId: p.segmentId ?? null,
              scheme: p.scheme ?? 'tanzil-uthmani',
              corpusVersion,
              note: p.note ?? null,
            })),
          },
        },
      });
      return toInvestigation(created as Row);
    },
    async getInvestigationBySlug(slug: string): Promise<Investigation | null> {
      const i = await prisma.investigation.findUnique({ where: { slug } });
      return i ? toInvestigation(i as Row) : null;
    },
    async updateInvestigationHead(id: string, patch: InvestigationHeadPatch): Promise<Investigation> {
      const i = await prisma.investigation.update({ where: { id }, data: patch });
      return toInvestigation(i as Row);
    },
    async replaceInvestigationPins(
      investigationId: string,
      pins: EvidencePinInput[],
      corpusVersion: string,
    ): Promise<void> {
      await prisma.$transaction([
        prisma.evidencePin.deleteMany({ where: { investigationId } }),
        prisma.evidencePin.createMany({
          data: pins.map((p) => ({
            investigationId,
            tokenId: p.tokenId,
            segmentId: p.segmentId ?? null,
            scheme: p.scheme ?? 'tanzil-uthmani',
            corpusVersion,
            note: p.note ?? null,
          })),
        }),
      ]);
    },
    async listInvestigationPins(investigationId: string): Promise<EvidencePin[]> {
      const rows = await prisma.evidencePin.findMany({ where: { investigationId } });
      return rows.map((p: Row) => ({
        id: p.id as string,
        tokenId: p.tokenId as string,
        segmentId: (p.segmentId as string | null) ?? null,
        scheme: p.scheme as string,
        note: (p.note as string | null) ?? null,
        corpusVersion: p.corpusVersion as string,
      }));
    },
    async addRevision(input: AddRevisionInput): Promise<InvestigationRevision> {
      const count = await prisma.investigationRevision.count({
        where: { investigationId: input.investigationId },
      });
      const r = await prisma.investigationRevision.create({
        data: {
          investigationId: input.investigationId,
          revision: count + 1,
          authorId: input.authorId,
          claim: input.claim,
          query: input.query,
          counterEvidence: input.counterEvidence,
          status: input.status,
          note: input.note ?? null,
        },
      });
      return {
        id: r.id as string,
        investigationId: r.investigationId as string,
        revision: r.revision as number,
        authorId: r.authorId as string,
        claim: r.claim as string,
        query: r.query as string,
        counterEvidence: r.counterEvidence as string,
        status: r.status as InvestigationRevision['status'],
        note: (r.note as string | null) ?? null,
        createdAt: r.createdAt as Date,
      };
    },

    async countActions(kind: ActionKind, subject: string, since: Date): Promise<number> {
      return prisma.actionEvent.count({ where: { kind, subject, createdAt: { gte: since } } });
    },
    async recordAction(kind: ActionKind, subject: string, at: Date): Promise<void> {
      await prisma.actionEvent.create({ data: { kind, subject, createdAt: at } });
    },
  };

  return new Proxy(store as Store, {
    get(target, prop: string) {
      return (target as unknown as Record<string, unknown>)[prop] ?? unsupported(prop);
    },
  });
}
