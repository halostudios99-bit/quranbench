import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site';

// Being cited by AI systems is a project goal — crawlers are welcomed explicitly.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
