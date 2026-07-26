import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { RootPage } from '@/components/RootPage';
import { rootHref } from '@/lib/addressing';
import { ROOT_OCCURRENCES_PER_PAGE } from '@/lib/pagination';
import {
  describeRoot,
  findRootByArabic,
  getCorpus,
  getRootBySlug,
  getRootOccurrences,
  getTextEdition,
  rootCoOccurrences,
} from '@/server/corpus';
import { citingInvestigations } from '@/server/research';

// ~1,650 root pages: on-demand ISR with a week-long revalidate, like word pages.
export const revalidate = 604800;
export const dynamicParams = true;

// On-demand ISR: nothing prebuilt, each root page cached on first request. The
// empty export is what enables that caching path (see the word route).
export function generateStaticParams(): { slug: string }[] {
  return [];
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const root = getRootBySlug(decodeURIComponent(slug));
  if (!root) return { title: 'Root not found' };
  const view = describeRoot(root);
  return {
    title: `Root ${root.root} (${slug}) — ${view.occurrences} occurrences`,
    description: `The Quranic triliteral root ${root.root} (${view.transliteration}): ${view.occurrences} occurrences across ${view.distinctForms} forms and ${view.lemmas.length} lemmas. Every derived form and occurrence, reproducible from the corpus.`,
    alternates: { canonical: rootHref(root.root_slug) },
  };
}

export default async function RootSlugPage({ params }: Params) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const root = getRootBySlug(decoded);
  if (!root) {
    // A pasted Arabic form (spaced `ز ك و` or unspaced) redirects to the slug.
    const byArabic = findRootByArabic(decoded);
    if (byArabic) redirect(rootHref(byArabic.root_slug));
    notFound();
  }

  const view = describeRoot(root);
  const occurrences = getRootOccurrences(root, 1, ROOT_OCCURRENCES_PER_PAGE);
  const citing = await citingInvestigations('ROOT', root.root_slug);
  return (
    <RootPage
      view={view}
      occurrences={occurrences}
      coOccurrence={rootCoOccurrences(root.root_slug)}
      edition={getTextEdition()}
      corpusVersion={getCorpus().version}
      citing={citing}
    />
  );
}
