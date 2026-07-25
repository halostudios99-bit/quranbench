# Prompt 09 — translations and the translation laboratory

Read `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/i18n-spec.md` and `docs/licensing.md` first.

## Licensing — the binding constraint

**Only ingest translations whose licence is documented and permits redistribution.** This project publishes a downloadable dataset; a translation we cannot redistribute cannot be included.

- Tanzil publishes a translation collection with per-translation licence metadata. Use it as the primary source and read the licence for each edition individually.
- Include an edition **only** if its licence is explicitly public domain, Creative Commons, or otherwise clearly permits redistribution. Record the exact licence string and the URL where you read it.
- **If an edition's licence is unclear, ambiguous, or absent, do not include it.** Do not infer permission from availability. List every edition you rejected and why, in a committed report.
- Record every included edition as a `Source` in `sources.json` with licence, translator, year and checksum.
- Machine translation must never touch this layer — see rule 7 in `CLAUDE.md`.

Aim for at least two English editions. If fewer than two qualify, ship what qualifies and report rather than lowering the bar.

## Ingest

- Verse-level alignment only. Word-level alignment data does not exist for these editions — do not fabricate it.
- Output to `out/v0.6.0/translations/`, one file per edition, each with its own licence file.
- Token ids and verse ids unchanged from v0.5.0. Assert it. Identity mapping.
- Extend the manifest with the translation editions and their licences.

## Reader and verse pages

- Translations shown beneath the Arabic, each labelled with translator, edition and licence — never anonymous.
- A `<ProvenanceTag>` of the translation layer on every one.
- Reader setting for which editions are shown, persisted without an account.

## Translation laboratory — `/compare`

- Side-by-side comparison of all available editions for a verse or range.
- **Divergence detection**: where editions differ materially for the same verse, highlight it. Compute this — do not hand-curate. Define "materially" explicitly and document the method on the page.
- Reverse lookup: given an English word, show which verses render it, and which Arabic tokens are in those verses. Be explicit in the UI that this is verse-level correspondence, not word-level alignment — do not imply precision the data does not support.
- Every comparison is a permalink, server-rendered, crawlable.
- The computation parameters and corpus version shown on every result.

## Word pages

Add the "how translators rendered it" section now that data exists. Because alignment is verse-level, present it honestly: the verses containing this token and how each edition renders those verses. Label the limitation plainly.

## Tests

- Every ingested edition has a recorded licence permitting redistribution; a test fails if any edition lacks one
- Rejected editions are enumerated in a committed report
- Token and verse ids identical to v0.5.0
- `/compare` renders server-side for a verse and a range
- Divergence detection flags a hand-picked verse known to differ across editions, and does not flag a verse where editions agree
- No-JS and axe on `/compare`
- Word page translation section renders and labels its verse-level limitation

## Report back

Editions included with licence and source URL; editions rejected and why; the divergence method and how many verses it flags; Lighthouse mobile for `/compare`.
