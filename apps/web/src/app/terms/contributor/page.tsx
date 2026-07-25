import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Metadata } from 'next';

import { Prose } from '@/components/Prose';
import { ProvenanceTag } from '@/components/ProvenanceTag';
import { CURRENT_TERMS_VERSION } from '@/server/research';
import { parseMarkdown } from '@/lib/markdown';

// The contributor terms, rendered from the single source of truth in
// docs/contributor-terms.md. Server-rendered, complete without JavaScript, so it
// is a citable, crawlable page — a contributor accepts a version they can read.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Contributor terms',
  description:
    'The terms under which contributions to quranbench are licensed: CC BY-SA 4.0 with an irrevocable grant to redistribute in the open dataset.',
  alternates: { canonical: '/terms/contributor' },
};

async function loadTerms(): Promise<string> {
  const path = resolve(process.cwd(), '..', '..', 'docs', 'contributor-terms.md');
  return readFile(path, 'utf8');
}

export default async function ContributorTermsPage() {
  const blocks = parseMarkdown(await loadTerms());
  return (
    <article className="mx-auto max-w-reader">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ProvenanceTag layer="editorial" note={`v${CURRENT_TERMS_VERSION}`} />
        <span className="font-ui text-[13px] text-ink3">
          Accepted at signup · recorded with version and timestamp
        </span>
      </div>
      <Prose blocks={blocks} />
    </article>
  );
}
