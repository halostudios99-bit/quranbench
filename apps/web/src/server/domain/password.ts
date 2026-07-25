import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// Password hashing with scrypt from the Node standard library. scrypt is a
// memory-hard KDF in the same family the prompt calls out (argon2 / bcrypt); it
// is chosen over adding a bcrypt/argon2 native dependency so the build has no
// native module to compile on the Oracle VPS and the domain layer stays free of
// third-party crypto. The cost parameters below are OWASP-current for scrypt.
// A stored hash is self-describing (`scrypt$N$r$p$salt$hash`), so parameters can
// be raised later without invalidating existing hashes.

// promisify infers the shortest overload (no options); type it explicitly so the
// cost parameters can be passed.
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelism
const KEYLEN = 32;
const SALT_BYTES = 16;

/** The minimum accepted password length. Enforced at the account boundary. */
export const MIN_PASSWORD_LENGTH = 8;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return (await scrypt(password.normalize('NFKC'), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
}

/** Hash a password to a self-describing string safe to store. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Verify a password against a stored hash in constant time. Returns false for a
 * malformed or unknown-format hash rather than throwing, so a corrupt row can
 * never crash a sign-in.
 */
export async function verifyPasswordHash(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const actual = (await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
