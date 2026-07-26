import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { RootPage } from '@/components/RootPage';
import { rootHref, rootOccurrencesHref } from '@/lib/addressing';
import { parsePageParam, ROOT_OCCURRENCES_PER_PAGE } from '@/lib/pagination';
import {
  describeRoot,
  getCorpus,
  getRootBySlug,
  getRootOccurrences,
  getTextEdition,
  rootCoOccurrences,
} from '@/server/corpus';
import { citingInvestigations } from '@/server/research';

export const revalidate = 604800;
export const dynamicParams = true;

export function generateStaticParams(): { slug: string; n: string }[] {
  return [];
}

interface Params {
  params: Promise<{ slug: string; n: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, n } = await params;
  const root = getRootBySlug(decodeURIComponent(slug));
  const page = parsePageParam(n);
  if (!root || page === null) return { title: 'Root page not found' };
  const view = describeRoot(root);
  const occ = getRootOccurrences(root, page, ROOT_OCCURRENCES_PER_PAGE);
  if (page > occ.pageCount) return { title: 'Root page not found' };
  return {
    title: `Root ${root.root} — occurrences page ${page} of ${occ.pageCount}`,
    description: `Occurrences of the root ${root.root} (${view.transliteration}), page ${page} of ${occ.pageCount}.`,
    alternates: { canonical: rootOccurrencesHref(root.root_slug, page) },
  };
}

export default async function RootOccurrencePage({ params }: Params) {
  const { slug, n } = await params;
  const decoded = decodeURIComponent(slug);
  const root = getRootBySlug(decoded);
  if (!root) notFound();

  const page = parsePageParam(n);
  // Page 1 lives at the bare root page; anything malformed goes there too.
  if (page === null) redirect(rootHref(root.root_slug));

  const occurrences = getRootOccurrences(root, page, ROOT_OCCURRENCES_PER_PAGE);
  if (page > occurrences.pageCount) notFound();

  const view = describeRoot(root);
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
