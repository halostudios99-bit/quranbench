import { getCorpus } from '@/server/corpus';
import { absoluteUrl } from '@/lib/site';

// A sitemap *index* at the conventional location.
//
// The real sitemaps are sharded under /sitemap/<n>.xml (Next's segmented sitemap
// output) and robots.txt declares each shard, so crawlers were already served
// correctly. But /sitemap.xml is the path humans type, the path many tools probe
// first, and the path most convenient to hand to Search Console — and it was a
// 404. This returns a sitemapindex pointing at the shards, which is the standard
// way to expose more than 50,000 URLs.
//
// The shard count is derived from the corpus rather than hardcoded, so adding
// tokens can never leave a shard undeclared.

const WORDS_PER_SITEMAP = 45000;

export const dynamic = 'force-static';

export function GET(): Response {
  const wordSegments = Math.max(
    1,
    Math.ceil(getCorpus().tokens.length / WORDS_PER_SITEMAP),
  );
  // Segment 0 is the reader surfaces and roots; 1..n are the word-page slices.
  const ids = [0, ...Array.from({ length: wordSegments }, (_, i) => i + 1)];
  const lastmod = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ids
  .map(
    (id) =>
      `  <sitemap><loc>${absoluteUrl(`/sitemap/${id}.xml`)}</loc><lastmod>${lastmod}</lastmod></sitemap>`,
  )
  .join('\n')}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
