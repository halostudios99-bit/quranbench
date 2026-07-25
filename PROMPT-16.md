## Batch 2 — word-by-word and classical meaning (workplan items 5, 6, 7, 7b)

Read `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md` and `docs/licensing.md` first. Batch 1 is complete; corpus is v0.7.0.

### 5. Leeds English glosses

The Leeds Quranic Arabic Corpus ships an English gloss per word. GPL-2.0-or-later — the licence already accepted for the morphology, so no new legal question. It lives in the existing isolated morphology directory.

- Fetch, checksum, record in `sources.json`.
- Align to existing token ids using the same proven approach as the morphology alignment. Reuse that code rather than writing a second aligner.
- Report alignment statistics and enumerate every failure in a committed report, as before.
- Glosses are an **annotation layer**: token ids, positions and surface text unchanged. Assert it.

**Judgement required:** Leeds glosses are terse and sometimes awkward — "the alms", "and (do) not". Sample at least 200 across different parts of speech and report honestly whether they read acceptably. If a substantial share are unusable, say so rather than shipping something that looks careless. Do not rewrite them — they are someone else's data and must stay attributable.

### 6. Transliteration

A gloss without transliteration is useless to anyone who cannot read the script.

- Use Leeds transliteration where available. Otherwise implement a documented, tested romanisation scheme — state which scheme and why.
- Record per token which source produced it.
- Test round-trips and a hand-written set of expected values.

### 7. Hover tooltip

Put it in the `Token` component — the single renderer — so it appears everywhere tokens appear without touching any page.

Contents: gloss, transliteration, root with its occurrence count as a link to the root page, and a small source label ("gloss: Leeds corpus"). Unlike quran.com, the gloss is never presented as unattributed fact.

- Data ships in the page. **No fetch on hover.** A verse of glosses is tiny.
- Desktop: hover, 200ms delay before showing, 120ms fade of the tooltip only. **No motion on the Arabic.**
- Mobile: tap opens a compact bottom sheet, not a floating box under the thumb.
- Keyboard: focusing a token shows it; Esc dismisses.
- No layout shift. Tooltip must not overflow the viewport — flip and clamp.
- `prefers-reduced-motion` respected.
- Works with JS disabled in the sense that the page is unharmed; the tooltip is progressive enhancement, and the word page remains the accessible full view.

### 7b. Lane's Lexicon

The standard classical Arabic–English lexicon. Public domain (published 1863–93, Lane died 1876). The digitised text from Tufts/Perseus is **CC BY-SA 3.0** — attribution and share-alike, so it is displayable *and* redistributable, unlike Itani.

- Fetch a digitisation whose licence you can verify. Checksum, record the exact licence string and source URL.
- Organised by root — map entries onto the existing 1,651 roots.
- **Coverage is uneven.** Lane died before finishing; volumes 6–8 were assembled by Stanley Lane-Poole from incomplete notes, so roots beginning with later letters (roughly ك onwards) are thin or absent. Report actual coverage: how many of the 1,651 roots have an entry.
- **Where no entry exists, say so explicitly** — "no entry in Lane's for this root" — never a blank that reads as "no meaning."
- Placement: a **Meaning** section on each root page, tagged as external annotation, attributed to Lane with date. A link to it from the tooltip.
- Entries can be long. Truncate with an expand control; the full entry must be in the server-rendered HTML for crawlers.

Corpus becomes **v0.8.0**. Token and verse ids unchanged.

### Tests

- Gloss and transliteration present for aligned tokens; absent-not-empty where unaligned
- Token/verse ids identical to v0.7.0
- Tooltip renders gloss, transliteration, root link and source label
- Tooltip appears in reader, search results and investigation evidence without those pages being modified — assert the one-renderer rule still holds
- Tooltip: keyboard accessible, no layout shift, viewport-clamped, axe clean, reduced-motion honoured
- Lane's: a root with an entry renders it; a root without shows the explicit no-entry message; coverage count asserted
- Full suite green

### Report back

Gloss alignment stats and your honest assessment of gloss quality with examples; which transliteration source and scheme; Lane's coverage as a fraction of 1,651 roots and its licence string; tooltip performance impact on a reader page.
