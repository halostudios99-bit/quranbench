# quranbench — project context

Read this before doing anything. It is the standing brief for all work in this repo.

## What this is

An open Quran research workbench at quranbench.com. Every Arabic word is a permanent, addressable research object. The promise to users:

> Do not accept our interpretation. Open the evidence, reproduce the search, and investigate the Quran yourself.

Full decision record: `../DECISIONS.md`. Architecture: `docs/architecture.md`. Design system and performance budgets: `docs/design-system.md`. Languages and translation: `docs/i18n-spec.md`. Entity model, identifiers and what not to build yet: `docs/extensibility.md`.

## Non-negotiable rules

1. **Never modify Quranic text.** Normalised, tashkeel-stripped and segmented forms are stored as separate labelled fields. The source text is immutable and always attributed to Tanzil.

2. **Nothing human-created may visually resemble Quranic text.** Every rendered layer carries a provenance tag: Quranic text / computed / external annotation / translation / editorial / community. This is enforced in the component layer, not left to page authors.

3. **Server-render everything public.** Word pages, root pages, verse pages and investigations must be server-rendered. They are the SEO and AI-citation asset. If a public page requires JavaScript to show its content, it is a bug.

4. **Reproducibility is a feature.** Every computed result carries the corpus version, text edition, and the exact query that produced it. Never display a number without the ability to show how it was derived.

5. **Nothing is gated.** No corpus, search, evidence or data download is ever behind a login or payment. Login gates only a user's own work. Payment state must never be read by content code.

6. **No dependency on the Quran.Foundation API.** Their terms forbid caching beyond one week, indexing, and redistribution. See `../DECISIONS.md` §4.

7. **Machine translation never touches Quranic text or Quran translations.** Only licensed human editions. The Quran renderer must have no access to the MT service — enforce at the module boundary. See `docs/i18n-spec.md`.

## Stack

- Next.js (App Router) + TypeScript, strict mode
- Tailwind CSS + CSS custom properties for theming; `next-themes` for light/dark
- PostgreSQL via Prisma — users, investigations, annotations, revisions
- Corpus is **not** in Postgres. It is versioned build artifacts loaded into memory at boot.
- Vitest for unit tests, Playwright for e2e
- Docker + Caddy for deployment on an Oracle VPS

## Key architectural fact

The entire Quran corpus is ~77,430 tokens — a few megabytes. It fits in RAM.

Do not reach for Elasticsearch, a vector database, or any external search service. The search index is an in-memory data structure built at boot from versioned artifacts. Target sub-10ms queries. This constraint is what makes the product feel fast, and speed is the primary UX goal.

## Module boundaries

```
packages/corpus-build/   Offline Python pipeline. Produces versioned artifacts.
packages/corpus/         TS loader + types for artifacts. No I/O beyond reading files.
packages/search/         In-memory index + query engine. Pure functions. No DB, no HTTP.
apps/web/                Next.js app. Imports corpus + search. Owns UI and routes.
apps/web/src/payments/   Stripe. Isolated. Nothing outside this dir imports Stripe.
```

`search` must be testable with no database, no network and no Next.js. If a search test needs either, the boundary has been broken.

## UI conventions

`docs/design-system.md` is binding for all UI work. Read it before writing any component. Summary of the parts most often got wrong:

- **Mobile-first.** Design the phone layout first, widen second.
- Arabic line-height minimum 2.0. Quranic text never below 24px. Never letter-space or justify Arabic.
- Real RTL via `dir="rtl"` and logical CSS properties. Never mirror an LTR layout.
- All colour through CSS custom properties — never a hardcoded hex in a component.
- **Animate the interface, never the scripture.** `transform` and `opacity` only.
- Performance budgets in the design system are hard requirements. LCP < 1.8s, INP < 150ms, CLS < 0.05, Lighthouse > 95 mobile.
- Every public page must render complete content with JavaScript disabled.
- WCAG 2.2 AA. Semantic HTML, full keyboard navigation, visible focus states.
- PWA: manifest, service worker, corpus cached for full offline search.

## Style

- Small, pure, well-named functions. Explicit types at module boundaries.
- Tests alongside the code they test.
- No comments explaining what code does. Comments only for why a non-obvious decision was made.
- Conventional commits.

## Working agreement

- Do not add dependencies without stating why in your response.
- Do not scaffold features that were not asked for.
- If a spec in `docs/` is ambiguous or wrong, say so rather than guessing.
- Run the tests before reporting a task complete.
