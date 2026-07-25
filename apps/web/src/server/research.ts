import 'server-only';

import { corpusGateway } from './corpus-gateway';
import { getToken } from './corpus';
import * as accounts from './domain/accounts';
import { CONTRIBUTOR_TERMS_VERSION } from './domain/config';
import * as investigations from './domain/investigations';
import * as moderation from './domain/moderation';
import * as responses from './domain/responses';
import type {
  CreateInvestigationInput,
  CreateReportInput,
  CreateResponseInput,
  Store,
} from './domain/store';
import {
  PUBLISHED_STATUSES,
  type CitationKind,
  type CitingInvestigation,
  type EvidencePin,
  type Investigation,
  type InvestigationRevision,
  type Response,
} from './domain/types';
import { tokenRefLabel, wordHref } from '@/lib/addressing';
import { prismaStore } from './store-prisma';

// The wiring seam. Routes import from here; this is the one place that binds the
// pure domain rules to the production Store (Prisma) and CorpusGateway (the
// in-memory index). Business rules stay in domain/*; this file only supplies the
// dependencies and shapes results for rendering.

const store: Store = prismaStore;
export const CURRENT_TERMS_VERSION = CONTRIBUTOR_TERMS_VERSION;

// Reads used by public corpus pages must never take the site down if the
// application database is unavailable. A failed lookup degrades to "no citations"
// or "no investigations", never a 500 on a word or verse page.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test')
      console.error('[research] read failed, degrading:', err);
    return fallback;
  }
}

// ─── Write paths (server actions call these) ──────────────────────────────────

export function createAccount(input: accounts.CreateAccountInput) {
  return accounts.createAccount(store, input);
}

export function createInvestigation(input: CreateInvestigationInput) {
  return investigations.createInvestigation(store, corpusGateway, input);
}

export function publishInvestigation(input: investigations.PublishInput) {
  return investigations.publishInvestigation(store, corpusGateway, input);
}

export function reviseInvestigation(input: investigations.ReviseInput) {
  return investigations.reviseInvestigation(store, corpusGateway, input);
}

export function respond(input: CreateResponseInput) {
  return responses.createResponse(store, corpusGateway, input);
}

export function report(input: CreateReportInput & { clientId: string }) {
  return moderation.reportContent(store, input);
}

// ─── Read paths (pages call these) ────────────────────────────────────────────

export function listPublishedInvestigations(): Promise<Investigation[]> {
  return safe(() => store.listInvestigations(PUBLISHED_STATUSES), []);
}

/** Citing investigations for a corpus target — the bidirectional-link query. */
export function citingInvestigations(
  kind: CitationKind,
  key: string,
): Promise<CitingInvestigation[]> {
  return safe(() => store.findCitingInvestigations(kind, key), []);
}

export interface ResolvedPin {
  pin: EvidencePin;
  resolved: boolean;
  ref: string | null;
  href: string | null;
  text: string | null;
}

/** Resolve pins for display: each becomes a corpus reference or is marked
 *  unresolved — never dropped. */
function resolvePinsForDisplay(pins: EvidencePin[]): ResolvedPin[] {
  return pins.map((pin) => {
    const token = getToken(pin.tokenId);
    if (!token) return { pin, resolved: false, ref: null, href: null, text: null };
    return {
      pin,
      resolved: true,
      ref: tokenRefLabel(token.surah, ordinalFor(token), token.position),
      href: wordHref(token.id),
      text: token.text_uthmani,
    };
  });
}

function ordinalFor(token: { segment_id: string }): number | null {
  const m = /:(\d+):(\d+)$/.exec(token.segment_id);
  return m ? Number(m[2]) : null;
}

export interface InvestigationView {
  investigation: Investigation;
  authorHandle: string;
  pins: ResolvedPin[];
  responses: { response: Response; pins: ResolvedPin[] }[];
  revisions: InvestigationRevision[];
  queryResult: { ok: boolean; count: number; error?: string };
  corpusVersion: string;
}

export async function getInvestigationView(
  slug: string,
): Promise<InvestigationView | null> {
  const investigation = await safe(
    () => store.getInvestigationBySlug(slug),
    null,
  );
  if (!investigation) return null;

  const [author, pins, responseRows, revisions] = await Promise.all([
    safe(() => store.getUser(investigation.authorId), null),
    safe(() => store.listInvestigationPins(investigation.id), []),
    safe(() => store.listResponses(investigation.id), []),
    safe(() => store.listRevisions(investigation.id), []),
  ]);

  const responsesWithPins = await Promise.all(
    responseRows.map(async (response) => ({
      response,
      pins: resolvePinsForDisplay(
        await safe(() => store.listResponsePins(response.id), []),
      ),
    })),
  );

  return {
    investigation,
    authorHandle: author?.handle ?? 'unknown',
    pins: resolvePinsForDisplay(pins),
    responses: responsesWithPins,
    revisions,
    queryResult: corpusGateway.runQuery(investigation.query),
    corpusVersion: corpusGateway.version,
  };
}
