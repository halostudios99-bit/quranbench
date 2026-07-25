# Prompt 02 — basmala correction and token segmentation

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first. Prompt 01 is complete and its output is in `packages/corpus-build/out/v0.1.0/`. This prompt corrects a defect in it and then adds token segmentation.

## Part A — fix the basmala defect

**The defect.** In `out/v0.1.0/`, the basmala is merged into verse 1 of every surah except 9. Verse 2:1 currently reads `بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ` — basmala followed by the actual verse content.

This is wrong for this project. It shifts every token position in 112 surahs, inflates all word and letter frequencies, and makes basmala inclusion un-toggleable when it must be an explicit, recorded parameter of any computation.

**Required fix.**

1. Check the Tanzil download options for an edition that does not prepend the basmala. If one exists, use it — the fetcher should acquire both variants so the difference is verifiable rather than assumed.
2. Whether obtained from a separate download or by splitting, the outcome must be:
   - `text_uthmani` for verse 1 of each surah contains **only** that verse's own content
   - the basmala is stored **once per surah**, in `surahs.json`, as a separate labelled field with its own token range
   - `1:1` is unchanged — in Al-Fatiha the basmala **is** verse 1 and must remain so
   - surah 9 has no basmala; represent this explicitly as absent, not as an empty string
   - `27:30` contains the basmala as part of its own verse text — this is Quranic content, not a surah opening. Do not strip it. Add a test asserting this.
3. If splitting programmatically, do it by exact string match against the canonical basmala for that edition. Never by character count or index. Fail the build loudly if the expected prefix is not found where expected, or is found where it should not be.
4. Record in `manifest.json`: `basmala_handling: "separated"`, the canonical basmala string, and the count of surahs it was separated from (expect 112).

Bump the corpus version to `v0.2.0`. Do not edit `v0.1.0` in place — artifacts are immutable once written. Delete the `v0.1.0` directory only after `v0.2.0` passes all tests.

## Part B — token segmentation

Add a token layer to the pipeline, output as `tokens.jsonl` in `out/v0.2.0/`.

**Segmentation rules**

- Split verse text on whitespace.
- **Waqf and pause marks are not tokens.** The Uthmani text contains standalone pause marks (ۖ ۗ ۚ ۛ ۜ ۘ ۙ and others in the range U+06D6–U+06ED) which are space-separated and would otherwise become bogus tokens. Detect them, exclude them from the token stream, and record them as an attribute on the preceding token. Write a test asserting no token consists solely of marks in that range.
- Verse-end markers and Arabic-Indic digits are likewise not tokens.
- Sajda marks and rub-el-hizb marks (U+06DE) are not tokens.
- Do not attempt prefix or suffix splitting. A token is a whitespace-delimited word. Morphological segmentation is prompt 03 and must not be pre-empted here.

**Token record fields**

- `id` — `quran:tanzil-uthmani:<surah>:<ayah>:<position>`, position 1-based within the verse
- `verse_id`, `surah`, `ayah`, `position`
- `text_uthmani`, `text_simple`, `text_no_tashkeel`, `text_normalised` — the same four labelled forms as verses, derived by the same functions
- `char_start`, `char_end` — offsets into the verse's `text_uthmani`
- `following_marks` — any waqf marks that followed this token, or empty
- `is_basmala` — true for tokens in a separated surah-opening basmala

**Also produce**

- `identifiers.json` — the identifier policy in machine-readable form: scheme name, format, and the guarantee that positions are attributes rather than identity
- A `mapping/` directory with an empty `v0.1.0-to-v0.2.0.json` scaffold and its schema documented. It will be populated when a future version changes segmentation; the structure must exist now.

## Tests

- Total token count is reported, not asserted against a hardcoded figure — no authoritative count exists until segmentation rules are fixed. Print it in the build summary.
- Every token id is unique
- Token positions within each verse are contiguous from 1 with no gaps
- Concatenating a verse's tokens with single spaces, then reinserting recorded marks, reproduces the verse's `text_uthmani` exactly
- No token is composed solely of characters in U+06D6–U+06ED
- 2:1 tokens begin with `الٓمٓ`, not `بِسْمِ`
- 1:1 tokens begin with `بِسْمِ`
- 9:1 has no basmala and its first token is `بَرَآءَةٌ`
- 27:30 retains the basmala inside its own token stream
- Verse 2:43 has exactly 7 tokens, and token 4 is `ٱلزَّكَوٰةَ`

## Report back

State: the total token count, the number of waqf marks excluded, the number of surahs the basmala was separated from, whether Tanzil offers a no-basmala download or whether you split programmatically, and any verse where segmentation required a judgement call.
