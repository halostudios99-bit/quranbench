export const SITE_NAME = 'quranbench';
export const SITE_TAGLINE = 'Search the Quran by its own words';

// The person or organisation responsible for quranbench. The owner has not yet
// decided whether to publish a real name, so this is a single, clearly-marked
// placeholder — fill it in HERE, in one place, when the decision is made. Do NOT
// invent a name anywhere in the codebase. While it equals the sentinel below,
// SITE_OWNER_NAME_PENDING is true and the About page marks the identity as pending
// rather than asserting a false one.
export const SITE_OWNER_NAME = 'NOT YET DISCLOSED';
export const SITE_OWNER_NAME_PENDING = SITE_OWNER_NAME === 'NOT YET DISCLOSED';

/** Absolute origin for canonical URLs and share links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quranbench.com').replace(
  /\/$/,
  '',
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
