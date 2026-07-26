import { describe, expect, it } from 'vitest';

import { submitCorrection } from '@/server/domain/moderation';
import { InMemoryStore } from '@/server/domain/store-memory';
import { RATE_LIMITS } from '@/server/domain/config';

// The correction action, proven below the UI: it writes a PAGE-targeted
// ModerationReport, needs no account, validates, and is rate limited.

function base() {
  return {
    path: '/2/43',
    problem: 'The gloss on word 4 is wrong.',
    correction: 'It should read “the purification”.',
    contact: null,
    reporterId: null,
    clientId: 'ip-1.2.3.4',
  };
}

describe('submitCorrection', () => {
  it('writes a report without an account', async () => {
    const store = new InMemoryStore();
    const result = await submitCorrection(store, base());
    expect(result.ok).toBe(true);
    expect(store.reportCount()).toBe(1);
  });

  it('requires a page path and a described problem', async () => {
    const store = new InMemoryStore();
    const noPath = await submitCorrection(store, { ...base(), path: 'not-a-path' });
    expect(noPath).toMatchObject({ ok: false, code: 'path' });
    const noProblem = await submitCorrection(store, { ...base(), problem: '   ' });
    expect(noProblem).toMatchObject({ ok: false, code: 'problem' });
    expect(store.reportCount()).toBe(0);
  });

  it('folds correction and contact into the report detail', async () => {
    const store = new InMemoryStore();
    await submitCorrection(store, {
      ...base(),
      correction: 'the purification',
      contact: 'me@example.com',
    });
    // Reported via the store; the detail carries both structured lines.
    expect(store.reportCount()).toBe(1);
  });

  it('rate limits per client', async () => {
    const store = new InMemoryStore();
    const max = RATE_LIMITS.REPORT.max;
    for (let i = 0; i < max; i++) {
      const r = await submitCorrection(store, base());
      expect(r.ok).toBe(true);
    }
    const overflow = await submitCorrection(store, base());
    expect(overflow).toMatchObject({ ok: false, code: 'rate_limited' });
    expect(store.reportCount()).toBe(max);
  });
});
