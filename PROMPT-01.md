# Prompt 01 — repo skeleton and corpus ingest

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first — they are the standing brief for this repo. Follow them exactly. Pay particular attention to the generic entity model (`Source → Work → Segment → Token`) in the extensibility doc: artifacts produced here must fit it, even though only the Quran is being populated.

Task: set up the repo skeleton and the first stage of the corpus pipeline. Nothing else. Do not scaffold the Next.js app yet.

**1. Monorepo skeleton**

- pnpm workspace with `packages/*` and `apps/*`
- TypeScript strict mode, shared `tsconfig.base.json`
- Vitest configured at the root
- `.gitignore` covering `node_modules`, `.next`, `packages/corpus-build/sources/`, `.env*`
- `.editorconfig`, Prettier, ESLint
- `git init` and an initial commit

**2. Python corpus pipeline — ingest stage only**

In `packages/corpus-build/`:

- `pyproject.toml`, Python 3.11+, dependencies pinned
- `pipeline/fetch.py` — downloads the Tanzil Uthmani and Tanzil Simple text editions, verifies with SHA-256 checksums recorded in `sources/checksums.json`, writes to `sources/`. If a file already exists and its checksum matches, skip the download. Never re-download silently.
- `pipeline/parse.py` — parses the Tanzil format into structured records
- `pipeline/normalise.py` — produces, as **separate fields** and never by mutating the source:
  - `text_uthmani` — exact source, untouched
  - `text_simple` — simple edition
  - `text_no_tashkeel` — diacritics stripped
  - `text_normalised` — no tashkeel, alif variants unified, ta marbuta and alif maqsura normalised, tatweel removed
- `pipeline/build.py` — writes `out/v0.1.0/` containing `sources.json`, `surahs.json`, `verses.jsonl`, and `manifest.json`

`sources.json` holds one record per text edition ingested, matching the `Source` entity in `docs/extensibility.md`: id, name, publisher, edition, year, url, licence, sha256. Every verse record references its source id rather than embedding source metadata.

`manifest.json` must record: corpus version, build timestamp, source ids, source SHA-256 checksums, and every normalisation rule applied as an explicit list. A reader must be able to reconstruct what was done from the manifest alone.

Verse identifiers follow the identifier policy in `docs/extensibility.md` — segmentation scheme included, e.g. `quran:tanzil-uthmani:2:43`. Do not use bare `2:43`.

**3. Tests**

pytest, covering:

- 6,236 verses parsed, 114 surahs
- Surah 1 has 7 verses, surah 2 has 286, surah 114 has 6
- Every normalisation function is idempotent — applying it twice equals applying it once
- Normalisation never alters `text_uthmani`
- Round-trip: parsing then serialising reproduces the source byte-for-byte
- Explicit tests that stripping tashkeel from a known verse gives the expected string — write these by hand, do not generate the expected value with the function under test

**4. Do not**

- Do not add token-level segmentation yet. Verses only. Tokens are prompt 02.
- Do not touch morphology, roots or lemmas yet.
- Do not add translations yet.
- Do not create the Next.js app.

**5. Report back**

When done, state: the commands to run the pipeline and the tests, the verse and surah counts your tests actually produced, the total size of `out/v0.1.0/`, and anything in the Tanzil format that surprised you or that you had to make a judgement call about.
