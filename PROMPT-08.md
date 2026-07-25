# Prompt 08 — word pages, root pages, long-surah pagination

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md` and `docs/extensibility.md` first. Prompt 07 is complete and committed: `apps/web` serves the reader and `/search`.

This prompt builds the pages that are the project's strategic asset. Word and root pages are ~79,500 unique, deep-linkable pages that exist nowhere else — they are how this site becomes citable.

## Part A — long-surah pagination

You flagged that surah 2 (286 verses, ~6,000 token anchors) misses the Lighthouse budget, and that the design system doesn't specify pagination. Decision:

- Continuous reading remains the default for surahs up to 60 verses.
- Longer surahs paginate by **ruku** where the metadata supports it, otherwise in blocks of 40 verses.
- Pagination is real routing, not client-side windowing: `/2/page/3`, server-rendered, crawlable, each page canonical to itself with `rel=prev`/`next`.
- A "read continuously" option remains available at `/2/all`, marked `noindex`, for anyone who wants the whole surah in one document.
- Every verse remains addressable at `/2/43` regardless of which page it falls on.

Budget after: Lighthouse mobile performance above 95 on every paginated reader page. Report the figure for surah 2.

Add the decision to `docs/design-system.md` under layout.

## Part B — word pages

Route: `/word/[tokenId]` — e.g. `/word/quran:tanzil-uthmani:2:43:4`. URL-encode as needed but keep the id human-readable.

Each page shows, every layer carrying a `<ProvenanceTag>`:

- the token in Uthmani script, large
- its four labelled forms
- position: surah, verse, index in verse, with links
- morphology: root, lemma, part of speech, features, and the sub-word segments — tagged as external annotation, attributed to Leeds, not presented as Quranic text
- the containing verse, rendered with `<Verse mode="compact">`, this token highlighted
- neighbouring tokens, linked
- **every other occurrence of the same exact form**, with counts
- **every occurrence of the same root**, with counts, linking to the root page
- how translators rendered it — omit this section entirely until translations are ingested rather than showing an empty shell
- copy, share, permalink, cite actions from the registry
- corpus version and query provenance in the footer

Tokens with no root must render gracefully — roughly 35% have none.

## Part C — root pages

Route: `/root/[slug]` — e.g. `/root/z-k-w`. Accept the Arabic spaced form as an alias that redirects to the canonical slug.

Each page shows:

- the root, large, with its transliteration
- total occurrences and the number of distinct forms
- **every derived form**, with its own count, each linking to a representative word page
- distribution across surahs — a simple server-rendered bar or table, no chart library
- first and last occurrence in corpus order
- the full occurrence list, paginated, each entry rendered with `<Verse mode="compact">`
- lemma breakdown
- corpus version and provenance footer

## Part D — discoverability

These pages only pay off if they are found.

- Segmented sitemaps under 50,000 URLs each, covering every word and root page
- `<title>` and meta description specific to each page — never templated boilerplate. A word page's title should name the word and its reference.
- JSON-LD on word and root pages
- Internal linking: verse → its tokens → their roots → back to occurrences. Every page reachable from another page, no orphans.
- Because ~79,500 pages is too many to statically generate at build time, use on-demand ISR with a long revalidate. Measure and report cold and warm render times.

## Tests

- `/word/quran:tanzil-uthmani:2:43:4` renders, shows root `ز ك و`, and links to `/root/z-k-w`
- `/root/z-k-w` renders, shows 59 occurrences, and lists derived forms
- A rootless token renders without error — pick one and pin it in the test
- `/root/ز ك و` redirects to `/root/z-k-w`
- Paginated surah routes render and each verse is reachable
- No-JS rendering for word, root and paginated reader pages
- Axe passes on both new page types
- Sitemaps generate and every entry resolves 200 — spot-check a sample, do not crawl all 79,500
- One-renderer rule still holds

## Report back

State: Lighthouse mobile for surah 2 paginated, cold and warm ISR render times for a word and a root page, total sitemap URL count, and any page where the design budgets were missed.
