# Contributing

Thank you for looking. This project has an unusual constraint set, so please read
the non-negotiables before writing code — they are enforced in tests and a change
that breaks one will not be merged however good it is otherwise.

## The non-negotiable rules

These live in `CLAUDE.md` and are checked by the test suite:

1. **Never modify Quranic text.** Normalised, tashkeel-stripped and segmented forms
   are separate, labelled fields. The source text is immutable and attributed.
2. **Nothing human-created renders without a provenance tag.** Editorial, computed,
   translated and community content must be visually distinguishable from scripture.
3. **Every public page server-renders complete content.** It must work with
   JavaScript disabled. JavaScript may enhance; it may never be required to read.
4. **Every computed result carries its corpus version and parameters,** so a reader
   can reproduce it.
5. **Nothing is behind a login or a payment. Ever.** Accounts exist only for a
   person's own work and own voice.
6. **No dependency on the Quran.Foundation API.**
7. **Machine translation never touches Quranic text or Quran translations.**

If a feature seems to require breaking one of these, the feature is wrong. Open an
issue and let's find another way.

## Layer separation

Three layers, and the dependency direction is one-way:

```
packages/corpus-build/   Python pipeline → versioned, checksummed artifacts
packages/corpus/         Typed loader + checksum verification
packages/search/         In-memory index + query engine — pure functions
apps/web/                Next.js application: users, investigations
```

**Layers 1 and 2 must not know that layer 3 exists.** No database, no network and
no framework imports in `packages/search`. This is what makes a query run by an
anonymous visitor byte-identical to the same query inside a published
investigation — which is the entire promise of the site.

## Getting set up

Node 24, pnpm 9+, Python 3.11+, PostgreSQL.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env      # then point DATABASE_URL at your database
pnpm --filter @quranbench/web exec prisma migrate deploy
pnpm --filter @quranbench/web dev
```

The corpus is committed, so you do not need to run the Python pipeline to work on
the app. If you do change the pipeline, verify the output:

```bash
cd packages/corpus-build && python -m pipeline.verify out/v0.8.0
```

## Before opening a pull request

```bash
pnpm --filter @quranbench/web exec tsc --noEmit
pnpm --filter @quranbench/web exec eslint .
pnpm --filter @quranbench/web exec vitest run
pnpm --filter @quranbench/web exec playwright test    # needs a database
```

All of it must be green. The e2e suite includes accessibility assertions with axe
and a no-JavaScript suite; both are load-bearing, not decoration.

## Things reviewers will look for

- **A test that would have failed before your change.** Not a test that describes
  what the code does — one that catches the bug returning.
- **No layout shift.** The reader scores CLS 0 and that is deliberate. If your
  change swaps content after hydration, reserve the space first.
- **Colour contrast.** 4.5:1 for text under 24px, including on tinted backgrounds
  such as a selected row. This has caught real bugs twice.
- **Comments that explain why, not what.** Especially where something looks odd —
  the odd thing is usually load-bearing and the next person will "fix" it otherwise.

## Corrections to the text or the data

If you have found an error in a gloss, a root, a translation attribution or a
verse reference, please use the **Report a correction** link on the site or open a
Correction issue. Include the token or verse identifier — for example
`quran:tanzil-uthmani:2:43:4` — so the claim is checkable.

Corrections to the corpus are the most valuable contribution this project can
receive and are treated with more care than code.

## Licensing of contributions

Code is MIT. Contributed prose and documentation are CC BY-SA 4.0. `tokens.jsonl`
embeds Leeds QAC morphology and is GPL-2.0-or-later as a whole — see
`LICENSING.md` before touching the corpus build. By contributing you confirm you
have the right to contribute the work under those terms.
