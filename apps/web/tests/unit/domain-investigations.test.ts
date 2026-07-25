import { beforeEach, describe, expect, it } from 'vitest';

import { assertCanContribute, TermsNotAcceptedError } from '@/server/domain/accounts';
import { CONTRIBUTOR_TERMS_VERSION } from '@/server/domain/config';
import type {
  CitationTarget,
  CorpusGateway,
} from '@/server/domain/corpus-gateway';
import {
  createInvestigation,
  publishInvestigation,
  reviewEvidence,
  reviseInvestigation,
} from '@/server/domain/investigations';
import { createResponse } from '@/server/domain/responses';
import { InMemoryStore } from '@/server/domain/store-memory';
import type { CreateInvestigationInput } from '@/server/domain/store';

// A fake corpus. It resolves a fixed set of token ids, answers queries from a
// table, and projects tokens to citation keys — everything the rules need from
// the corpus, with none of the corpus. Its existence is the point of the port:
// the publish gate and pin resolution are proven with no corpus and no database.
const KNOWN = new Set([
  'quran:tanzil-uthmani:2:43:4',
  'quran:tanzil-uthmani:2:83:9',
]);
const ROOT_OF: Record<string, string> = {
  'quran:tanzil-uthmani:2:43:4': 'z-k-w',
  'quran:tanzil-uthmani:2:83:9': 'z-k-w',
};
const COUNTS: Record<string, number> = {
  'root:z-k-w': 32,
  'zakat': 0,
};

const gateway: CorpusGateway = {
  version: '0.6.0',
  runQuery(query) {
    if (query.startsWith('((')) return { ok: false, count: 0, error: 'unbalanced' };
    return { ok: true, count: COUNTS[query] ?? 0 };
  },
  resolveToken(tokenId) {
    return { tokenId, resolved: KNOWN.has(tokenId) };
  },
  citationTargets(tokenId) {
    const m = /:(\d+):(\d+):(\d+)$/.exec(tokenId);
    const targets: CitationTarget[] = [{ kind: 'TOKEN', key: tokenId }];
    if (m) {
      targets.push({ kind: 'SEGMENT', key: tokenId.replace(/:\d+$/, '') });
      targets.push({ kind: 'SURAH', key: m[1]! });
    }
    const root = ROOT_OF[tokenId];
    if (root) targets.push({ kind: 'ROOT', key: root });
    return targets;
  },
};

let store: InMemoryStore;

async function seedAuthor(handle = 'ibn-test'): Promise<string> {
  const user = await store.createUser({
    email: `${handle}@example.com`,
    handle,
    passwordHash: 'test-hash',
  });
  await store.recordTermsAcceptance(user.id, CONTRIBUTOR_TERMS_VERSION, new Date());
  // Publishing requires a verified email; seeded authors are verified so the
  // existing publish-gate tests exercise the other conditions, not verification.
  await store.markEmailVerified(user.id, new Date());
  return user.id;
}

function draft(
  authorId: string,
  over: Partial<CreateInvestigationInput> = {},
): CreateInvestigationInput {
  return {
    authorId,
    slug: over.slug ?? 'zakat-is-a-quranic-obligation',
    claim: over.claim ?? 'Zakat is presented in the Quran as an obligation.',
    query: over.query ?? 'root:z-k-w',
    counterEvidence:
      over.counterEvidence ??
      'The word never appears with an explicit imperative in some verses.',
    pins: over.pins ?? [{ tokenId: 'quran:tanzil-uthmani:2:43:4' }],
  };
}

beforeEach(() => {
  store = new InMemoryStore();
});

describe('contributor-terms gate', () => {
  it('blocks a user without a recorded acceptance from creating content', async () => {
    const user = await store.createUser({
      email: 'x@example.com',
      handle: 'x-user',
      passwordHash: 'test-hash',
    });
    await expect(assertCanContribute(store, user.id)).rejects.toBeInstanceOf(
      TermsNotAcceptedError,
    );
    await expect(
      createInvestigation(store, gateway, draft(user.id)),
    ).rejects.toBeInstanceOf(TermsNotAcceptedError);
  });

  it('allows a user with a recorded acceptance', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId));
    expect(inv.status).toBe('DRAFT');
  });
});

describe('publish gate (data-layer, not form)', () => {
  it('cannot publish before the author verifies their email', async () => {
    // A fully valid draft by an author whose only missing prerequisite is a
    // verified email: publishing must fail, and nothing goes public.
    const user = await store.createUser({
      email: 'unverified@example.com',
      handle: 'unverified',
      passwordHash: 'test-hash',
    });
    await store.recordTermsAcceptance(user.id, CONTRIBUTOR_TERMS_VERSION, new Date());
    const inv = await createInvestigation(
      store,
      gateway,
      draft(user.id, { slug: 'unverified-cannot-publish' }),
    );
    const blocked = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: user.id,
    });
    expect(blocked).toMatchObject({ ok: false, code: 'unverified' });
    expect((await store.getInvestigation(inv.id))!.status).toBe('DRAFT');

    // After verifying, the same draft publishes.
    await store.markEmailVerified(user.id, new Date());
    const ok = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: user.id,
    });
    expect(ok.ok).toBe(true);
  });

  it('fails when the claim is missing', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId, { claim: '' }));
    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result).toMatchObject({ ok: false, code: 'claim' });
    expect((await store.getInvestigation(inv.id))?.status).toBe('DRAFT');
  });

  it('fails when counter-evidence is empty', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(
      store,
      gateway,
      draft(authorId, { counterEvidence: '   ' }),
    );
    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result).toMatchObject({ ok: false, code: 'counter_evidence' });
  });

  it('fails when the query returns nothing', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(
      store,
      gateway,
      draft(authorId, { query: 'zakat' }), // COUNTS -> 0
    );
    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result).toMatchObject({ ok: false, code: 'query' });
  });

  it('fails when the query does not parse', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(
      store,
      gateway,
      draft(authorId, { query: '((broken' }),
    );
    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result).toMatchObject({ ok: false, code: 'query' });
  });

  it('succeeds with a valid claim, evidence, query and counter-evidence', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId));
    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.investigation.status).toBe('OPEN');
      expect(result.investigation.publishedAt).not.toBeNull();
      expect(result.flaggedForReview).toBe(false);
    }
  });
});

describe('evidence pin resolution', () => {
  it('resolves or flags an unresolvable pin — never silently drops it', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(
      store,
      gateway,
      draft(authorId, {
        pins: [
          { tokenId: 'quran:tanzil-uthmani:2:43:4' }, // resolves
          { tokenId: 'quran:tanzil-uthmani:99:99:99' }, // does not resolve
        ],
      }),
    );

    const result = await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });
    expect(result.ok).toBe(true); // an unresolved pin flags, it does not fail publish
    if (result.ok) expect(result.flaggedForReview).toBe(true);

    const resolution = await reviewEvidence(store, gateway, inv.id);
    expect(resolution.resolutions).toHaveLength(2); // both kept
    expect(resolution.unresolved).toHaveLength(1);
    expect(resolution.flagged).toBe(true);

    // The pins themselves are still on the record — nothing was dropped.
    expect(await store.listInvestigationPins(inv.id)).toHaveLength(2);
    expect((await store.getInvestigation(inv.id))?.flaggedForReview).toBe(true);
  });
});

describe('revisions are append-only', () => {
  it('an update creates a revision and never overwrites a prior one', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId)); // rev 1
    await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    }); // rev 2

    const before = await store.listRevisions(inv.id);
    expect(before).toHaveLength(2);
    const firstRevisionSnapshot = { ...before[0] };

    await reviseInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
      claim: 'Zakat is an obligation, framed alongside prayer.',
    }); // rev 3

    const after = await store.listRevisions(inv.id);
    expect(after).toHaveLength(3);
    expect(after.map((r) => r.revision)).toEqual([1, 2, 3]);
    // The historical row is untouched.
    expect(after[0]).toEqual(firstRevisionSnapshot);
    // The head moved to REVISED and carries the new claim.
    const head = await store.getInvestigation(inv.id);
    expect(head?.status).toBe('REVISED');
    expect(head?.claim).toContain('alongside prayer');
  });
});

describe('bidirectional linking', () => {
  it('a published investigation cites its token, root, segment and surah', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId));
    await publishInvestigation(store, gateway, {
      investigationId: inv.id,
      actorId: authorId,
    });

    const byToken = await store.findCitingInvestigations(
      'TOKEN',
      'quran:tanzil-uthmani:2:43:4',
    );
    expect(byToken.map((c) => c.id)).toContain(inv.id);
    expect(byToken[0]?.authorHandle).toBe('ibn-test');

    const byRoot = await store.findCitingInvestigations('ROOT', 'z-k-w');
    expect(byRoot.map((c) => c.id)).toContain(inv.id);
  });

  it('does not surface an unpublished (draft) investigation', async () => {
    const authorId = await seedAuthor();
    await createInvestigation(store, gateway, draft(authorId)); // never published
    const byToken = await store.findCitingInvestigations(
      'TOKEN',
      'quran:tanzil-uthmani:2:43:4',
    );
    expect(byToken).toHaveLength(0);
  });
});

describe('responses', () => {
  it('require a type and cited evidence', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId));

    const noEvidence = await createResponse(store, gateway, {
      investigationId: inv.id,
      authorId,
      type: 'DISPUTES',
      body: 'I disagree.',
      pins: [],
    });
    expect(noEvidence).toMatchObject({ ok: false, code: 'evidence' });

    const badType = await createResponse(store, gateway, {
      investigationId: inv.id,
      authorId,
      // @ts-expect-error deliberately invalid type
      type: 'RANT',
      body: 'I disagree.',
      pins: [{ tokenId: 'quran:tanzil-uthmani:2:83:9' }],
    });
    expect(badType).toMatchObject({ ok: false, code: 'type' });

    const ok = await createResponse(store, gateway, {
      investigationId: inv.id,
      authorId,
      type: 'DISPUTES',
      body: 'This verse cuts the other way.',
      pins: [{ tokenId: 'quran:tanzil-uthmani:2:83:9' }],
    });
    expect(ok.ok).toBe(true);
  });

  it('cannot be created by a user without contributor terms', async () => {
    const authorId = await seedAuthor();
    const inv = await createInvestigation(store, gateway, draft(authorId));
    const stranger = await store.createUser({
      email: 's@example.com',
      handle: 'stranger',
      passwordHash: 'test-hash',
    });
    await expect(
      createResponse(store, gateway, {
        investigationId: inv.id,
        authorId: stranger.id,
        type: 'SUPPORTS',
        body: 'Agreed.',
        pins: [{ tokenId: 'quran:tanzil-uthmani:2:43:4' }],
      }),
    ).rejects.toBeInstanceOf(TermsNotAcceptedError);
  });
});
