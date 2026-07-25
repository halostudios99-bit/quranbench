# State of the project

_Written 2026-07-25, after Prompt 13, as an honest internal assessment — for the owner, not for marketing. It records what is genuinely built, what only looks built, what is fragile, and what an outside reviewer would attack first._

How this was produced: every package's unit/integration suite was run; the app was type-checked and production-built; and the codebase was reviewed against `CLAUDE.md`, `../DECISIONS.md`, and `docs/`. Findings cite `file:line`. Nothing here is inferred from comments alone.

## Verification basis (what was actually run)

- **`vitest run` (packages):** 329 tests pass across 10 files — `@quranbench/corpus`, `@quranbench/search`, `@quranbench/audit`. Search p95 latency is well under budget (exact 0.015 ms, worst-case `pos` 4.7 ms vs a 10 ms budget).
- **`vitest run` (apps/web):** 101 tests pass across 13 files — domain (publish gate, terms gate, append-only revisions), auth, API core, data-download checksums, the five-part infrastructure test, translations, markdown, pagination.
- **`tsc --noEmit` (apps/web):** clean.
- **`next build`:** succeeds (exit 0); 221/221 static pages generated with the new `Investigation.body` column in place.
- **Playwright e2e (12 specs, incl. `no-js`, `pwa`, `a11y`, `render`, `word`, `sitemap`): NOT run.** They need `next start` plus a Postgres, and no database is reachable in this environment (no Docker, port 5432 closed, no `.env.local`). The specs exist and encode the right guarantees, but this report cannot claim they pass. **This is the single biggest gap in the test evidence.**
- **Prisma migration 0003 (`Investigation.body`): NOT applied** — no database. `prisma validate` passes and the client generates; the migration has not been run against a real DB.

Total automatically verified: **430 tests green.** Nothing was observed flaky. The e2e layer is unverified here.

## What is genuinely built

The research substrate is real and well-tested, not a facade:

- **Corpus + search.** 77,881 tokens / 6,236 verses load from checksummed, versioned artifacts (`packages/corpus-build/out/v0.6.0/`) and build an in-memory index with sub-10 ms queries. Pure, DB-free, network-free — exactly as `CLAUDE.md` demands. Normalisation, references, roots, lemmas, proximity/adjacency/wildcard all covered by tests.
- **Public API (`/api/v1/…`).** Keyless, CORS-open, rate-limit published in headers; 11 endpoints (token, verse, surah, root, search, resolve, manifest, versions, download, `openapi.json`, index). The OpenAPI schema is generated from the implementation with a drift test. Content negotiation serves JSON-LD at the same URL via `middleware.ts`.
- **Reproducibility.** Every API response carries `corpus_version`, edition, numbering scheme, params and the query. A test recomputes a root's frequency three independent ways and asserts equality.
- **Data downloads.** `/data` publishes per-file sha256 + byte sizes, a full tarball, per-licence grouping, a citation string and a "verify it yourself" `shasum` recipe. `data-downloads.test.ts` re-hashes every artifact on disk against the published digests.
- **Investigations domain.** The publish gate (`domain/investigations.ts`) enforces claim + working query + counter-evidence + verified email + terms + rate limit before anything goes `OPEN`. Append-only revisions. All proven with an in-memory store, no DB. This is the mechanism that makes seeded drafts safe to leave unpublished.
- **MCP server** (`packages/mcp`) wraps the same API and prefixes every result with an enforced attribution block; driven end-to-end in the five-part test.
- **This prompt: `@quranbench/audit`.** A reusable, orthography-tolerant checker (verse references, quoted Arabic, root claims, transliterations) with 21 tests. Ran over all 18 archived articles → `audit-reports/`. Seed script builds 18 draft investigations from those articles → `seed/plan.json`.

## What is NOT built (and where "clean" is only vacuous)

- **Machine translation.** There is no MT service and no `packages/i18n-mt/` (the module `docs/i18n-spec.md:125` mandates). Rule 7 ("MT never touches Quranic text, enforced at the module boundary") is therefore _vacuously_ upheld: the boundary can't be violated because the thing to isolate doesn't exist. When MT lands, nothing structural currently stops `Token.tsx`/`Verse.tsx` from importing it — the barrier must be built with the feature.
- **Payments.** No `apps/web/src/payments/`, no Stripe in any `package.json`. "Payment state never read by content code" is likewise vacuously true. Fine for now, but the isolation is untested.
- **Identifier permanence (301/410).** The `/identifiers` page promises "URLs never 404 — retired URLs 301 to a successor or 410 with an explanation." **This is not implemented.** An unknown or retired token id returns a bare 404 (`server/corpus.ts:319` → `word/[tokenId]/page.tsx:120`); the published mapping tables (`mapping/*.json`) are never loaded or consulted at request time. `docs/extensibility.md` calls stable identifiers the property where "nothing else matters if this fails."
- **A project LICENSE.** There is **no `LICENSE` file anywhere** and no `license` field in any `package.json`, even though the app bundles and serves GPL-2.0 Leeds morphology (`tokens.jsonl`, `roots.json`). See "reviewer would attack first."
- Word-page URLs are **not version-pinned** — `/word/<id>` always resolves against the current corpus; version appears only in the footer and the API.

## What is fragile

- **Draft investigations are world-readable by slug.** `getInvestigationView` (`server/research.ts:159`) fetches by slug with **no status filter**; the page only calls `notFound()` when the row is missing (`investigations/[slug]/page.tsx:94`). The _list_ correctly filters to published, but anyone who knows a slug reads the full draft. This directly contradicts "login gates only a user's own work" and makes it unsafe to run the Part-C seed against production as-is (it would expose 18 unreviewed drafts at `/investigations/<slug>`).
- **Provenance is enforced at the container, not the glyph.** `ProvenanceTag` + `Verse.tsx` guarantee a tag on the verse path, but Quranic text is also emitted via raw `.quran` spans whose sibling tag is a page-author choice (`investigations/[slug]/page.tsx:68`, tagged only because the enclosing `Section` passes `provenance="quran"`). Nothing structurally stops a new surface from rendering scripture with the wrong or no tag — the exact "left to page authors" pattern Rule 4 forbids.
- **Corpus boot cost.** Loading + checksum-validating the corpus takes ~7 s per process. During `next build` each static-generation worker reloads it (observed repeatedly in the build log). Fine as a one-time boot cost per server, but a cold start is not instant, and build parallelism multiplies it. The retained index heap is ~121 MB (`search/bench.test.ts`) — comfortable in RAM, but not the "few MB" the corpus itself is.
- **e2e is the untested seam _here_.** The most product-shaped guarantees live only in Playwright specs that were not run in this pass — but they are strong specs: `a11y.spec.ts` runs `@axe-core/playwright` (wcag2a/2aa/21aa/22aa) across 18 representative paths, and `no-js.spec.ts` / `pwa.spec.ts` cover the JS-off and offline requirements. They are genuinely enforced when the suite runs; they just did not run without a DB.

## Code hygiene

The codebase is unusually clean — no genuine TODO/FIXME stubs (every `throw new Error` is a real validation guard), no unused dependencies, and the Python pipeline has no placeholders. The issues are build-artifact and enforcement hygiene:

- **Committed, stale `dist/`.** `packages/corpus/dist/` (12 files) and `packages/search/dist/` (42 files, including compiled _test_ files) are git-tracked but orphaned — both packages resolve via `"main": "src/index.ts"`, so nothing imports `dist`, and it is out of date relative to `src`. `dist/` is not in `.gitignore`. A reviewer will read stale compiled code as source of truth. Add `dist/` to `.gitignore` and `git rm -r --cached` it.
- **No CI, and web-vitals budgets unenforced.** There is no `.github/` and no Lighthouse/web-vitals guard, although `docs/design-system.md:129` mandates "Run Lighthouse CI… Fail the build on regression." The LCP/INP/CLS budgets are aspirational. (Search-latency budgets and accessibility _are_ enforced by tests.)
- **Verse pages omit inline JSON-LD.** `[surah]/[ayah]/page.tsx` has no `<script type="application/ld+json">`, unlike word/root/investigation pages; verse structured data is only reachable via `Accept` negotiation, which most crawlers don't send — inconsistent for a core citation asset.
- **`UnsupportedQueryError`** is a dead export (an intentional, documented extension point). `homepage-mockup.html` is a stray mockup at the repo root. Both are clutter, not bugs.

## What an outside reviewer would attack first (in order)

1. **No declared licence, while redistributing GPL data.** The repo has no `LICENSE` and no `license` in any manifest, so the software is, by default, all-rights-reserved — yet it serves GPL-2.0 Leeds morphology through the API and word/root pages. The Dataset JSON-LD papers over this by pointing `license` at `https://quranbench.com/method` (`data/page.tsx:57`), a build narrative that grants nothing. `docs/extensibility.md:24` calls an open licence "the one that becomes impossible to fix later." This is cheap to fix now and radioactive later. **Most important thing to fix next.**
2. **Draft exposure by slug** (above) — a live privacy/correctness bug and a blocker for safe seeding.
3. **CC-BY attribution missing from the machine-readable layer.** Tanzil is attributed in the footer, `/method`, and downloads, but **not** in the JSON-LD (`server/api/jsonld.ts`) or JSON API payloads — the exact surfaces built for AI citation. Redistributing the Arabic text there without attribution is out of compliance with CC-BY.
4. **Identifier 301/410 unimplemented** — the founding permanence promise is asserted in the UI but not enforced in code. It doesn't bite until a v0.7.0 ships with moved/retired ids, but it must exist before that.
5. **e2e unrun in this pass** — the non-negotiables around no-JS/PWA/a11y are only as trustworthy as a green Playwright run, which this environment can't produce.

## Non-negotiable rules (CLAUDE.md) — status

| Rule | Verdict | Note |
| --- | --- | --- |
| 1 Never modify Quranic text | UPHELD | derived forms are separate labelled fields; source immutable, Tanzil-attributed |
| 2 Nothing resembles Quranic text w/o provenance tag | **PARTIAL** | enforced on the `Verse` path; convention-only for raw `.quran` spans |
| 3 Server-render everything public; works with JS off | UPHELD | all public pages are Server Components; `no-js.spec.ts` guards it (unrun here) |
| 4 Reproducibility | UPHELD | version + params + query on every result; 3-way recompute test |
| 5 Nothing gated by login/payment | UPHELD (+ inverse bug) | no gating of content; but drafts leak by slug |
| 6 No Quran.Foundation API | UPHELD | only offline-pipeline attribution text mentions corpus.quran.com |
| 7 MT never touches Quranic text | VACUOUS | no MT service exists; boundary unbuilt and untested |

## Five-part infrastructure test (extensibility §9)

Backed by `apps/web/tests/unit/five-part-infrastructure.test.ts` (passes). Independent verdicts:

1. Cite a word, specific version, stable URL — **PARTIAL** (stable opaque URL + policy page + published mappings, but URL not version-pinned and 301/410 not implemented).
2. Download the whole dataset, redistributable licence — **PASS**.
3. Rebuild a statistic and get the same number — **PASS**.
4. Query the API without registering — **PASS**.
5. Point an AI at it, get attributable answers — **PASS** (MCP + `.well-known` + JSON-LD), modulo the missing CC-BY attribution in JSON-LD.

## Licensing

- **Leeds morphology (GPL-2.0-or-later):** handled well. Full GPL text + attribution shipped in the artifacts; copyleft propagation implemented in `downloads.ts` (tokens.jsonl and the tarball are labelled GPL). Clean.
- **Translations:** public-domain only (Pickthall / Rodwell / Palmer), each with a per-jurisdiction licence note incl. US analysis; Sahih International and other copyrighted editions are absent. Clean.
- **Tanzil (CC-BY 3.0):** attributed in UI/downloads/manifest; **missing from JSON-LD and JSON API** (issue 3 above).
- **Project's own licence:** absent (issue 1). The doc-level three-way split (corpus/community/editorial) is described in `docs/contributor-terms.md` but not instantiated by an actual grant.

## What Prompt 13 added

- `packages/audit` — the checker (extraction is pure and tested without the corpus; verification reads the corpus/search index; never auto-corrects). Orthography-tolerant consonant matching removed the Imlaei-vs-Uthmani false positives; hadith/Bible citations are classified out-of-scope, not flagged as broken Quran refs.
- `audit-reports/` — 18 per-article reports (md + json), a ranked `SUMMARY.md`, and `index.json`. **396 claims checked, 10 flagged**, including the 2017 zakat root error and two more mislabelled references the tool discovered (`Al-Anam 24:35` actually quotes 6:38; `33:52` actually quotes 35:22).
- `apps/web/scripts/seed-investigations.ts` + `seed-store.ts` — idempotent seeding to draft investigations; `--plan` mode (run here) produced `seed/plan.json`; `--commit` requires a DB and was not run.
- `Investigation.body` column (migration 0003) to preserve article prose, which the structured model had no slot for.

## What to do next, in order

1. **Add a `LICENSE`** (and `license` fields) — decide the code licence (GPL-compatible, given the bundled Leeds data) and state the editorial/community/corpus split the docs already describe. Point the Dataset `license` at a real licence, not `/method`. Cheapest now, impossible later.
2. **Fix draft exposure** — `getInvestigationView` must return published-only for anonymous callers (or the page must 404 non-published unless the viewer is the author). Do this **before** running the seed `--commit` against any public deployment.
3. **Attach CC-BY attribution to JSON-LD + JSON API** — add `license`/`creator`/`isBasedOn` for Tanzil (and GPL for morphology) to `jsonld.ts` and the API payloads.
4. **Run the e2e suite against a real DB** — stand up Postgres, `prisma migrate deploy`, `next build && next start`, then `playwright test`. Report the true no-JS/PWA/a11y state.
5. **Implement identifier 301/410** — load the mapping tables at boot and resolve retired/moved token ids to successors (301) or tombstones (410) instead of 404.
6. **Cheap hygiene, any time:** `.gitignore` + untrack `packages/*/dist/`; add inline JSON-LD to verse pages; stand up minimal CI (`vitest`, `tsc`, `next build`, `playwright`) and a Lighthouse budget so the perf claims are enforced, not aspirational; correct the "few MB" corpus figure in `CLAUDE.md` (~120 MB retained index); remove `homepage-mockup.html`.
7. **Then** hand the audit reports and seeded drafts to the owner: rewrite each auto-drafted claim, resolve the flagged references, add a reproducible query and counter-evidence, and only then publish.
