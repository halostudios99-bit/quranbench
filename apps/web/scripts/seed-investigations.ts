// Part C: seed the 18 archived articles as *draft* Investigations authored by a
// seed account. Clearly separated from production code (a one-off script), and
// idempotent — re-running updates in place, never duplicates.
//
// Every seeded investigation is a DRAFT. It gets:
//   • a claim extracted from the title/opening (else left empty and flagged),
//   • the article prose preserved in `body`,
//   • evidence pins for every verse reference that VERIFIED in the audit,
//   • an empty query and empty counter-evidence — the owner must supply these;
//     the publish gate (src/server/domain/investigations.ts) enforces all three
//     before anything can go live. Nothing here publishes.
//   • an audit record: the full flagged-claim list in `reviewReason` (shown to
//     the author on their draft) plus per-verse EDITORIAL `audit` annotations.
//
// Two modes:
//   --plan   (default) build the plan and write seed/plan.json. No database.
//   --commit perform the inserts. Requires Postgres + `prisma generate` +
//            `prisma migrate deploy`. Run with the app's TS tooling, e.g.:
//              node --experimental-transform-types \
//                --import ./scripts/ts-register.mjs \
//                apps/web/scripts/seed-investigations.ts --commit
//
// The seeded prose comes from the quranandfaith.com archive (2017–2020); the
// audit that annotates it is @quranbench/audit against the versioned corpus.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '@quranbench/corpus';
import { resolveReference, searchString } from '@quranbench/search';
import {
  auditArticle,
  createContext,
  verifiedEvidence,
  type AuditContext,
  type ArticleReport,
} from '@quranbench/audit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const ARTICLES_DIR = path.resolve(REPO_ROOT, '../quranandfaith-export');
const OUT_DIR = path.resolve(REPO_ROOT, 'seed');

const SEED_AUTHOR = {
  email: 'seed@quranbench.local',
  handle: 'seed',
  displayName: 'Archive import — quranandfaith.com (2017–2020)',
  // A fixed placeholder; the seed account cannot sign in until the owner resets
  // it. Content creation only needs a recorded terms acceptance, not a login.
  password: 'seed-account-not-for-login',
};

export interface SeedPin {
  tokenId: string;
  segmentId: string;
  note: string;
}

export interface SeedAnnotation {
  actor: 'EDITORIAL';
  type: 'audit';
  targetType: 'SEGMENT';
  targetKey: string;
  value: string;
}

export interface SeedInvestigation {
  slug: string;
  title: string;
  claim: string;
  claimExtracted: boolean;
  query: string;
  counterEvidence: string;
  body: string;
  flaggedForReview: boolean;
  reviewReason: string;
  pins: SeedPin[];
  annotations: SeedAnnotation[];
}

const CLAIM_MAX = 280;

/** Pull a declarative one-sentence claim from the opening prose, or signal none. */
export function extractClaim(markdown: string): { claim: string; extracted: boolean } {
  const skip =
    /^\s*$|^#|^_.*_\s*$|slug:|^in the name of allah|^under construction|^live chat|click here/i;
  let inBox = false;
  for (const raw of markdown.split('\n')) {
    // Never draw a claim from inside a [box] — those hold Quranic text and its
    // translation, which must never be presented as an editorial claim.
    const opens = raw.includes('[box]');
    const closes = raw.includes('[/box]');
    if (inBox) {
      if (closes) inBox = false;
      continue;
    }
    if (opens) {
      inBox = !closes;
      continue;
    }
    if (skip.test(raw.trim())) continue;
    // Drop shortcodes ([box], [simple_tooltip …]) and Arabic — a claim is prose.
    const clean = raw
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length < 20) continue; // headings and one-word lines
    const sentence = (clean.match(/^.*?[.!](?:\s|$)/)?.[0] ?? clean).trim();
    // Skip questions and section headings; keep declarative sentences only.
    if (sentence.endsWith('?')) continue;
    if (sentence.length >= 20 && sentence.length <= CLAIM_MAX) {
      return { claim: sentence, extracted: true };
    }
  }
  return { claim: '', extracted: false };
}

/** First token id of each distinct verified segment — one anchor pin per verse. */
function pinsFromEvidence(report: ArticleReport): SeedPin[] {
  const bySegment = new Map<string, SeedPin>();
  for (const ev of verifiedEvidence(report)) {
    for (const seg of ev.segmentIds) {
      if (bySegment.has(seg)) continue;
      const anchor = ev.tokenIds.find((t: string) => t.startsWith(seg + ':'));
      if (anchor) bySegment.set(seg, { tokenId: anchor, segmentId: seg, note: `verse ${ev.reference}` });
    }
  }
  return [...bySegment.values()];
}

function auditAnnotations(ctx: AuditContext, slug: string, report: ArticleReport): SeedAnnotation[] {
  const out: SeedAnnotation[] = [];
  const seen = new Set<string>();
  for (const f of report.findings) {
    if (f.status !== 'flagged' || !f.reference) continue;
    const segs = resolveReference(ctx.index, f.reference);
    if (!segs || segs.length === 0) continue;
    for (const seg of segs) {
      const key = `${seg.id}|${f.summary}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        actor: 'EDITORIAL',
        type: 'audit',
        targetType: 'SEGMENT',
        targetKey: seg.id,
        value: `[${slug}] ${f.summary}`,
      });
    }
  }
  return out;
}

function reviewReason(report: ArticleReport, claim: { claim: string; extracted: boolean }): string {
  const lines: string[] = [];
  lines.push(
    `Seeded from the quranandfaith.com archive and audited automatically against corpus ${report.corpusVersion}. This is a DRAFT: before it can be published, supply a claim, a reproducible query, and counter-evidence — the publish gate enforces all three.`,
  );
  lines.push(
    claim.extracted
      ? `Claim drafted from the opening: "${claim.claim}" — confirm or rewrite it.`
      : `CLAIM NOT EXTRACTED — write one falsifiable sentence.`,
  );
  const flagged = report.findings.filter((f) => f.status === 'flagged');
  const unchecked = report.findings.filter((f) => f.status === 'unchecked');
  if (flagged.length) {
    lines.push(`Flagged by the audit (${flagged.length}) — resolve before publishing:`);
    for (const f of flagged) lines.push(`• [${f.severity}] ${f.summary} (line ${f.location.line})`);
  } else {
    lines.push('The audit flagged nothing in this article.');
  }
  if (unchecked.length) {
    lines.push(`Could not be checked automatically (${unchecked.length}):`);
    for (const f of unchecked) lines.push(`• ${f.summary} (line ${f.location.line})`);
  }
  return lines.join('\n');
}

export function buildSeedPlan(
  ctx: AuditContext,
  articles: { file: string; markdown: string }[],
): SeedInvestigation[] {
  return articles.map(({ file, markdown }) => {
    const report = auditArticle(ctx, { file, markdown });
    const claim = extractClaim(markdown);
    return {
      slug: report.slug,
      title: report.title,
      claim: claim.claim,
      claimExtracted: claim.extracted,
      query: '',
      counterEvidence: '',
      body: markdown,
      flaggedForReview: true,
      reviewReason: reviewReason(report, claim),
      pins: pinsFromEvidence(report),
      annotations: auditAnnotations(ctx, report.slug, report),
    };
  });
}

function readArticles(): { file: string; markdown: string }[] {
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => ({ file, markdown: readFileSync(path.join(ARTICLES_DIR, file), 'utf8') }));
}

function writePlan(plan: SeedInvestigation[]): void {
  mkdirSync(OUT_DIR, { recursive: true });
  // Keep the plan readable: bodies are large, so record their size, not the prose.
  const readable = plan.map((s) => ({
    ...s,
    body: `«${s.body.length} chars of preserved prose»`,
  }));
  writeFileSync(path.join(OUT_DIR, 'plan.json'), JSON.stringify({ author: SEED_AUTHOR.handle, investigations: readable }, null, 2) + '\n');
  const totals = plan.reduce(
    (a, s) => ({
      pins: a.pins + s.pins.length,
      annotations: a.annotations + s.annotations.length,
      claims: a.claims + (s.claimExtracted ? 1 : 0),
    }),
    { pins: 0, annotations: 0, claims: 0 },
  );
  console.log(
    `Seed plan for ${plan.length} draft investigations → ${path.join(OUT_DIR, 'plan.json')}\n` +
      `  ${totals.claims}/${plan.length} claims auto-drafted · ${totals.pins} evidence pins · ${totals.annotations} audit annotations\n` +
      '  (nothing published; every one is a draft awaiting the owner)',
  );
}

async function commit(ctx: AuditContext, plan: SeedInvestigation[]): Promise<void> {
  // Imported lazily so --plan needs neither the Prisma client nor a database.
  const { PrismaClient } = await import('@prisma/client');
  const { createAccount } = await import('../src/server/domain/accounts.js');
  const { createInvestigation } = await import('../src/server/domain/investigations.js');
  const { makeSeedStore } = await import('./seed-store.js');
  type CorpusGateway = import('../src/server/domain/corpus-gateway.js').CorpusGateway;

  const prisma = new PrismaClient();
  const store = makeSeedStore(prisma);
  const gateway: CorpusGateway = {
    version: ctx.version,
    runQuery(query: string) {
      const o = searchString(ctx.index, query);
      return o.ok ? { ok: true, count: o.result.totalMatches } : { ok: false, count: 0, error: o.error.message };
    },
    resolveToken: (tokenId: string) => ({ tokenId, resolved: ctx.index.byId.has(tokenId) }),
    citationTargets(tokenId: string) {
      const h = ctx.index.byId.get(tokenId);
      if (h === undefined) return [{ kind: 'TOKEN', key: tokenId }];
      const t = ctx.index.tokens[h]!;
      const targets: { kind: 'TOKEN' | 'SEGMENT' | 'SURAH' | 'ROOT'; key: string }[] = [
        { kind: 'TOKEN', key: t.id },
        { kind: 'SEGMENT', key: t.segment_id },
        { kind: 'SURAH', key: String(t.surah) },
      ];
      if (t.morphology.root_slug) targets.push({ kind: 'ROOT', key: t.morphology.root_slug });
      return targets;
    },
  };

  try {
    // Idempotent author: create once, reuse thereafter.
    let author = await store.getUserByHandle(SEED_AUTHOR.handle);
    if (!author) {
      const result = await createAccount(store, {
        email: SEED_AUTHOR.email,
        handle: SEED_AUTHOR.handle,
        password: SEED_AUTHOR.password,
        displayName: SEED_AUTHOR.displayName,
        acceptTermsVersion: '1.0.0',
        clientId: 'seed-script',
      });
      if (!result.ok) throw new Error(`Could not create seed author: ${result.message}`);
      author = result.user;
    }

    for (const inv of plan) {
      let existing = await store.getInvestigationBySlug(inv.slug);
      if (!existing) {
        existing = await createInvestigation(store, gateway, {
          authorId: author.id,
          slug: inv.slug,
          claim: inv.claim,
          query: inv.query,
          counterEvidence: inv.counterEvidence,
          pins: inv.pins.map((p) => ({ tokenId: p.tokenId, segmentId: p.segmentId, note: p.note })),
        });
      } else {
        await store.updateInvestigationHead(existing.id, { claim: inv.claim });
        await store.replaceInvestigationPins(
          existing.id,
          inv.pins.map((p) => ({ tokenId: p.tokenId, segmentId: p.segmentId, note: p.note })),
          ctx.version,
        );
      }

      // body / audit rollup live outside the domain input; set directly (draft only).
      await prisma.investigation.update({
        where: { id: existing.id },
        data: { body: inv.body, flaggedForReview: inv.flaggedForReview, reviewReason: inv.reviewReason },
      });

      // Idempotent audit annotations: clear this slug's, then rewrite.
      await prisma.annotation.deleteMany({
        where: { actor: 'EDITORIAL', type: 'audit', value: { startsWith: `[${inv.slug}] ` } },
      });
      if (inv.annotations.length) {
        await prisma.annotation.createMany({
          data: inv.annotations.map((a) => ({
            authorId: author!.id,
            actor: a.actor,
            type: a.type,
            targetType: a.targetType,
            targetKey: a.targetKey,
            value: a.value,
            corpusVersion: ctx.version,
          })),
        });
      }
      console.log(`  ✓ draft ${inv.slug} (${inv.pins.length} pins, ${inv.annotations.length} annotations)`);
    }
    console.log(`Seeded ${plan.length} drafts. None are published.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const ctx = createContext(loadCorpus());
  const plan = buildSeedPlan(ctx, readArticles());
  if (process.argv.includes('--commit')) await commit(ctx, plan);
  else writePlan(plan);
}

await main();
