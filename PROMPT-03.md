# Prompt 03 — neutral basmala addressing and verse numbering schemes

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first. Prompt 02 is complete; its output is `packages/corpus-build/out/v0.2.0/`.

## The problem

v0.2.0 addresses the separated surah-opening basmala as ayah 0 — `quran:tanzil-uthmani:2:0:1`.

That encodes a theological position. Numbering the basmala as 0 asserts it is not a verse, which is a contested claim: counting traditions disagree, and the disagreement over the basmala is one of the main reasons they disagree. This platform must not assert either side in its data model.

Equally, renumbering the basmala as verse 1 would just assert the opposite position. The fix is to make numbering an explicit, recorded parameter rather than a fact baked into identifiers.

## Part A — neutral addressing

- Replace the ayah-0 scheme. The separated surah-opening basmala is addressed as `quran:tanzil-uthmani:<surah>:basmala:<position>` — a named segment slot, not an ordinal.
- Al-Fatiha is unchanged: its basmala is `1:1` in the Kufan scheme and carries no special flag.
- Surah 9 remains explicitly `null`, not an empty segment.
- Update `identifiers.json` to document named segment slots as a first-class part of the scheme, alongside ordinal ayah numbers.
- Populate `mapping/v0.2.0-to-v0.3.0.json` with the real old-id to new-id mapping for every affected token. This is the first genuine use of the mapping mechanism — treat it as the reference implementation and make sure its schema is documented and tested.

## Part B — verse numbering schemes

Add a numbering-scheme layer.

- Model a numbering scheme as data, not code: an identifier, a name, a source citation, and the rules by which it assigns ordinal numbers to segments.
- Implement **Kufan** as the default, since it corresponds to the Hafs text edition already ingested. Verify it reproduces exactly the 6,236 verses currently in `verses.jsonl`.
- Build the mechanism so that additional schemes can be added later purely as data files. Do **not** attempt to implement other traditions now — their verse divisions require sources we do not have, and inventing them would be worse than omitting them.
- Every verse record gains an ordinal per active scheme rather than a single hardcoded `ayah` field. Keep `surah` and the segment slot as the stable identity; ordinals become an attribute, per the identifier policy in `docs/extensibility.md`.
- `manifest.json` records the available schemes, which was active for the build, and the resulting total verse count.

Add `docs/numbering.md` explaining, in plain English: what a numbering scheme is, why the platform treats numbering as a parameter, which scheme is default and why, and how a new scheme would be contributed. This page will be user-facing eventually — write it for a reader, not for a developer.

## Part C — computation parameters

Introduce an explicit, serialisable parameter set that every future computation must carry and disclose:

```
text_edition, corpus_version, numbering_scheme,
include_basmala, include_waqf_marks, tashkeel_counted,
normalisation_profile
```

Define it as a typed structure with defaults, serialisable to a short stable string suitable for display beside any result and for inclusion in a citation. Nothing consumes it yet — the search engine will. It must exist before any statistic is computed anywhere, so that no number can be produced without recording how.

## Version

Output `out/v0.3.0/`. Do not modify v0.2.0 in place. Delete v0.2.0 only after v0.3.0 passes all tests, and only after the mapping file is complete.

## Tests

- Kufan scheme reproduces exactly 6,236 ordinal verses
- Total token count is unchanged from v0.2.0 — this refactor must not alter segmentation
- Every v0.2.0 token id maps to exactly one v0.3.0 id, and the mapping is total: no token is orphaned
- No identifier anywhere contains `:0:`
- 1:1 basmala is addressed ordinally, not as a named slot
- 9 has no basmala segment
- Parameter set serialises and round-trips
- Verse 2:43 still has 7 tokens and token 4 is still `ٱلزَّكَوٰةَ`

## Report back

State: the new identifier forms with examples, total tokens and verses, confirmation the mapping is total, and any place where avoiding a numbering assumption forced an awkward compromise.
