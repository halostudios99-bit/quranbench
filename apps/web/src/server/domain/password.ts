import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

import { argon2id, argon2Verify } from 'hash-wasm';

// Password hashing with argon2id, the OWASP-recommended password KDF. hash-wasm
// implements it in WebAssembly, so there is no native module to compile on the
// Oracle VPS — the property the previous scrypt choice existed to protect — while
// still using a memory-hard, side-channel-resistant argon2 variant.
//
// A stored hash is self-describing. argon2id hashes use the PHC string format
// (`$argon2id$v=19$m=...,t=...,p=...$salt$hash`), so the cost parameters travel
// with the hash and can be raised later without invalidating anyone. Legacy
// scrypt hashes (`scrypt$N$r$p$salt$hash`) written before this change still
// verify, and are transparently re-hashed to argon2id on the next successful
// sign-in — see `needsRehash` and accounts.ts.

// ─── argon2id (current) ───────────────────────────────────────────────────────
// OWASP "second-choice" configuration: m=19 MiB, t=2, p=1. Chosen over the
// t=1/m=46 MiB profile so a single sign-in never allocates 46 MiB per request on
// a small VPS, while keeping the work factor well above the minimum.
export const ARGON2_PARAMS = {
  /** Memory cost in KiB (19 MiB). */
  memorySize: 19456,
  /** Time cost (passes). */
  iterations: 2,
  /** Lanes. Kept at 1 — the VPS is not many-core and single-lane is deterministic. */
  parallelism: 1,
  hashLength: 32,
} as const;

const SALT_BYTES = 16;

/** The minimum accepted password length. Enforced at the account boundary. */
export const MIN_PASSWORD_LENGTH = 8;

/** Hash a password to a self-describing PHC string safe to store. */
export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password: password.normalize('NFKC'),
    salt: randomBytes(SALT_BYTES),
    ...ARGON2_PARAMS,
    outputType: 'encoded',
  });
}

/**
 * Verify a password against a stored hash in constant time. Accepts both current
 * argon2id hashes and legacy scrypt hashes. Returns false for a malformed or
 * unknown-format hash rather than throwing, so a corrupt row can never crash a
 * sign-in.
 */
export async function verifyPasswordHash(
  password: string,
  stored: string,
): Promise<boolean> {
  const normalized = password.normalize('NFKC');
  if (stored.startsWith('$argon2')) {
    try {
      return await argon2Verify({ password: normalized, hash: stored });
    } catch {
      return false;
    }
  }
  if (stored.startsWith('scrypt$')) return verifyScrypt(normalized, stored);
  return false;
}

/**
 * Whether a stored hash should be replaced with a fresh argon2id hash on the next
 * successful sign-in. True for any legacy scrypt hash, and for an argon2id hash
 * whose cost parameters are below the current target (so raising ARGON2_PARAMS
 * later upgrades accounts as they sign in). The raw password is required because
 * a new hash can only be derived from it — this is called only after a verified
 * match.
 */
export function needsRehash(stored: string): boolean {
  if (!stored.startsWith('$argon2id$')) return true;
  const m = /\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored);
  if (!m) return true;
  const [, mem, iter, par] = m;
  return (
    Number(mem) < ARGON2_PARAMS.memorySize ||
    Number(iter) < ARGON2_PARAMS.iterations ||
    Number(par) !== ARGON2_PARAMS.parallelism
  );
}

// ─── scrypt (legacy verification only) ────────────────────────────────────────
// Retained so hashes written before the argon2id migration keep working. No new
// scrypt hashes are ever produced.

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

async function verifyScrypt(
  normalized: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p))
    return false;
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  const actual = (await scrypt(normalized, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
