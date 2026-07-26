// Random word picker (workplan item 15). Deterministic when given a seed — the same
// seed always resolves to the same word — so /random?seed=… is reproducible and the
// redirect is testable. Without a seed it draws from the injected RNG (Math.random
// in production), a fresh word each request.
//
// Pure: no corpus, no I/O.

/** A stable 32-bit hash of a seed string (FNV-1a). Deterministic across processes. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Choose an index in [0, length). With a seed the choice is a pure function of the
 * seed; without one it uses `rnd` (defaulting to Math.random). Returns -1 for an
 * empty range so the caller can 404 rather than redirect nowhere.
 */
export function pickWordIndex(
  seed: string | null,
  length: number,
  rnd: () => number = Math.random,
): number {
  if (length <= 0) return -1;
  if (seed !== null && seed !== '') return hashSeed(seed) % length;
  return Math.min(length - 1, Math.floor(rnd() * length));
}
