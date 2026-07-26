import { describe, expect, it } from 'vitest';

import { originAllowed, tokensMatch } from '@/server/security/csrf';

// The double-submit token comparison and the same-origin check are the two things
// that reject a forged POST. Both are pure, so they are tested directly; the
// request-bound wrappers only plumb next/headers into them.

describe('tokensMatch (double-submit)', () => {
  const token = 'a'.repeat(64);

  it('accepts an identical token', () => {
    expect(tokensMatch(token, token)).toBe(true);
  });

  it('rejects a forged POST: missing, wrong, or absent cookie', () => {
    expect(tokensMatch(undefined, token)).toBe(false); // no field submitted
    expect(tokensMatch('', token)).toBe(false);
    expect(tokensMatch(token, undefined)).toBe(false); // no cookie
    expect(tokensMatch('b'.repeat(64), token)).toBe(false); // wrong token
    expect(tokensMatch('a'.repeat(63), token)).toBe(false); // length mismatch
    expect(tokensMatch(123 as unknown, token)).toBe(false); // non-string
  });
});

describe('originAllowed (same-origin)', () => {
  it('allows a same-origin POST', () => {
    expect(originAllowed('https://quranbench.com', 'quranbench.com')).toBe(
      true,
    );
  });

  it('rejects a cross-site Origin', () => {
    expect(originAllowed('https://evil.example', 'quranbench.com')).toBe(false);
  });

  it('allows an absent Origin (token is the primary control)', () => {
    expect(originAllowed(null, 'quranbench.com')).toBe(true);
  });

  it('rejects a malformed Origin', () => {
    expect(originAllowed('not a url', 'quranbench.com')).toBe(false);
  });
});
