import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Prose } from '@/components/Prose';
import { parseMarkdown } from '@/lib/markdown';
import { getCurrentUser } from '@/server/auth';
import { CURRENT_TERMS_VERSION } from '@/server/research';

import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create a quranbench account to publish investigations. Signing in gates only your own work — every corpus, search and download stays open to everyone.',
  robots: { index: false, follow: true },
};

async function loadTerms(): Promise<string> {
  const path = resolve(process.cwd(), '..', '..', 'docs', 'contributor-terms.md');
  return readFile(path, 'utf8');
}

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/account');
  const blocks = parseMarkdown(await loadTerms());

  return (
    <section className="mx-auto max-w-reader">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
        Create an account
      </h1>
      <p className="mb-6 text-[15px] text-ink2">
        An account lets you draft and publish investigations. Everything a signed-out
        visitor can see stays visible without one — nothing moves behind sign-in.
      </p>
      <SignupForm
        terms={<Prose blocks={blocks} />}
        termsVersion={CURRENT_TERMS_VERSION}
      />
    </section>
  );
}
