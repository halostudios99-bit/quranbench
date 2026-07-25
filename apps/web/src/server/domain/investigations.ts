import { assertCanContribute } from './accounts';
import { CLAIM_MAX_LENGTH } from './config';
import type { CorpusGateway } from './corpus-gateway';
import { checkRateLimit } from './rate-limit';
import type { CreateInvestigationInput, Store } from './store';
import {
  isPublished,
  type Citation,
  type EvidencePin,
  type Investigation,
  type InvestigationRevision,
} from './types';

// ─── Creation ──────────────────────────────────────────────────────────────
// A new investigation is a DRAFT and is permissive: fields may be incomplete
// while the author works. Completeness is enforced only at the publish gate.
// Creating any content requires a recorded contributor-terms acceptance.

export interface CreateResult {
  investigation: Investigation;
}

export async function createInvestigation(
  store: Store,
  gateway: CorpusGateway,
  input: CreateInvestigationInput,
): Promise<Investigation> {
  await assertCanContribute(store, input.authorId);
  if (input.claim.length > CLAIM_MAX_LENGTH)
    throw new Error(`Claim must be ${CLAIM_MAX_LENGTH} characters or fewer.`);

  const investigation = await store.createInvestigation(input, gateway.version);
  await store.addRevision({
    investigationId: investigation.id,
    authorId: input.authorId,
    claim: investigation.claim,
    query: investigation.query,
    counterEvidence: investigation.counterEvidence,
    status: investigation.status,
    note: 'created',
  });
  return investigation;
}

// ─── Read visibility ─────────────────────────────────────────────────────────
// A published investigation is visible to everyone. A non-published one (DRAFT,
// WITHDRAWN) is visible ONLY to its author. Everyone else — anonymous or a
// different signed-in user — is treated exactly as if the row did not exist, so
// existence is never leaked by the slug.

export function canViewInvestigation(
  investigation: Pick<Investigation, 'status' | 'authorId'>,
  viewerId: string | null,
): boolean {
  return isPublished(investigation.status) || investigation.authorId === viewerId;
}

// ─── Evidence resolution ─────────────────────────────────────────────────────
// Pins resolve through the corpus by token id. A pin that cannot resolve against
// the loaded corpus version flags the investigation for review — it is never
// silently dropped and never fails the operation.

export interface PinResolution {
  pin: EvidencePin;
  resolved: boolean;
  resolvedTokenId: string;
}

export interface EvidenceResolution {
  resolutions: PinResolution[];
  unresolved: PinResolution[];
  flagged: boolean;
  reason: string | null;
}

export function resolvePins(
  gateway: CorpusGateway,
  pins: EvidencePin[],
): EvidenceResolution {
  const resolutions: PinResolution[] = pins.map((pin) => {
    const r = gateway.resolveToken(pin.tokenId);
    return { pin, resolved: r.resolved, resolvedTokenId: r.tokenId };
  });
  const unresolved = resolutions.filter((r) => !r.resolved);
  const flagged = unresolved.length > 0;
  const reason = flagged
    ? `${unresolved.length} evidence pin${unresolved.length === 1 ? '' : 's'} ` +
      `could not be resolved against corpus v${gateway.version} and need review.`
    : null;
  return { resolutions, unresolved, flagged, reason };
}

/** Resolve an investigation's pins and persist the review flag, never dropping. */
export async function reviewEvidence(
  store: Store,
  gateway: CorpusGateway,
  investigationId: string,
): Promise<EvidenceResolution> {
  const pins = await store.listInvestigationPins(investigationId);
  const resolution = resolvePins(gateway, pins);
  await store.updateInvestigationHead(investigationId, {
    flaggedForReview: resolution.flagged,
    reviewReason: resolution.reason,
  });
  return resolution;
}

// ─── The publish gate ─────────────────────────────────────────────────────────
// Enforced here in the data layer, not in a form. Any caller that publishes —
// the web action, a script, a future API — goes through this and cannot bypass
// the checks. Order: claim present and one sentence; counter-evidence present;
// query parses, executes and returns a non-empty result. Only then does status
// move to OPEN and a revision + the citation projection get written.

export type PublishCode =
  | 'not_found'
  | 'terms'
  | 'unverified'
  | 'rate_limited'
  | 'claim'
  | 'counter_evidence'
  | 'query';

export type PublishResult =
  | { ok: true; investigation: Investigation; flaggedForReview: boolean }
  | { ok: false; code: PublishCode; message: string };

export interface PublishInput {
  investigationId: string;
  actorId: string;
}

export async function publishInvestigation(
  store: Store,
  gateway: CorpusGateway,
  input: PublishInput,
  now: Date = new Date(),
): Promise<PublishResult> {
  const investigation = await store.getInvestigation(input.investigationId);
  if (!investigation)
    return { ok: false, code: 'not_found', message: 'Investigation not found.' };

  if (!(await store.hasAcceptedTerms(input.actorId)))
    return {
      ok: false,
      code: 'terms',
      message: 'Contributor terms must be accepted before publishing.',
    };

  // Email verification is a publish prerequisite: an unverified author may draft
  // freely but cannot make anything public.
  const actor = await store.getUser(input.actorId);
  if (!actor?.emailVerified)
    return {
      ok: false,
      code: 'unverified',
      message: 'Verify your email address before publishing.',
    };

  const claim = investigation.claim.trim();
  if (claim.length === 0)
    return {
      ok: false,
      code: 'claim',
      message: 'A claim is required: state the investigation in one sentence.',
    };
  if (claim.length > CLAIM_MAX_LENGTH)
    return {
      ok: false,
      code: 'claim',
      message: `The claim must be ${CLAIM_MAX_LENGTH} characters or fewer.`,
    };

  if (investigation.counterEvidence.trim().length === 0)
    return {
      ok: false,
      code: 'counter_evidence',
      message:
        'Counter-evidence is required. State what would tell against the claim.',
    };

  const run = gateway.runQuery(investigation.query);
  if (!run.ok)
    return {
      ok: false,
      code: 'query',
      message: `The attached query does not parse: ${run.error ?? 'invalid query'}.`,
    };
  if (run.count === 0)
    return {
      ok: false,
      code: 'query',
      message:
        'The attached query returns no results. A published investigation must rest on a query that executes and matches.',
    };

  const limit = await checkRateLimit(store, 'PUBLISH', input.actorId, now);
  if (!limit.ok)
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Publish rate limit reached. Try again later.',
    };

  // Resolve pins: flag for review if any fail, but publish proceeds — the pins
  // are kept, never dropped.
  const pins = await store.listInvestigationPins(investigation.id);
  const resolution = resolvePins(gateway, pins);

  const published = await store.updateInvestigationHead(investigation.id, {
    status: 'OPEN',
    publishedAt: now,
    flaggedForReview: resolution.flagged,
    reviewReason: resolution.reason,
  });
  await store.addRevision({
    investigationId: investigation.id,
    authorId: input.actorId,
    claim: published.claim,
    query: published.query,
    counterEvidence: published.counterEvidence,
    status: published.status,
    note: 'published',
  });
  await store.replaceCitations(
    investigation.id,
    citationsFor(investigation.id, gateway, pins),
  );

  return { ok: true, investigation: published, flaggedForReview: resolution.flagged };
}

/** Project an investigation's pins to the deduped citation rows for lookup. */
function citationsFor(
  investigationId: string,
  gateway: CorpusGateway,
  pins: EvidencePin[],
): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const pin of pins) {
    for (const target of gateway.citationTargets(pin.tokenId)) {
      const dedupe = `${target.kind}:${target.key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        investigationId,
        kind: target.kind,
        key: target.key,
        corpusVersion: gateway.version,
      });
    }
  }
  return out;
}

// ─── Revision (append-only edit) ──────────────────────────────────────────────
// Editing a published investigation never overwrites: it appends a revision and
// moves the head, and the prior revisions remain readable in the public history.

export interface ReviseInput {
  investigationId: string;
  actorId: string;
  claim?: string;
  query?: string;
  counterEvidence?: string;
  note?: string;
}

export async function reviseInvestigation(
  store: Store,
  _gateway: CorpusGateway,
  input: ReviseInput,
): Promise<Investigation> {
  await assertCanContribute(store, input.actorId);
  const current = await store.getInvestigation(input.investigationId);
  if (!current) throw new Error('Investigation not found.');

  const next = {
    claim: input.claim ?? current.claim,
    query: input.query ?? current.query,
    counterEvidence: input.counterEvidence ?? current.counterEvidence,
  };
  if (next.claim.length > CLAIM_MAX_LENGTH)
    throw new Error(`Claim must be ${CLAIM_MAX_LENGTH} characters or fewer.`);

  // A published investigation that is edited becomes REVISED; a draft stays DRAFT.
  const status: Investigation['status'] =
    current.status === 'DRAFT' ? 'DRAFT' : 'REVISED';

  const updated = await store.updateInvestigationHead(input.investigationId, {
    ...next,
    status,
  });
  await store.addRevision({
    investigationId: updated.id,
    authorId: input.actorId,
    claim: updated.claim,
    query: updated.query,
    counterEvidence: updated.counterEvidence,
    status: updated.status,
    note: input.note ?? 'revised',
  });
  return updated;
}

export async function listRevisions(
  store: Store,
  investigationId: string,
): Promise<InvestigationRevision[]> {
  return store.listRevisions(investigationId);
}
