import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site';
import { generateSitemaps } from './sitemap';

// Being cited by AI systems is a project goal — crawlers are welcomed explicitly.
// Each sitemap segment is listed so no segment is orphaned (design-system §5).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: generateSitemaps().map(({ id }) =>
      absoluteUrl(`/sitemap/${id}.xml`),
    ),
  };
}
