# Prompt 06 — morphology: roots, lemmas, segments

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first. Corpus v0.4.0 is complete and verifiable; `packages/corpus` and `packages/search` pass 286 TS and 56 Python tests.

This prompt ingests morphological annotation and adds root and lemma search. It is the most consequential prompt so far — get alignment right or everything downstream inherits the error.

## Licence — read before writing code

The Quranic Arabic Corpus (Leeds, Kais Dukes) is **GPL**. This project accepts that obligation deliberately.

- All Leeds-derived data lives in its own directory with its own `LICENSE` (GPL-2.0-or-later) and an `ATTRIBUTION.md` naming the source, version, author and URL.
- Application code stays separate and unaffected: the data is read at runtime, not linked.
- Record the licence in `sources.json` as `GPL-2.0-or-later`, distinct from the CC-BY Tanzil entries.
- Add a short `docs/licensing.md` explaining plainly which parts of the corpus carry which licence and what a redistributor must do. Write it for a human, not a lawyer.

## Part A — acquire

Fetch the morphology data. Try in this order and record which was used:

1. The Leeds Quranic Arabic Corpus morphology release (corpus.quran.com). Its download may require a form submission — if it cannot be fetched programmatically, do not fake it.
2. A GPL redistribution of the same data on GitHub, e.g. `mustafa0x/quran-morphology`.

Checksum whatever is fetched, record it in `sources.json`, and gitignore the raw file as with the Tanzil sources.

**If neither can be fetched, stop and report.** Do not synthesise, guess, or derive roots algorithmically as a substitute. A wrong root is worse than an absent one for this project.

## Part B — align, and prove the alignment

Leeds addresses tokens as `(surah:verse:word:segment)`. Its *word* level should correspond to our whitespace tokens; its *segment* level is sub-word morphology (prefixes, stem, suffixes).

This alignment must be **verified, not assumed**:

- Map every Leeds word to one of our token ids. Compare the surface forms after normalisation.
- Report: how many aligned exactly, how many aligned only after normalisation, how many failed.
- Every failure must be listed explicitly in a report file with both forms side by side. Do not silently drop them.
- Expect discrepancies around the basmala — our corpus separates it as a named segment and counts 77,881 tokens including it, 77,433 excluding. Leeds is commonly cited at 77,430. Investigate and explain the difference precisely rather than forcing a fit.
- If alignment cannot reach at least 99.5%, stop and report rather than proceeding.

## Part C — model

Extend the token record with a morphology block, keeping the entity model in `docs/extensibility.md`:

- `root` — the triliteral or quadriliteral root, or null (particles and proper nouns have none; roughly a fifth of tokens)
- `lemma`
- `pos` — part of speech
- `features` — the remaining morphological features, as structured data not a raw tag string
- `segments[]` — the sub-word morphemes: text, type (prefix / stem / suffix), and per-segment pos and features
- `morphology_source` — the source id, so provenance is per-field

Morphology is an **annotation layer**, not a rewrite. Token ids, positions and surface text are unchanged. Assert this in a test.

Also emit `roots.json`: one record per root, with its forms, occurrence counts, and the token ids where it appears.

## Part D — search

Add to `packages/search`:

- `root:` queries, replacing the `UnsupportedQueryError` stub
- `lemma:` queries
- `pos:` queries
- Root and lemma inverted indices, built in the same pass
- Root queries must meet the same budgets: p95 under 10ms, and under 1ms when scoped

Root input should accept both the spaced Arabic form (`ز ك و`) and a Latin transliteration slug (`z-k-w`), since URLs need the latter. Define the transliteration mapping explicitly in one place and test it round-trips.

## Version

Output `out/v0.5.0/`. Token ids must be identical to v0.4.0 — assert it. Identity mapping file, no entries.

## Tests

- Token count still 77,881; token id set identical to v0.4.0
- Root of `ٱلزَّكَوٰةَ` is `ز ك و`
- `root:ز ك و` and `root:z-k-w` return identical results
- Tokens with no root return null, not an empty string, and the count of such tokens is reported
- Every token with a root has a lemma
- Concatenating a token's segments reproduces its surface form
- Alignment failures, if any, are enumerated in a committed report file
- Benchmarks extended to root, lemma and pos queries

## Report back

State: which source was used and its checksum, alignment statistics including the exact explanation of any count difference against Leeds, total distinct roots, count of tokens with no root, the top 10 roots by frequency, and every place the alignment required a judgement call.
