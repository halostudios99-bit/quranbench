export const SITE_NAME = 'quranbench';
export const SITE_TAGLINE = 'Search the Quran by its own words';

/** Absolute origin for canonical URLs and share links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quranbench.com').replace(
  /\/$/,
  '',
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
